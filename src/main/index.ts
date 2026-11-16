// Proceso principal de Electron: ventana, base de datos local, fotos cifradas, respaldos, exportación e IA opcional.
import { app, BrowserWindow, dialog, ipcMain, net, protocol, safeStorage, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import initSqlJs from 'sql.js';
import { openFileDB, type LocalDB } from './db';
import { AIService } from './ai';
import { decryptBytes, encryptBytes, loadOrCreatePhotoKey, packBackup, unpackBackup, type KeyStore } from './secure';
import { SCHEMA, type ListQuery, type TableName } from '../shared/schema';
import { seedFoods } from '../shared/nutrition/foodsSeed';
import { syncSeedFoods } from '../shared/nutrition/seedSync';
import { importJsonTables, importRows, parseCsv, toCsv } from '../shared/dataIO';

// Permite aislar los datos en pruebas automatizadas.
if (process.env.BODYOS_USER_DATA) app.setPath('userData', process.env.BODYOS_USER_DATA);

// Interfaz en español (formato de fechas y números de los controles nativos).
app.commandLine.appendSwitch('lang', 'es-MX');

protocol.registerSchemesAsPrivileged([{ scheme: 'bodyos-photo', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

let db: LocalDB;
let ai: AIService;
let photoKey: Buffer;
let win: BrowserWindow | null = null;
const dataDir = () => path.join(app.getPath('userData'), 'data');
const photoDir = () => path.join(dataDir(), 'photos');

const keyStore: KeyStore = {
  isEncryptionAvailable: () => {
    try {
      return safeStorage.isEncryptionAvailable() && (process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text');
    } catch {
      return false;
    }
  },
  encryptString: (s) => safeStorage.encryptString(s),
  decryptString: (b) => safeStorage.decryptString(b),
};

async function initData() {
  const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
  const SQL = await initSqlJs({ wasmBinary: fs.readFileSync(wasmPath.replace('app.asar', 'app.asar.unpacked')) as unknown as ArrayBuffer });
  fs.mkdirSync(photoDir(), { recursive: true });
  db = openFileDB(SQL, path.join(dataDir(), 'bodyos.db'));
  photoKey = loadOrCreatePhotoKey(dataDir(), keyStore);
  ai = new AIService(dataDir(), keyStore);
  // Base de datos inicial de alimentos (solo la primera vez; no sobrescribe ediciones del usuario).
  syncSeedFoods(db);
  db.flush();
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    title: 'BODY OS',
    backgroundColor: '#0b0d10',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  win.once('ready-to-show', () => win?.show());
  // Enlaces externos en el navegador del sistema; la app nunca navega fuera de sí misma.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://') && !url.startsWith(process.env.ELECTRON_RENDERER_URL ?? '__')) e.preventDefault();
  });
  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL);
  else win.loadFile(path.join(__dirname, '../renderer/index.html'));
}

const isTable = (t: string): t is TableName => t in SCHEMA;

function handle<T extends unknown[]>(channel: string, fn: (...args: T) => unknown) {
  ipcMain.handle(channel, async (_e, ...args) => {
    try {
      return { ok: true, data: await fn(...(args as T)) };
    } catch (err) {
      console.error(`[${channel}]`, err);
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}

function savePhoto(srcPath: string, meta: { date: string; pose: string; conditions?: unknown; notes?: string }) {
  const ext = path.extname(srcPath).toLowerCase();
  if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) throw new Error('Formato no admitido (usa JPG, PNG o WEBP).');
  const stat = fs.statSync(srcPath);
  if (stat.size > 25 * 1024 * 1024) throw new Error('La imagen supera 25 MB.');
  const id = crypto.randomUUID();
  const file = `${id}${ext}.enc`;
  // La imagen se guarda tal cual (sin alterar), solo cifrada.
  fs.writeFileSync(path.join(photoDir(), file), encryptBytes(photoKey, fs.readFileSync(srcPath)));
  return db.upsert('photos', { id, date: meta.date, pose: meta.pose, file_name: file, conditions: meta.conditions ?? null, notes: meta.notes ?? null });
}

function registerIpc() {
  handle('db:list', (table: string, q?: ListQuery) => {
    if (!isTable(table)) throw new Error('Tabla no válida');
    return db.list(table, q);
  });
  handle('db:get', (table: string, id: string | number) => {
    if (!isTable(table)) throw new Error('Tabla no válida');
    return db.get(table, id);
  });
  handle('db:upsert', (table: string, row: Record<string, unknown>) => {
    if (!isTable(table)) throw new Error('Tabla no válida');
    return db.upsert(table, row);
  });
  handle('db:bulkUpsert', (table: string, rows: Record<string, unknown>[]) => {
    if (!isTable(table)) throw new Error('Tabla no válida');
    return db.bulkUpsert(table, rows);
  });
  handle('db:remove', (table: string, id: string | number) => {
    if (!isTable(table)) throw new Error('Tabla no válida');
    if (table === 'photos') {
      const ph = db.get('photos', id);
      if (ph?.file_name) fs.rmSync(path.join(photoDir(), String(ph.file_name)), { force: true });
    }
    db.remove(table, id);
    return true;
  });
  handle('db:setActive', (table: 'nutrition_plans' | 'meal_plans' | 'routines', id: string) => {
    if (!['nutrition_plans', 'meal_plans', 'routines'].includes(table)) throw new Error('Tabla no válida');
    db.setActive(table, id);
    return true;
  });
  handle('db:dumpAll', () => db.dump());

  // Fotos
  handle('photos:pick', async (meta: { date: string; pose: string; conditions?: unknown; notes?: string }) => {
    const r = await dialog.showOpenDialog(win!, { title: 'Selecciona la foto de progreso', properties: ['openFile'], filters: [{ name: 'Imágenes', extensions: ['jpg', 'jpeg', 'png', 'webp'] }] });
    if (r.canceled || !r.filePaths[0]) return null;
    return savePhoto(r.filePaths[0], meta);
  });
  handle('photos:addFromPath', (srcPath: string, meta: { date: string; pose: string; conditions?: unknown; notes?: string }) => savePhoto(srcPath, meta));

  // Respaldos
  handle('backup:create', async (password: string | null) => {
    const r = await dialog.showSaveDialog(win!, { title: 'Guardar respaldo', defaultPath: `bodyos-respaldo-${new Date().toISOString().slice(0, 10)}.bodyos`, filters: [{ name: 'Respaldo BODY OS', extensions: ['bodyos'] }] });
    if (r.canceled || !r.filePath) return null;
    db.flush();
    const photos: Record<string, string> = {};
    for (const f of fs.readdirSync(photoDir())) photos[f] = decryptBytes(photoKey, fs.readFileSync(path.join(photoDir(), f))).toString('base64');
    fs.writeFileSync(r.filePath, await packBackup({ format: 'bodyos-backup', version: 2, source: 'escritorio', createdAt: new Date().toISOString(), db: Buffer.from(db.exportBytes()).toString('base64'), photos }, password || null));
    return r.filePath;
  });
  handle('backup:restore', async (password: string | null) => {
    const r = await dialog.showOpenDialog(win!, { title: 'Restaurar respaldo', properties: ['openFile'], filters: [{ name: 'Respaldo BODY OS', extensions: ['bodyos'] }] });
    if (r.canceled || !r.filePaths[0]) return null;
    const payload = await unpackBackup(fs.readFileSync(r.filePaths[0]), password || null);
    db.replaceWith(new Uint8Array(Buffer.from(payload.db, 'base64')));
    for (const f of fs.readdirSync(photoDir())) fs.rmSync(path.join(photoDir(), f), { force: true });
    for (const [name, b64] of Object.entries(payload.photos)) {
      if (name.includes('/') || name.includes('\\') || name.includes('..')) continue;
      fs.writeFileSync(path.join(photoDir(), name), encryptBytes(photoKey, Buffer.from(b64, 'base64')));
    }
    return payload.createdAt;
  });

  // Exportación / importación
  handle('export:json', async () => {
    const r = await dialog.showSaveDialog(win!, { title: 'Exportar datos (JSON)', defaultPath: `bodyos-datos-${new Date().toISOString().slice(0, 10)}.json`, filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (r.canceled || !r.filePath) return null;
    fs.writeFileSync(r.filePath, JSON.stringify({ exportedAt: new Date().toISOString(), note: 'Las fotos no se incluyen en esta exportación; usa un respaldo para conservarlas.', tables: db.dump() }, null, 2));
    return r.filePath;
  });
  handle('export:csv', async () => {
    const r = await dialog.showOpenDialog(win!, { title: 'Carpeta para los archivos CSV', properties: ['openDirectory', 'createDirectory'] });
    if (r.canceled || !r.filePaths[0]) return null;
    const dir = path.join(r.filePaths[0], `bodyos-csv-${new Date().toISOString().slice(0, 10)}`);
    fs.mkdirSync(dir, { recursive: true });
    const dump = db.dump();
    for (const [t, rows] of Object.entries(dump)) if (rows.length) fs.writeFileSync(path.join(dir, `${t}.csv`), '﻿' + toCsv(rows));
    return dir;
  });
  handle('import:csv', async (kind: 'body_logs' | 'food_logs' | 'steps_logs') => {
    const r = await dialog.showOpenDialog(win!, { title: 'Importar CSV', properties: ['openFile'], filters: [{ name: 'CSV', extensions: ['csv', 'txt'] }] });
    if (r.canceled || !r.filePaths[0]) return null;
    const rows = parseCsv(fs.readFileSync(r.filePaths[0], 'utf8').replace(/^﻿/, ''));
    return importRows(db, kind, rows);
  });
  handle('import:csvText', (kind: 'body_logs' | 'food_logs' | 'steps_logs', text: string) => importRows(db, kind, parseCsv(text)));
  handle('import:json', async () => {
    const r = await dialog.showOpenDialog(win!, { title: 'Importar exportación JSON de BODY OS', properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (r.canceled || !r.filePaths[0]) return null;
    return importJsonTables(db, JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8')));
  });

  handle('data:deleteAll', () => {
    db.clearAll();
    for (const f of fs.readdirSync(photoDir())) fs.rmSync(path.join(photoDir(), f), { force: true });
    db.bulkUpsert('foods', seedFoods() as unknown as Record<string, unknown>[]);
    db.flush();
    return true;
  });

  // Código de barras (Open Food Facts; requiere conexión)
  handle('food:barcode', async (code: string) => {
    if (!/^\d{6,14}$/.test(code)) throw new Error('Código de barras inválido.');
    const res = await net.fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,brands,nutriments,serving_size`, { headers: { 'User-Agent': 'BODY-OS/1.0 (aplicacion local)' } });
    if (!res.ok) throw new Error(`No se pudo consultar Open Food Facts (HTTP ${res.status}).`);
    const j = (await res.json()) as { status: number; product?: { product_name?: string; brands?: string; nutriments?: Record<string, number> } };
    if (j.status !== 1 || !j.product) return null;
    const n = j.product.nutriments ?? {};
    const kcal = n['energy-kcal_100g'] ?? (n['energy_100g'] ? n['energy_100g'] / 4.184 : null);
    return {
      name: [j.product.product_name, j.product.brands].filter(Boolean).join(' — ') || `Producto ${code}`,
      kcal: kcal != null ? Math.round(kcal) : null,
      protein: n['proteins_100g'] ?? null,
      carbs: n['carbohydrates_100g'] ?? null,
      fat: n['fat_100g'] ?? null,
      fiber: n['fiber_100g'] ?? null,
      barcode: code,
    };
  });

  // IA opcional
  handle('ai:config', () => ai.config());
  handle('ai:setConfig', (c: { enabled?: boolean; model?: string }) => ai.setConfig(c));
  handle('ai:setKey', (k: string) => ai.setKey(k));
  handle('ai:clearKey', () => ai.clearKey());
  handle('ai:chat', (q: string, ctx: string, history: { role: 'user' | 'assistant'; content: string }[]) => ai.chat(q, ctx, history));
  handle('ai:analyzeFood', (b64: string, mt: 'image/jpeg' | 'image/png' | 'image/webp', foods: { id: string; name: string }[], planHint?: string) => {
    if (typeof b64 !== 'string' || b64.length > 7_000_000) throw new Error('Imagen demasiado grande.');
    return ai.analyzeFood(b64, mt, foods, planHint);
  });

  handle('file:save', async (name: string, content: string, mime: string) => {
    const ext = name.split('.').pop() ?? '*';
    const r = await dialog.showSaveDialog(win!, { title: 'Guardar archivo', defaultPath: name, filters: [{ name: mime, extensions: [ext] }] });
    if (r.canceled || !r.filePath) return null;
    fs.writeFileSync(r.filePath, content);
    return r.filePath;
  });
  handle('app:info', () => ({ version: app.getVersion(), dataDir: dataDir(), photoEncryption: keyStore.isEncryptionAvailable() ? 'Clave protegida por el llavero del sistema' : 'Clave en archivo local con permisos restringidos', platform: process.platform }));
  handle('app:openDataFolder', () => shell.openPath(dataDir()));
}

app.whenReady().then(async () => {
  protocol.handle('bodyos-photo', async (req) => {
    try {
      const name = decodeURIComponent(new URL(req.url).hostname || new URL(req.url).pathname.replace(/^\/+/, ''));
      if (!/^[\w.-]+$/.test(name)) return new Response('bad request', { status: 400 });
      const buf = decryptBytes(photoKey, fs.readFileSync(path.join(photoDir(), name)));
      const ext = name.replace(/\.enc$/, '').split('.').pop();
      return new Response(new Uint8Array(buf), { headers: { 'Content-Type': ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg' } });
    } catch {
      return new Response('not found', { status: 404 });
    }
  });
  await initData();
  registerIpc();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => db?.close());
app.on('window-all-closed', () => {
  db?.flush();
  if (process.platform !== 'darwin') app.quit();
});
