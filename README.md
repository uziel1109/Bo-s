# BODY OS

Sistema de escritorio para la transformación corporal: pérdida de grasa sostenible con preservación y ganancia de masa muscular. Funciona **sin conexión**, guarda todo **en tu equipo** y explica cada recomendación indicando si es un **dato**, una **estimación**, una **hipótesis** o una **recomendación**.

> BODY OS es una herramienta de apoyo. No sustituye la valoración de un médico, nutriólogo o entrenador certificado.

## Qué incluye (versión 1.0)

| Módulo | Funciones |
| --- | --- |
| **Configuración inicial** | Asistente de 6 pasos: datos personales, medidas, entrenamiento, nutrición, salud y elección del escenario. Detecta situaciones que requieren valoración médica (presión arterial, cardiopatía, diabetes con fármacos hipoglucemiantes, enfermedad renal, embarazo, TCA, etc.). |
| **Motor de composición** | IMC, TMB (Mifflin-St Jeor / Katch-McArdle), GET, % de grasa (medición → US Navy → RFM → CUN-BAE) con error típico, masa grasa y magra, peso objetivo al % meta, **gasto observado** a partir de tus registros. |
| **Simulador** | Escenarios conservador / moderado / agresivo con modelo **no lineal** (partición de Forbes, recálculo semanal del gasto, adaptación metabólica), tiempo estimado, grasa perdida y rango de músculo ganable; además, **fecha estimada a tu ritmo real** (con tus pesajes de las últimas semanas). |
| **Nutrición** | Calorías, proteína, carbohidratos, grasas y fibra; distribución por comida; registro diario con buscador, cantidades en gramos o unidades, comidas frecuentes, recetas, copiar del día anterior; base de 110 alimentos (incluye tostadas, tortilla de harina, chorizo, salsas, quesos mexicanos, tamal, pan dulce, refresco, cerveza…) **verificados contra USDA FoodData Central SR Legacy** (cada uno con su FDC ID) y editables; alimentos personalizados con validación; **generador de planes de 7 días** con alimentos mexicanos y **sustituciones equivalentes**; **lista del súper** generada del plan (convierte lo cocido a peso crudo/seco, agrupa por pasillo, se marca como lista de compras y se comparte); código de barras (Open Food Facts, opcional y en línea); **foto del plato con IA** (opcional): identifica el platillo y sus elementos, calcula los macros con los alimentos verificados, lo compara con el plan y lo agrega o reemplaza en el registro; **24 recetas mexicanas fit** con macros por porción, que se pueden poner en el plan con porciones ajustadas; **preparación del domingo** (qué cocinar en lote, cuánto en crudo, en qué orden y cómo repartir en recipientes, con avisos de conservación); **fases y eventos**: fase de mantenimiento al llegar a la meta, descansos de dieta, días de recarga en días de pierna y eventos sociales con ahorro previo de calorías; **calificación de saciedad** por comida y análisis de qué te llena más. |
| **Entrenamiento** | Generador de rutinas (Full Body, Upper/Lower, PPL, UL+PPL; 2–6 días) según equipo, tiempo, experiencia, prioridades y lesiones; 58 ejercicios con **animación original del movimiento**, instrucciones, técnica, errores, alternativas y diagrama muscular; registro de sesiones (peso, reps, RIR, molestias, descanso con temporizador); **doble progresión** por RIR; **series de calentamiento** sugeridas y **calculadora de discos**; **modo gimnasio** a pantalla completa (botones grandes, pantalla siempre encendida, aviso sonoro al terminar el descanso); **"hoy entreno en otro lado"** (hotel, casa, peso corporal, parque o equipo a elegir: cambia cada ejercicio por su equivalente); **movilidad guiada** de 5–8 minutos según la sesión, con figuras animadas; detección de estancamiento y **semanas de descarga**; estadísticas por músculo (series efectivas, frecuencia, recuperación estimada). |
| **Cardio y actividad** | Meta de pasos progresiva, plan semanal (LISS y, solo si es seguro, intervalos), zonas de FC (Tanaka), registro de sesiones. El gasto de relojes/máquinas **nunca** se suma a tus calorías. |
| **Suplementación** | Creatina, proteína, vitamina D, omega 3, magnesio, cafeína, electrolitos, beta-alanina: beneficio, evidencia, dosis estudiada, efectos, contraindicaciones e interacciones; clasificación personalizada (útil / opcional / no necesario / requiere valoración); lista de productos no recomendados; registro de lo que tomas. |
| **Hidratación** | Objetivo orientativo (EFSA + ejercicio + calor), respeta restricciones médicas, registro por vaso/botella/cantidad, distribución horaria, criterio de electrolitos. |
| **Progreso** | Gráficas de peso con tendencia, % de grasa estimado, 8 perímetros, proteína y calorías; fotos de progreso **cifradas** con condiciones de toma; comparación lado a lado; **resumen mensual** visual que se guarda como imagen; estadísticas y rachas; recuperación (sueño, energía, dolor, estrés). |
| **Inteligencia** | Asistente local que responde 9 preguntas clave con tus datos; **revisión semanal** de 10 apartados; **motor de adaptación** que propone cambios justificados (calorías, pasos, volumen, descarga) y **solo los aplica con tu confirmación**; integración opcional con Claude (Anthropic) con clave cifrada y vista previa de los datos enviados. |
| **Retos semanales** | Cada lunes, 3 retos alcanzables según tus puntos débiles de la semana anterior (proteína, registro, pasos, pesajes, entrenos…), con avance diario y racha de semanas cumplidas. |
| **Calendario** | Tareas diarias generadas a partir de tu plan (entrenos, comidas, suplementos, mediciones, revisión semanal), que se marcan solas al registrar; tareas personales; **exportación de recordatorios al calendario del iPad/computadora** (.ics con alarmas). |
| **Configuración** | Edición del perfil, tema oscuro/claro/sistema, respaldos cifrados con contraseña, restauración, exportación JSON/CSV, importación CSV/JSON, eliminación total de datos, privacidad y fuentes científicas. |

## Instalación

### En iPad (versión web instalable)

1. Abre **https://uziel1109.github.io/Bo-s/** en **Safari**.
2. Toca **Compartir** (□↑) → **Agregar a pantalla de inicio** → **Agregar**.
3. Abre BODY OS desde su ícono: se ejecuta a pantalla completa y funciona sin conexión.

- Tus datos se guardan **solo en el iPad** (IndexedDB del navegador); la página únicamente descarga el programa.
- Instalarla en la pantalla de inicio evita que Safari borre los datos por inactividad. Aun así, crea **respaldos** con regularidad (Configuración → Datos y respaldos) y guárdalos en Archivos o iCloud Drive.
- Para pasar tus datos de la computadora al iPad (o al revés): crea un respaldo en uno y, en el otro, usa **Restaurar un respaldo** (también disponible en el primer paso del asistente).
- Diferencias con el escritorio: la clave de la IA externa se guarda en el navegador (no hay llavero del sistema) y las fotos se eligen desde la fototeca o Archivos.

### En computadora — Opción A: instalador (recomendado)

Cada `push` al repositorio ejecuta el flujo **Pruebas e instaladores** en GitHub Actions, que genera:

- **Windows**: `BODY OS Setup 1.0.0.exe` (instalador) y `BODY OS 1.0.0.exe` (portable)
- **macOS**: `BODY OS-1.0.0.dmg` (sin firma: la primera vez ábrelo con clic derecho → Abrir)
- **Linux**: `BODY OS-1.0.0.AppImage` y `.deb`

Descárgalos desde la pestaña **Actions** → ejecución más reciente → **Artifacts**.

### En computadora — Opción B: desde el código fuente

Requisitos: [Node.js 20 o 22](https://nodejs.org/) y Git.

```bash
git clone <url-del-repositorio> body-os
cd body-os
npm install
npm run dev          # abre la app en modo desarrollo
```

Generar tu propio instalador en tu sistema operativo:

```bash
npm run dist:win     # en Windows → dist/*.exe
npm run dist:mac     # en macOS   → dist/*.dmg
npm run dist:linux   # en Linux   → dist/*.AppImage y *.deb
npm run build:web    # versión web/iPad → dist-web/ (sitio estático)
```

## Pruebas

```bash
npm test             # 65 pruebas unitarias (cálculos, base de datos, cifrado, adaptación)
npm run typecheck    # verificación de tipos
npm run test:e2e     # prueba de extremo a extremo con la app Electron real
                     # (en Linux sin pantalla: xvfb-run -a npm run test:e2e)
npm run test:web     # versión web emulando un iPad (BROWSER=webkit para el motor de Safari)
```

La prueba E2E recorre: configuración inicial → registro de peso → registro de comida (verifica que 200 g de pechuga = 330 kcal en el panel) → plan de comidas → sesión de entrenamiento → hidratación → todas las secciones → modo claro → **reinicio de la app y verificación de que todo persiste**.

La prueba web (iPad, horizontal y vertical) verifica además: persistencia al recargar, respaldo descargado → eliminar todo → restaurar desde el asistente, apertura **sin conexión** y ausencia de desplazamiento horizontal.

## Datos y privacidad

- Base de datos SQLite local en la carpeta de datos de la aplicación (Configuración → Datos y respaldos → *Abrir carpeta*).
  - Windows: `%APPDATA%\BODY OS\data` · macOS: `~/Library/Application Support/BODY OS/data` · Linux: `~/.config/BODY OS/data`
- Fotos cifradas con AES-256-GCM; la clave se protege con el llavero del sistema.
- Sin telemetría. Solo dos funciones opcionales usan internet: código de barras (envía solo el número) e IA externa (si la activas y configuras tu propia clave).

## Documentación

- [Manual de usuario](docs/MANUAL.md)
- [Arquitectura y decisiones técnicas](docs/ARQUITECTURA.md)
- Fuentes científicas: dentro de la app, Configuración → Fuentes científicas (`src/shared/references.ts`).
