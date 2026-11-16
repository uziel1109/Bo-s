// Prueba E2E de la versión web (PWA) emulando un iPad.
// Uso: npm run test:web       (BROWSER=webkit para usar el motor de Safari)
import { createRequire } from 'node:module';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const pw = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist-web');
const shots = path.join(root, 'e2e', 'screens');
fs.mkdirSync(shots, { recursive: true });
const browserName = process.env.BROWSER ?? 'chromium';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname.replace(/^\/Bo-s/, ''));
  let f = path.join(dist, p === '/' ? 'index.html' : p);
  if (!f.startsWith(dist) || !fs.existsSync(f)) f = path.join(dist, 'index.html');
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] ?? 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://localhost:${server.address().port}/Bo-s/`;

let failures = 0;
const check = (c, m) => {
  console.log(`  ${c ? '✔' : '✘'} ${m}`);
  if (!c) failures++;
};

const browser = await pw[browserName].launch();
const device = pw.devices['iPad Pro 11 landscape'];
const context = await browser.newContext({ ...device, acceptDownloads: true, serviceWorkers: 'allow' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('dialog', (d) => d.accept());
try {
  console.log(`▶ Versión web en ${browserName} (${device.viewport.width}×${device.viewport.height})`);
  await page.goto(base);
  await page.waitForSelector('text=Configuración inicial', { timeout: 30000 });
  await page.fill('[data-testid=pf-age]', '31');
  await page.fill('[data-testid=pf-weight]', '92');
  await page.click('[data-testid=onb-next]');
  await page.fill('[data-testid=pf-waist]', '99');
  await page.fill('[data-testid=pf-neck]', '39');
  for (let i = 0; i < 4; i++) await page.click('[data-testid=onb-next]');
  await page.click('[data-testid=onb-finish]');
  await page.waitForSelector('[data-testid=dash-weight]', { timeout: 15000 });
  check((await page.textContent('[data-testid=dash-weight]')).includes('92'), 'Perfil creado y panel visible');
  const noHScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  check(noHScroll, 'Sin desplazamiento horizontal en iPad');

  await page.click('[data-testid=nav-nutricion]');
  await page.click('[data-testid=add-food-desayuno]');
  await page.fill('[data-testid=food-search]', 'pechuga de pollo sin piel, asada');
  await page.click('[data-testid=food-option-pollo_pechuga_cocida]');
  await page.fill('[data-testid=food-grams]', '200');
  await page.click('[data-testid=food-add-confirm]');
  await page.keyboard.press('Escape');
  await page.click('[data-testid=nav-dashboard]');
  check((await page.textContent('[data-testid=dash-kcal]')).replace(/\D/g, '') === '330', 'Comida registrada: 330 kcal');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(shots, `web-ipad-dashboard-${browserName}.png`) });

  console.log('▶ Lista del súper');
  await page.click('[data-testid=nav-nutricion]');
  await page.click('.tabs button:has-text("Plan de comidas")');
  await page.click('[data-testid=gen-mealplan]');
  await page.click('[data-testid=go-shopping]');
  await page.click('[data-testid=shopping-create]');
  await page.waitForSelector('.shop-item');
  const nItems = await page.locator('.shop-item').count();
  check(nItems > 8, `Lista creada con ${nItems} artículos`);
  check(!(await page.locator('.shop-name', { hasText: /cocid/i }).count()), 'Los artículos aparecen en crudo/seco (sin "cocido")');
  await page.locator('.shop-item').first().click();
  await page.waitForTimeout(400);
  check((await page.textContent('[data-testid=shopping-progress]')).trim().startsWith('1'), 'Marcar un artículo actualiza el progreso');
  await page.screenshot({ path: path.join(shots, `web-ipad-super-${browserName}.png`) });
  await page.reload();
  await page.waitForSelector('[data-testid=dash-weight]', { timeout: 20000 });
  await page.click('[data-testid=nav-nutricion]');
  await page.click('.tabs button:has-text("Lista del súper")');
  await page.waitForSelector('.shop-item');
  check((await page.locator('.shop-item.done').count()) === 1, 'La lista y lo marcado persisten tras recargar');
  await page.click('[data-testid=nav-dashboard]');

  console.log('▶ Persistencia al recargar');
  await page.reload();
  await page.waitForSelector('[data-testid=dash-kcal]', { timeout: 20000 });
  check((await page.textContent('[data-testid=dash-kcal]')).replace(/\D/g, '') === '330', 'Los datos persisten tras recargar (IndexedDB)');

  console.log('▶ Respaldo y restauración');
  await page.click('[data-testid=nav-config]');
  await page.click('.tabs button:has-text("Datos y respaldos")');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.click('button:has-text("Crear respaldo")')]);
  const backupPath = path.join(shots, 'web-respaldo.bodyos');
  await dl.saveAs(backupPath);
  check(fs.statSync(backupPath).size > 1000, `Respaldo descargado (${fs.statSync(backupPath).size} bytes)`);
  // Borrar todo y restaurar
  page.removeAllListeners('dialog');
  page.on('dialog', (d) => d.accept(d.type() === 'prompt' ? 'ELIMINAR' : undefined));
  await page.click('button:has-text("Eliminar todo")');
  await page.waitForSelector('text=Configuración inicial', { timeout: 15000 });
  check(true, 'Datos eliminados (vuelve el asistente inicial)');
  // En un dispositivo nuevo se restaura desde el propio asistente inicial.
  await page.click('[data-testid=onb-restore-open]');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('[data-testid=onb-restore]')]);
  await chooser.setFiles(backupPath);
  await page.waitForSelector('[data-testid=dash-kcal]', { timeout: 20000 });
  check((await page.textContent('[data-testid=dash-kcal]')).replace(/\D/g, '') === '330', 'Respaldo restaurado correctamente');

  const portrait = await browser.newContext({ ...pw.devices['iPad Pro 11'] });
  const pp = await portrait.newPage();
  await pp.goto(base);
  await pp.waitForSelector('text=Paso 1 de');
  check(await pp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Vertical: sin desplazamiento horizontal');
  await pp.screenshot({ path: path.join(shots, `web-ipad-vertical-${browserName}.png`) });
  await portrait.close();

  console.log('▶ Sin conexión');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.goto(base);
  await page.waitForSelector('[data-testid=dash-kcal]');
  // Corte real: se apaga el servidor (no se usa la simulación de red de Playwright, que en WebKit
  // bloquea también lo que responde el service worker). La app debe abrir desde la caché.
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  const off = await context.newPage();
  let offlineErr = '';
  const offlineOk = await off
    .goto(base)
    .then(() => off.waitForSelector('[data-testid=dash-kcal]', { timeout: 15000 }))
    .then(() => true)
    .catch((e) => ((offlineErr = e.message.split('\n')[0]), false));
  check(offlineOk, `La app abre sin conexión (service worker)${offlineErr ? ': ' + offlineErr : ''}`);
  await off.close();

  check(errors.length === 0, `Sin errores de página (${errors.slice(0, 3).join(' | ')})`);
} catch (e) {
  console.error(e);
  failures++;
  await page.screenshot({ path: path.join(shots, 'web-failure.png') }).catch(() => {});
} finally {
  await browser.close();
  if (server.listening) server.close();
}
console.log(failures ? `\n✘ ${failures} verificaciones fallaron` : '\n✔ Todas las verificaciones web pasaron');
process.exit(failures ? 1 : 0);
