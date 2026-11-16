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

const browser = await pw[browserName].launch(browserName === 'chromium' ? { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } : {});
const device = pw.devices['iPad Pro 11 landscape'];
const context = await browser.newContext({ ...device, acceptDownloads: true, serviceWorkers: 'allow' });
if (browserName === 'chromium') await context.grantPermissions(['camera']);
const page = await context.newPage();
// Los hitos nuevos muestran una celebración a pantalla completa: se cierra sola en la prueba y se cuenta.
const celebrations = [];
await page.addLocatorHandler(page.getByTestId('milestone-celebration'), async () => {
  celebrations.push((await page.getByTestId('milestone-celebration').textContent()).slice(0, 80));
  await page.click('[data-testid=milestone-ok]');
});
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
  await page.click('.tabs button:has-text("Plan y súper")');
  await page.click('.tabs.sub button:has-text("Plan de comidas")');
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
  await page.click('.tabs button:has-text("Plan y súper")');
  await page.click('.tabs.sub button:has-text("Lista del súper")');
  await page.waitForSelector('.shop-item');
  check((await page.locator('.shop-item.done').count()) === 1, 'La lista y lo marcado persisten tras recargar');
  await page.click('[data-testid=nav-dashboard]');

  console.log('▶ Foto del plato (IA simulada)');
  // La IA real requiere la clave del usuario: aquí se simula su respuesta para probar el flujo completo.
  await page.evaluate(() => {
    const orig = window.bodyos.invoke;
    window.bodyos.invoke = (ch, ...a) => {
      if (ch === 'ai:config') return Promise.resolve({ enabled: true, hasKey: true, model: 'x', secureStorage: true });
      if (ch === 'ai:analyzeFood')
        return Promise.resolve(JSON.stringify({ dish: 'Pechuga con arroz', items: [{ name: 'Pechuga asada', grams: 150, foodId: 'pollo_pechuga_cocida', confidence: 'alta' }, { name: 'Arroz', grams: 120, foodId: 'arroz_blanco_cocido', confidence: 'media' }], note: '' }));
      return orig(ch, ...a);
    };
  });
  await page.click('[data-testid=nav-nutricion]');
  await page.click('[data-testid=photo-desayuno]');
  await page.setInputFiles('[data-testid=photo-library-input]', path.join(root, 'src/renderer/public/icons/icon-192.png'));
  await page.click('[data-testid=photo-analyze]');
  await page.waitForSelector('[data-testid=photo-dish]');
  check((await page.textContent('[data-testid=photo-dish]')) === 'Pechuga con arroz', 'La IA identifica el platillo');
  check((await page.textContent('[data-testid=photo-kcal]')).replace(/\D/g, '') === '404', 'Calorías calculadas con alimentos verificados (248 + 156 = 404)');
  check(await page.isChecked('[data-testid=photo-replace]'), 'Ofrece reemplazar lo ya registrado en esa comida');
  await page.screenshot({ path: path.join(shots, `web-ipad-foto-${browserName}.png`) });
  await page.click('[data-testid=photo-save]');
  await page.click('[data-testid=nav-dashboard]');
  check((await page.textContent('[data-testid=dash-kcal]')).replace(/\D/g, '') === '404', 'El registro del día se reemplazó por lo detectado');
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('[data-testid=dash-kcal]', { timeout: 20000 });

  console.log('▶ Ritmo real, recordatorios y calentamiento');
  await page.evaluate(async () => {
    const rows = [];
    for (let i = 28; i >= 1; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      rows.push({ id: 'sim' + i, date, weight: Math.round((95 - (28 - i) * 0.1) * 10) / 10 });
    }
    await window.bodyos.invoke('db:bulkUpsert', 'body_logs', rows);
  });
  await page.reload();
  await page.waitForSelector('[data-testid=dash-real-eta]', { timeout: 20000 });
  check(/semanas?|sem/.test(await page.textContent('[data-testid=dash-real-eta]')), `Fecha a tu ritmo real: ${(await page.textContent('[data-testid=dash-real-eta]')).trim()}`);
  await page.screenshot({ path: path.join(shots, `web-ipad-ritmo-${browserName}.png`) });
  await page.click('[data-testid=nav-calendario]');
  const [ics] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click('[data-testid=ics-export]')]);
  const icsPath = path.join(shots, 'recordatorios.ics');
  await ics.saveAs(icsPath);
  const icsText = fs.readFileSync(icsPath, 'utf8');
  check(icsText.startsWith('BEGIN:VCALENDAR') && (icsText.match(/BEGIN:VEVENT/g) ?? []).length >= 5, `Archivo .ics con ${(icsText.match(/BEGIN:VEVENT/g) ?? []).length} recordatorios`);
  await page.click('[data-testid=nav-entrenamiento]');
  await page.click('[data-testid=session-start]');
  await page.waitForSelector('[data-testid=ex-0]');
  await page.fill('[data-testid=w-0-0]', '60');
  await page.waitForTimeout(300);
  check(await page.locator('.warmup').first().isVisible(), 'Series de calentamiento sugeridas');
  await page.screenshot({ path: path.join(shots, `web-ipad-calentamiento-${browserName}.png`) });
  await page.click('button:has-text("Descartar")');

  console.log('▶ Entreno en otro lado, movilidad y modo gimnasio');
  await page.click('.seg button:has-text("Casa con mancuernas")');
  await page.waitForSelector('[data-testid=travel-changes]');
  check((await page.locator('[data-testid=travel-changes] > div').count()) > 0, `Sesión adaptada al equipo de casa (${await page.locator('[data-testid=travel-changes] > div').count()} cambios)`);
  const drills = await page.locator('[data-testid=mobility-list] > div').count();
  check(drills >= 3, `Movilidad del día con ${drills} ejercicios animados`);
  await page.click('[data-testid=mobility-start]');
  await page.waitForSelector('[data-testid=mobility-guide] .ex-anim');
  await page.click('[data-testid=mobility-next]');
  check((await page.textContent('.modal')).includes('2 de'), 'Movilidad guiada avanza al siguiente ejercicio');
  await page.click('.modal button:has-text("Cerrar")');
  await page.click('[data-testid=session-start]');
  await page.click('[data-testid=gym-open]');
  await page.waitForSelector('[data-testid=gym-mode]');
  await page.fill('[data-testid=gym-weight]', '12');
  await page.click('[data-testid=gym-done]');
  await page.waitForSelector('[data-testid=gym-rest]');
  check(true, 'Modo gimnasio: serie registrada y descanso en pantalla completa');
  await page.screenshot({ path: path.join(shots, `web-ipad-gimnasio-${browserName}.png`) });
  await page.click('[data-testid=gym-skip]');
  await page.waitForSelector('[data-testid=gym-done]');
  await page.click('[data-testid=gym-exit]');
  check((await page.inputValue('[data-testid=w-0-0]')) === '12', 'Lo registrado en modo gimnasio aparece en la sesión');
  await page.click('button:has-text("Descartar")');

  console.log('▶ Fases, recetas, preparación y saciedad');
  await page.click('[data-testid=nav-nutricion]');
  await page.click('.tabs button:has-text("Fases y eventos")');
  await page.fill('[data-testid=event-name]', 'Boda');
  await page.click('[data-testid=event-add]');
  await page.waitForSelector('[data-testid=event-row]');
  check((await page.textContent('[data-testid=event-row]')).includes('Boda'), 'Evento agregado con su objetivo de calorías');
  await page.screenshot({ path: path.join(shots, `web-ipad-fases-${browserName}.png`) });
  await page.click('.tabs button:has-text("Plan y súper")');
  await page.click('.tabs.sub button:has-text("Plan de comidas")');
  await page.locator('[data-testid=meal-recipe]').first().click();
  await page.waitForSelector('[data-testid=recipe-option]');
  const nRecipes = await page.locator('[data-testid=recipe-option]').count();
  check(nRecipes >= 20, `Recetas mexicanas disponibles para el plan (${nRecipes})`);
  await page.locator('[data-testid=recipe-option] button').first().click();
  await page.waitForTimeout(300);
  check((await page.locator('.card-head', { hasText: /porci/ }).count()) > 0, 'La comida del plan se cambió por una receta con porciones ajustadas');
  await page.click('.tabs button:has-text("Preparación")');
  await page.waitForSelector('[data-testid=prep-batches]');
  check((await page.locator('[data-testid=prep-container]').count()) > 0, `Preparación en lote: ${await page.locator('[data-testid=prep-container]').count()} recipientes`);
  await page.screenshot({ path: path.join(shots, `web-ipad-preparacion-${browserName}.png`) });
  await page.click('.tabs button:has-text("Registro diario")');
  await page.click('[data-testid=sat-desayuno-4]');
  await page.waitForSelector('text=comidas calificadas');
  check(true, 'Saciedad calificada y análisis visible');

  console.log('▶ Resumen mensual y retos');
  await page.evaluate(() => {
    const orig = window.bodyos.invoke;
    window.__saved = null;
    window.bodyos.invoke = (ch, ...a) => {
      if (ch === 'file:save') {
        window.__saved = { name: a[0], size: a[1].length, png: a[1][0] === 0x89 && a[1][1] === 0x50 };
        return Promise.resolve(a[0]);
      }
      return orig(ch, ...a);
    };
  });
  await page.click('[data-testid=nav-progreso]');
  await page.click('.tabs button:has-text("Resumen mensual")');
  await page.waitForSelector('[data-testid=monthly-card]');
  await page.click('[data-testid=monthly-save]');
  await page.waitForFunction(() => window.__saved, null, { timeout: 10000 });
  const saved = await page.evaluate(() => window.__saved);
  check(saved.png && saved.size > 20000 && /bodyos-resumen-\d{4}-\d{2}\.png/.test(saved.name), `Imagen del resumen generada (${Math.round(saved.size / 1024)} KB)`);
  await page.screenshot({ path: path.join(shots, `web-ipad-mensual-${browserName}.png`) });
  await page.click('[data-testid=nav-dashboard]');
  await page.waitForSelector('[data-testid=challenges]');
  check((await page.locator('[data-testid=challenges] .challenge').count()) > 0, `Retos de la semana: ${await page.locator('[data-testid=challenges] .challenge').count()}`);

  console.log('▶ Hitos y fotos con guía');
  check(celebrations.length > 0, `Celebración de hitos mostrada (${celebrations[0] ?? 'ninguna'})`);
  await page.click('[data-testid=nav-progreso]');
  await page.click('.tabs button:has-text("Hitos")');
  await page.waitForSelector('[data-testid=milestone-list] .milestone-row');
  check((await page.locator('[data-testid=milestone-list] .milestone-row').count()) > 0, `Línea de tiempo con ${await page.locator('[data-testid=milestone-list] .milestone-row').count()} hitos`);
  if (browserName === 'chromium') {
    await page.click('.tabs button:has-text("Fotos")');
    const before = await page.locator('.photo').count();
    await page.click('[data-testid=ghost-open]');
    await page.waitForSelector('[data-testid=ghost-silhouette]');
    check(true, 'Primera foto: se muestra la silueta de guía');
    await page.click('.ghost-cam .seg button:has-text("Ya")');
    await page.waitForFunction(() => document.querySelector('.ghost-cam video')?.videoWidth > 0, null, { timeout: 10000 });
    await page.click('[data-testid=ghost-shutter]');
    await page.click('[data-testid=ghost-save]');
    await page.waitForFunction((n) => document.querySelectorAll('.photo').length > n, before, { timeout: 10000 });
    check(true, 'Foto tomada con la cámara y guardada cifrada');
    await page.click('[data-testid=ghost-open]');
    await page.waitForSelector('[data-testid=ghost-overlay]');
    check(true, 'Siguiente foto: tu foto anterior aparece como guía');
    await page.screenshot({ path: path.join(shots, `web-ipad-camara-${browserName}.png`) });
    await page.click('[aria-label="Cerrar cámara"]');
  }
  await page.click('[data-testid=nav-dashboard]');

  console.log('▶ Hipertrofia: mesociclo, retroalimentación y RIR');
  await page.click('[data-testid=nav-entrenamiento]');
  await page.click('.tabs button:has-text("Mesociclo")');
  await page.click('.seg button:has-text("Esta semana")');
  await page.click('[data-testid=meso-start]');
  await page.waitForSelector('[data-testid=meso-volume]');
  await page.screenshot({ path: path.join(shots, `web-ipad-mesociclo-${browserName}.png`), fullPage: true });
  check((await page.textContent('[data-testid=meso-weeks]')).includes('Descarga'), 'Mesociclo iniciado con semanas de RIR progresivo y descarga');
  await page.click('.tabs button:has-text("Sesión de hoy")');
  check((await page.textContent('.page')).includes('Mesociclo · semana 1'), 'La sesión muestra la semana y el RIR del mesociclo');
  await page.click('[data-testid=session-start]');
  await page.waitForSelector('[data-testid=ex-0]');
  let fbShown = false;
  for (let ei = 0; ei < 8 && !fbShown; ei++) {
    const n = await page.locator(`[data-testid^="done-${ei}-"]`).count();
    if (!n) break;
    for (let si = 0; si < n; si++) {
      await page.fill(`[data-testid=w-${ei}-${si}]`, '20');
      await page.fill(`[data-testid=r-${ei}-${si}]`, '10');
      await page.click(`[data-testid=done-${ei}-${si}]`);
    }
    fbShown = (await page.locator('.fb-card').count()) > 0;
  }
  check(fbShown, 'Al terminar un músculo aparece la calificación (bombeo, dolor, articulaciones)');
  if (fbShown) {
    const card = page.locator('.fb-card').first();
    await card.locator('button:has-text("Poco")').click();
    await card.locator('button:has-text("Nada")').first().click();
    await page.waitForSelector('.fb-card.done');
    check(true, 'Calificación del músculo guardada');
  }
  await page.screenshot({ path: path.join(shots, `web-ipad-hipertrofia-${browserName}.png`) });
  await page.click('button:has-text("Descartar")');
  await page.click('.tabs button:has-text("Mesociclo")');
  await page.click('[data-testid=rir-test-open]');
  await page.fill('.modal input[type=number]', '25');
  await page.click('.modal button:has-text("Listo")');
  await page.fill('[data-testid=rir-at-guess]', '10');
  await page.click('.modal button:has-text("Siguiente")');
  await page.fill('[data-testid=rir-total]', '15');
  await page.click('[data-testid=rir-save]');
  await page.waitForSelector('[data-testid=rir-bias]');
  check((await page.textContent('[data-testid=rir-bias]')).includes('lejos del fallo'), 'Calibración de RIR: detecta que te quedas lejos del fallo');
  await page.click('.tabs button:has-text("Por músculo")');
  await page.waitForSelector('text=Fuerza por músculo');
  check(true, 'Panel de progreso por músculo visible');
  await page.click('[data-testid=nav-dashboard]');

  console.log('▶ Modo sin entrenamiento');
  const kcalBefore = Number((await page.locator('[data-testid=dash-kcal]').locator('..').textContent()).split('/')[1]?.replace(/\D/g, '') || 0);
  await page.click('[data-testid=nav-entrenamiento]');
  await page.click('[data-testid=no-training-open]');
  await page.waitForSelector('[data-testid=no-training-preview]');
  await page.click('[data-testid=no-training-confirm]');
  await page.waitForSelector('[data-testid=no-training-banner]');
  check((await page.textContent('.page')).includes('está en pausa'), 'Rutina en pausa en modo sin entrenamiento');
  await page.click('[data-testid=nav-dashboard]');
  await page.waitForSelector('[data-testid=no-training-banner]');
  const kcalAfter = Number((await page.locator('[data-testid=dash-kcal]').locator('..').textContent()).split('/')[1]?.replace(/\D/g, '') || 0);
  check(kcalAfter > 0 && kcalAfter < kcalBefore, `Calorías del día bajan sin entrenar (${kcalBefore} → ${kcalAfter})`);
  await page.click('[data-testid=no-training-off]');
  await page.waitForFunction(() => !document.querySelector('[data-testid=no-training-banner]'));
  check(true, 'Volver a entrenar reactiva la rutina');

  console.log('▶ Persistencia al recargar');
  await page.reload();
  await page.waitForSelector('[data-testid=dash-kcal]', { timeout: 20000 });
  check((await page.textContent('[data-testid=dash-kcal]')).replace(/\D/g, '') === '404', 'Los datos persisten tras recargar (IndexedDB)');

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
  check((await page.textContent('[data-testid=dash-kcal]')).replace(/\D/g, '') === '404', 'Respaldo restaurado correctamente');

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
