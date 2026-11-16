// Prueba de extremo a extremo: lanza la aplicación Electron real y recorre los flujos principales.
// Uso: npm run test:e2e   (en Linux sin pantalla: xvfb-run -a npm run test:e2e)
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { _electron: electron } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bodyos-e2e-'));
const shots = path.join(root, 'e2e', 'screens');
fs.mkdirSync(shots, { recursive: true });
const electronPath = require('electron');

let failures = 0;
let current = null;
const check = (cond, msg) => {
  if (cond) console.log(`  ✔ ${msg}`);
  else {
    failures++;
    console.error(`  ✘ ${msg}`);
  }
};

async function launch() {
  const app = await electron.launch({ executablePath: electronPath, args: [path.join(root, 'out/main/index.js'), '--no-sandbox'], env: { ...process.env, BODYOS_USER_DATA: userData } });
  const win = await app.firstWindow();
  const errors = [];
  win.on('pageerror', (e) => errors.push(e.message));
  win.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  win.on('dialog', (d) => d.accept(d.type() === 'prompt' ? 'Mi desayuno' : undefined));
  await win.setViewportSize({ width: 1440, height: 900 });
  current = win;
  return { app, win, errors };
}

const shot = (win, name) => win.screenshot({ path: path.join(shots, `${name}.png`) });

async function main() {
  console.log('▶ Primer arranque: asistente de configuración');
  let { app, win, errors } = await launch();
  await win.waitForSelector('text=Configuración inicial', { timeout: 20000 });
  await win.fill('[data-testid=pf-name]', 'Prueba');
  await win.fill('[data-testid=pf-age]', '31');
  await win.fill('[data-testid=pf-height]', '176');
  await win.fill('[data-testid=pf-weight]', '92');
  await shot(win, '01-onboarding');
  await win.click('[data-testid=onb-next]');
  await win.fill('[data-testid=pf-waist]', '99');
  await win.fill('[data-testid=pf-neck]', '39');
  for (let i = 0; i < 4; i++) await win.click('[data-testid=onb-next]');
  await win.waitForSelector('text=Elige tu escenario');
  await shot(win, '02-onboarding-plan');
  await win.click('[data-testid=scenario-moderado]');
  await win.click('[data-testid=onb-finish]');
  await win.waitForSelector('[data-testid=dash-weight]', { timeout: 15000 });
  check((await win.textContent('[data-testid=dash-weight]')).includes('92'), 'Dashboard muestra el peso del perfil');
  const bfText = await win.textContent('[data-testid=dash-bf]');
  check(/estimado/.test(bfText), 'El % de grasa se etiqueta como estimado');
  await shot(win, '03-dashboard');

  console.log('▶ Registro de peso');
  await win.click('[data-testid=dash-log-weight]');
  await win.fill('[data-testid=bodylog-weight]', '91.4');
  await win.click('[data-testid=bodylog-save]');
  await win.waitForTimeout(500);
  check((await win.textContent('[data-testid=dash-weight]')).includes('91,4') || (await win.textContent('[data-testid=dash-weight]')).includes('91.4'), 'El peso registrado se refleja en el dashboard');

  console.log('▶ Registro de comida y actualización de macros');
  await win.click('[data-testid=nav-nutricion]');
  await win.click('[data-testid=add-food-desayuno]');
  await win.fill('[data-testid=food-search]', 'pechuga de pollo sin piel, asada');
  await win.click('[data-testid=food-option-pollo_pechuga_cocida]');
  await win.fill('[data-testid=food-grams]', '200');
  await win.click('[data-testid=food-add-confirm]');
  await win.keyboard.press('Escape');
  await win.waitForTimeout(400);
  await shot(win, '04-nutricion');
  await win.click('[data-testid=nav-dashboard]');
  const kcal = (await win.textContent('[data-testid=dash-kcal]')).replace(/\D/g, '');
  check(kcal === '330', `Calorías del día = 330 (200 g × 165 kcal/100 g); obtenido ${kcal}`);

  console.log('▶ Plan de comidas');
  await win.click('[data-testid=nav-nutricion]');
  await win.click('.tabs button:has-text("Plan y súper")');
  await win.click('.tabs.sub button:has-text("Plan de comidas")');
  await win.click('[data-testid=gen-mealplan]');
  await win.waitForSelector('text=Día 1: totales vs objetivo');
  await shot(win, '05-plan-comidas');
  check(true, 'Plan de comidas generado');

  console.log('▶ Sesión de entrenamiento');
  await win.click('[data-testid=nav-entrenamiento]');
  await win.click('[data-testid=session-start]');
  await win.waitForSelector('[data-testid=ex-0]');
  await win.fill('[data-testid=w-0-0]', '60');
  await win.fill('[data-testid=r-0-0]', '10');
  await win.click('[data-testid=done-0-0]');
  await win.fill('[data-testid=w-0-1]', '60');
  await win.fill('[data-testid=r-0-1]', '9');
  await win.click('[data-testid=done-0-1]');
  await shot(win, '06-sesion');
  await win.click('[data-testid=session-finish]');
  await win.waitForSelector('text=Ya completaste hoy');
  check(true, 'Sesión guardada como completada');

  console.log('▶ Hidratación, cardio, suplementos, progreso, IA, calendario, configuración');
  await win.click('[data-testid=nav-hidratacion]');
  await win.click('[data-testid=water-500]');
  await win.waitForTimeout(300);
  check((await win.textContent('[data-testid=water-total]')).replace(/\D/g, '') === '500', 'Agua registrada: 500 ml');
  for (const p of ['cuerpo', 'cardio', 'suplementos', 'progreso', 'ia', 'calendario', 'config']) {
    await win.click(`[data-testid=nav-${p}]`);
    await win.waitForTimeout(350);
    await shot(win, `07-${p}`);
  }
  await win.click('[data-testid=nav-cuerpo]');
  await win.click('.tabs button:has-text("Simulador")');
  await win.waitForTimeout(300);
  await shot(win, '08-simulador');
  await win.click('[data-testid=nav-ia]');
  await win.click('.tabs button:has-text("Asistente")');
  await win.click('[data-testid=q-falta]');
  await win.waitForTimeout(200);
  await shot(win, '09-asistente');
  check(await win.isVisible('text=Grasa a perder'), 'El asistente responde con datos del usuario');
  // Tema claro
  await win.click('[data-testid=nav-config]');
  await win.click('.tabs button:has-text("Apariencia")');
  await win.click('.seg button:has-text("Claro")');
  await win.waitForTimeout(300);
  await win.click('[data-testid=nav-dashboard]');
  await win.waitForTimeout(300);
  await shot(win, '10-dashboard-claro');
  check((await win.evaluate(() => document.documentElement.dataset.theme)) === 'light', 'Modo claro aplicado');
  check(errors.length === 0, `Sin errores de consola (${errors.slice(0, 3).join(' | ')})`);
  await app.close();

  console.log('▶ Reinicio: persistencia de datos');
  ({ app, win, errors } = await launch());
  await win.waitForSelector('[data-testid=dash-weight]', { timeout: 20000 });
  check((await win.textContent('[data-testid=dash-weight]')).match(/91[.,]4/) != null, 'El peso persiste tras reiniciar');
  check((await win.textContent('[data-testid=dash-kcal]')).replace(/\D/g, '') === '330', 'Las comidas persisten tras reiniciar');
  check((await win.evaluate(() => document.documentElement.dataset.theme)) === 'light', 'La preferencia de tema persiste');
  await win.click('[data-testid=nav-entrenamiento]');
  await win.click('.tabs button:has-text("Historial")');
  await win.waitForTimeout(300);
  check((await win.locator('table.table tbody tr').count()) >= 1, 'La sesión de entrenamiento persiste');
  await app.close();

  fs.rmSync(userData, { recursive: true, force: true });
  console.log(failures ? `\n✘ ${failures} verificaciones fallaron` : '\n✔ Todas las verificaciones E2E pasaron');
  process.exit(failures ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  if (current) await current.screenshot({ path: path.join(shots, 'zz-failure.png') }).catch(() => {});
  process.exit(1);
});
