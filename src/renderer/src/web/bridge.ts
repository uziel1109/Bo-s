// Puente de la versión web (iPad/navegador): implementa en el navegador los mismos canales que el
// proceso principal de Electron, para que la interfaz sea idéntica en ambas plataformas.
// Todo se guarda en IndexedDB de este dispositivo; nada sale de él salvo las funciones opcionales en línea.
import initSqlJs from 'sql.js/dist/sql-wasm.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { LocalDB } from '@shared/db/localdb';
import { SCHEMA, type ListQuery, type TableName } from '@shared/schema';
import { seedFoods } from '@shared/nutrition/foodsSeed';
import { syncSeedFoods } from '@shared/nutrition/seedSync';
import { importJsonTables, importRows, parseCsv, toCsv, type ImportKind } from '@shared/dataIO';
import { packBackup, unpackBackup, toBase64, fromBase64 } from '@shared/backupCodec';
import { DEFAULT_MODEL } from '@shared/ai/claude';
import { idbClear, idbDel, idbGet, idbKeys, idbPut } from './idb';
import { pickFiles, saveFile, zipStore } from './files';

type Handler = (...args: never[]) => unknown;
const today = () => new Date().toISOString().slice(0, 10);
const IMG_TYPES: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic' };

const WRITES = new Set(['db:upsert', 'db:bulkUpsert', 'db:remove', 'db:setActive', 'photos:pick', 'photos:addFile', 'backup:restore', 'import:csv', 'import:csvText', 'import:json', 'data:deleteAll']);

export async function createWebBridge() {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const initial = (await idbGet<Uint8Array>('kv', 'db')) ?? null;
  // Escrituras encadenadas: cada cambio queda guardado en IndexedDB antes de confirmarse a la interfaz.
  let pendingSave: Promise<unknown> = Promise.resolve();
  const db = new LocalDB(SQL, initial, (bytes) => {
    const copy = bytes.slice();
    pendingSave = pendingSave.then(() => idbPut('kv', 'db', copy)).catch((e) => console.error('No se pudo guardar la base de datos', e));
  });
  /** Guarda de inmediato y espera a que IndexedDB confirme la escritura. */
  const durable = async () => {
    db.flush();
    await pendingSave;
  };
  syncSeedFoods(db);
  db.flush();
  // Guardar de inmediato al salir o pasar a segundo plano.
  const flush = () => db.flush();
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
  window.addEventListener('pagehide', flush);
  // Pide al navegador que no borre los datos automáticamente.
  let persisted = false;
  try {
    persisted = (await navigator.storage?.persisted?.()) || (await navigator.storage?.persist?.()) || false;
  } catch {
    /* no disponible */
  }

  // Clave de cifrado de fotos: AES-GCM no exportable, guardada en IndexedDB.
  let photoKey = await idbGet<CryptoKey>('kv', 'photoKey');
  if (!photoKey) {
    photoKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await idbPut('kv', 'photoKey', photoKey);
  }
  const encPhoto = async (bytes: Uint8Array) => {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    return { iv, data: new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, photoKey!, bytes as BufferSource)) };
  };
  const decPhoto = async (rec: { iv: Uint8Array; data: Uint8Array }) => new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: rec.iv as BufferSource }, photoKey!, rec.data as BufferSource));
  const urlCache = new Map<string, string>();

  const isTable = (t: string): t is TableName => t in SCHEMA;
  const table = (t: string) => {
    if (!isTable(t)) throw new Error('Tabla no válida');
    return t;
  };

  const addPhoto = async (file: File, meta: { date: string; pose: string; conditions?: unknown; notes?: string }) => {
    const ext = (file.name.split('.').pop() ?? '').toLowerCase();
    if (!IMG_TYPES[ext] && !file.type.startsWith('image/')) throw new Error('Formato no admitido (usa JPG, PNG, WEBP o HEIC).');
    if (file.size > 25 * 1024 * 1024) throw new Error('La imagen supera 25 MB.');
    const id = crypto.randomUUID();
    const name = `${id}.${IMG_TYPES[ext] ? ext : 'jpg'}.enc`;
    // La imagen se guarda tal cual (sin alterar), solo cifrada.
    await idbPut('photos', name, await encPhoto(new Uint8Array(await file.arrayBuffer())));
    return db.upsert('photos', { id, date: meta.date, pose: meta.pose, file_name: name, conditions: meta.conditions ?? null, notes: meta.notes ?? null });
  };

  const aiCfg = async () => {
    const cfg = (await idbGet<{ enabled: boolean; model: string }>('kv', 'aiConfig')) ?? { enabled: false, model: DEFAULT_MODEL };
    const key = await idbGet<string>('kv', 'aiKey');
    return { ...cfg, hasKey: !!key, secureStorage: true };
  };
  const aiClient = async () => {
    const cfg = await aiCfg();
    if (!cfg.enabled) throw new Error('La integración de IA está desactivada.');
    const apiKey = await idbGet<string>('kv', 'aiKey');
    if (!apiKey) throw new Error('No hay una clave API configurada.');
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    // La app no tiene servidor: la llamada sale directamente de este dispositivo a la API de Anthropic.
    return { client: new Anthropic({ apiKey, dangerouslyAllowBrowser: true }), model: cfg.model };
  };

  const handlers: Record<string, Handler> = {
    'db:list': (t: string, q?: ListQuery) => db.list(table(t), q),
    'db:get': (t: string, id: string | number) => db.get(table(t), id),
    'db:upsert': (t: string, row: Record<string, unknown>) => db.upsert(table(t), row),
    'db:bulkUpsert': (t: string, rows: Record<string, unknown>[]) => db.bulkUpsert(table(t), rows),
    'db:remove': async (t: string, id: string | number) => {
      if (t === 'photos') {
        const ph = db.get('photos', id);
        if (ph?.file_name) await idbDel('photos', String(ph.file_name));
      }
      db.remove(table(t), id);
      return true;
    },
    'db:setActive': (t: 'nutrition_plans' | 'meal_plans' | 'routines', id: string) => {
      if (!['nutrition_plans', 'meal_plans', 'routines'].includes(t)) throw new Error('Tabla no válida');
      db.setActive(t, id);
      return true;
    },

    // Fotos
    'photos:pick': (meta: { date: string; pose: string }) => {
      const p = pickFiles('image/*'); // síncrono dentro del toque
      return p.then((files) => (files[0] ? addPhoto(files[0], meta) : null));
    },
    'photos:addFile': (file: File, meta: { date: string; pose: string }) => addPhoto(file, meta),
    'photos:url': async (name: string) => {
      if (urlCache.has(name)) return urlCache.get(name)!;
      const rec = await idbGet<{ iv: Uint8Array; data: Uint8Array }>('photos', name);
      if (!rec) return '';
      const ext = name.replace(/\.enc$/, '').split('.').pop() ?? 'jpg';
      const url = URL.createObjectURL(new Blob([(await decPhoto(rec)) as BlobPart], { type: IMG_TYPES[ext] ?? 'image/jpeg' }));
      urlCache.set(name, url);
      return url;
    },

    // Respaldos (mismo formato que el escritorio)
    'backup:create': async (password: string | null) => {
      db.flush();
      const photos: Record<string, string> = {};
      for (const name of await idbKeys('photos')) {
        const rec = await idbGet<{ iv: Uint8Array; data: Uint8Array }>('photos', name);
        if (rec) photos[name] = toBase64(await decPhoto(rec));
      }
      const bytes = await packBackup({ format: 'bodyos-backup', version: 2, source: 'web', createdAt: new Date().toISOString(), db: toBase64(db.exportBytes()), photos }, password || null);
      return saveFile(`bodyos-respaldo-${today()}.bodyos`, bytes, 'application/octet-stream');
    },
    'backup:restore': (password: string | null) => {
      const p = pickFiles('.bodyos,application/octet-stream,*/*');
      return p.then(async (files) => {
        if (!files[0]) return null;
        const payload = await unpackBackup(new Uint8Array(await files[0].arrayBuffer()), password || null);
        db.replaceWith(fromBase64(payload.db));
        await idbClear('photos');
        urlCache.clear();
        for (const [name, b64] of Object.entries(payload.photos)) {
          if (/[/\\]|\.\./.test(name)) continue;
          await idbPut('photos', name, await encPhoto(fromBase64(b64)));
        }
        db.flush();
        return payload.createdAt;
      });
    },

    // Exportación / importación
    'export:json': () => saveFile(`bodyos-datos-${today()}.json`, JSON.stringify({ exportedAt: new Date().toISOString(), note: 'Las fotos no se incluyen en esta exportación; usa un respaldo para conservarlas.', tables: db.dump() }, null, 2), 'application/json'),
    'export:csv': () => {
      const enc = new TextEncoder();
      const files = Object.entries(db.dump())
        .filter(([, rows]) => rows.length)
        .map(([t, rows]) => ({ name: `${t}.csv`, data: enc.encode('﻿' + toCsv(rows)) }));
      return saveFile(`bodyos-csv-${today()}.zip`, zipStore(files), 'application/zip');
    },
    'import:csv': (kind: ImportKind) => {
      const p = pickFiles('.csv,.txt,text/csv,text/plain');
      return p.then(async (files) => (files[0] ? importRows(db, kind, parseCsv((await files[0].text()).replace(/^﻿/, ''))) : null));
    },
    'import:csvText': (kind: ImportKind, text: string) => importRows(db, kind, parseCsv(text)),
    'import:json': () => {
      const p = pickFiles('.json,application/json');
      return p.then(async (files) => (files[0] ? importJsonTables(db, JSON.parse(await files[0].text())) : null));
    },
    'data:deleteAll': async () => {
      db.clearAll();
      await idbClear('photos');
      urlCache.clear();
      db.bulkUpsert('foods', seedFoods() as unknown as Record<string, unknown>[]);
      db.flush();
      return true;
    },

    // Código de barras (Open Food Facts; requiere conexión)
    'food:barcode': async (code: string) => {
      if (!/^\d{6,14}$/.test(code)) throw new Error('Código de barras inválido.');
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,brands,nutriments`);
      if (!res.ok) throw new Error(`No se pudo consultar Open Food Facts (HTTP ${res.status}).`);
      const j = (await res.json()) as { status: number; product?: { product_name?: string; brands?: string; nutriments?: Record<string, number> } };
      if (j.status !== 1 || !j.product) return null;
      const n = j.product.nutriments ?? {};
      const kcal = n['energy-kcal_100g'] ?? (n['energy_100g'] ? n['energy_100g'] / 4.184 : null);
      return { name: [j.product.product_name, j.product.brands].filter(Boolean).join(' — ') || `Producto ${code}`, kcal: kcal != null ? Math.round(kcal) : null, protein: n['proteins_100g'] ?? null, carbs: n['carbohydrates_100g'] ?? null, fat: n['fat_100g'] ?? null, fiber: n['fiber_100g'] ?? null, barcode: code };
    },

    // IA opcional
    'ai:config': aiCfg,
    'ai:setConfig': async (c: { enabled?: boolean; model?: string }) => {
      const cur = await aiCfg();
      await idbPut('kv', 'aiConfig', { enabled: c.enabled ?? cur.enabled, model: (c.model || cur.model).trim() });
    },
    'ai:setKey': async (k: string) => {
      if (!k.trim()) throw new Error('Clave vacía.');
      await idbPut('kv', 'aiKey', k.trim());
    },
    'ai:clearKey': () => idbDel('kv', 'aiKey'),
    'ai:chat': async (q: string, ctx: string, history: { role: 'user' | 'assistant'; content: string }[]) => {
      const { client, model } = await aiClient();
      const { chat } = await import('@shared/ai/claude');
      return chat(client, model, q, ctx, history);
    },
    'ai:analyzeFood': async (b64: string, mt: 'image/jpeg' | 'image/png' | 'image/webp', foods: { id: string; name: string }[], planHint?: string) => {
      const { client, model } = await aiClient();
      const { analyzeFoodPhoto } = await import('@shared/ai/claude');
      return analyzeFoodPhoto(client, model, b64, mt, foods, planHint);
    },

    'app:info': async () => ({
      version: __APP_VERSION__,
      dataDir: 'Almacenamiento interno de este navegador (IndexedDB)',
      photoEncryption: 'Clave AES-256 no exportable guardada en este dispositivo',
      platform: 'web',
      persisted,
    }),
    'app:openDataFolder': () => '',
  };

  return {
    platform: 'web' as const,
    // Sin "await" antes de llamar al manejador: así el selector de archivos se abre dentro del toque del usuario.
    invoke: (channel: string, ...args: unknown[]): Promise<unknown> => {
      const h = handlers[channel];
      if (!h) return Promise.reject(new Error(`Canal no disponible en la versión web: ${channel}`));
      try {
        const res = Promise.resolve((h as (...a: unknown[]) => unknown)(...args));
        // Para cambios de datos, se responde hasta que el guardado en el dispositivo terminó.
        return WRITES.has(channel) ? res.then(async (v) => (await durable(), v)) : res;
      } catch (e) {
        return Promise.reject(e);
      }
    },
    pathForFile: () => '',
  };
}
