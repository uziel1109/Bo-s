# Arquitectura de BODY OS

## Tecnologías y por qué

| Elección | Motivo |
| --- | --- |
| **Electron 33** | Aplicación de escritorio multiplataforma (Windows, macOS, Linux) con un solo código; instaladores con `electron-builder`. |
| **React 18 + TypeScript** | Interfaz modular y tipada; los tipos del dominio se comparten con el proceso principal y las pruebas. |
| **SQLite vía sql.js (WebAssembly)** | Base de datos relacional real, **sin módulos nativos** que compilar por plataforma; se persiste en un archivo con escritura atómica. |
| **electron-vite + Vite** | Compilación rápida de los tres contextos (principal, preload, interfaz). |
| **Recharts** | Gráficas declarativas con tooltip. |
| **Vitest + Playwright (_electron)** | Pruebas unitarias del motor y prueba E2E sobre la app real. |
| **@anthropic-ai/sdk** | Integración opcional con Claude, ejecutada solo en el proceso principal. |

## Separación de capas

```
src/
├── shared/            ← LÓGICA DE NEGOCIO PURA (sin Electron, sin React; 100 % probada)
│   ├── types.ts             tipos del dominio
│   ├── schema.ts            esquema de la base de datos (lista blanca de tablas/columnas)
│   ├── engine.ts            computeState(): combina perfil + registros → estado actual
│   ├── body/                composición corporal y simulador no lineal
│   ├── nutrition/           objetivos, alimentos, generador de dietas, sustituciones
│   ├── training/            ejercicios, generador de rutinas, progresión y descarga
│   ├── cardio/              pasos, plan de cardio, zonas de FC, MET
│   ├── hydration/           objetivo orientativo y electrolitos
│   ├── supplements/         evaluación basada en evidencia
│   ├── safety/              cribado de condiciones de salud
│   ├── analytics/           tendencia, gasto observado, adaptación, informe semanal
│   ├── assistant/           asistente local y resumen para la IA externa
│   ├── calendar.ts          tareas diarias
│   └── references.ts        bibliografía y limitaciones
├── main/              ← PROCESO PRINCIPAL (acceso a disco, red, cifrado)
│   ├── index.ts             ventana, IPC, fotos, respaldos, exportación, código de barras
│   ├── db.ts                LocalDB persistida en archivo (guardado atómico)
│   ├── secure.ts            cifrado de fotos y respaldos (AES-256-GCM, scrypt)
│   └── ai.ts                IA opcional (clave cifrada con safeStorage)
├── preload/           ← puente seguro (contextIsolation, sin nodeIntegration)
└── renderer/          ← INTERFAZ (React)
    └── src/
        ├── store.tsx        carga los datos y calcula el estado con shared/engine
        ├── api.ts           llamadas tipadas al proceso principal
        ├── components/      UI base, gráficas, diagrama muscular, formularios de perfil
        └── pages/           Dashboard, Mi cuerpo, Nutrición, Entrenamiento, Cardio,
                             Suplementación, Hidratación, Progreso, IA, Calendario, Configuración
tests/                 ← pruebas unitarias (Vitest)
e2e/                   ← prueba E2E de la app real (Playwright + Electron)
```

**Flujo de datos:** la interfaz pide filas al proceso principal (`db:list`, `db:upsert`…), que valida tabla y columnas contra `shared/schema.ts`. El estado derivado (composición, objetivos, proyecciones, recomendaciones) se calcula con funciones puras de `shared/`, por lo que es reproducible y comprobable.

## Versión web (iPad)

Electron no existe en iPadOS, así que la misma interfaz se compila también como **PWA** (`vite.web.config.ts` → `dist-web/`, publicada en GitHub Pages por `.github/workflows/pages.yml`).

- `src/renderer/src/web/bridge.ts` implementa en el navegador **los mismos canales** que el proceso principal (`db:*`, `photos:*`, `backup:*`, `export:*`, `import:*`, `ai:*`…), de modo que las páginas no cambian. `main.tsx` lo instala si no existe el puente de Electron.
- La base de datos es la misma clase `LocalDB` (`src/shared/db/localdb.ts`) con sql.js; en web se persiste en **IndexedDB** en lugar de un archivo.
- Fotos cifradas con **Web Crypto** (AES-GCM, clave no exportable en IndexedDB).
- Respaldos con el códec común `src/shared/backupCodec.ts` (gzip + PBKDF2-SHA256 + AES-256-GCM): un respaldo hecho en la computadora se restaura en el iPad y viceversa. El escritorio sigue leyendo el formato antiguo (scrypt).
- Importación/exportación compartida en `src/shared/dataIO.ts`; la exportación CSV se entrega como ZIP.
- `public/sw.js` guarda en caché los archivos de la app para abrirla sin conexión; los datos nunca pasan por el service worker.
- La CSP de la web solo permite conexiones a Open Food Facts y a la API de Anthropic (ambas opcionales).

## Base de datos

Tablas: `settings`, `profile`, `body_logs`, `foods`, `recipes`, `favorites`, `food_logs`, `nutrition_plans` (versiones del plan principal), `meal_plans`, `adjustments` (propuestas y decisiones), `routines`, `workout_sessions`, `cardio_logs`, `steps_logs`, `water_logs`, `recovery_logs`, `supplement_stack`, `supplement_logs`, `photos`, `calendar_tasks`, `weekly_reports`.

- Migraciones automáticas: tablas y columnas nuevas se agregan al abrir.
- Guardado diferido (250 ms) y al cerrar, mediante archivo temporal + `rename` (sin corrupción por cierres inesperados).
- La base inicial de alimentos se carga solo la primera vez y nunca sobrescribe ediciones.

## Seguridad y privacidad

- `contextIsolation: true`, `nodeIntegration: false`, CSP restrictiva, navegación externa bloqueada.
- Lista blanca de tablas y columnas; consultas parametrizadas.
- Fotos cifradas en reposo; se sirven a la interfaz por el protocolo interno `bodyos-photo://`.
- Respaldos `.bodyos`: base de datos + fotos, comprimidos y cifrados con contraseña (scrypt N=2^15 → AES-256-GCM).
- Clave de IA cifrada con el llavero del sistema (`safeStorage`); si no está disponible, la app se niega a guardarla.

## Decisiones científicas clave

- **% de grasa:** se usa la mejor fuente disponible y se muestra siempre su error típico. Solo las mediciones con equipo se consideran "medidas"; todo lo demás se etiqueta como estimación.
- **Gasto energético:** fórmula inicial (Mifflin-St Jeor × PAL) que se combina progresivamente con el gasto **observado** (ingesta media − Δpeso de tendencia × 7 700 / días), ponderado por la calidad de los datos.
- **Déficit:** objetivo en % del peso por semana (0.5 / 0.75 / 1.0 %), con tope del 20/25/30 % del gasto y mínimo de 1 500 kcal (hombres) / 1 200 kcal (mujeres) sin supervisión.
- **Proteína:** 2 g/kg del peso objetivo (≈2.3–2.6 g/kg de masa libre de grasa).
- **Adaptación:** no se proponen cambios de calorías antes de 3 semanas, con < 70 % de días registrados, si la ingesta supera el objetivo, o si la cintura indica recomposición. Cada propuesta requiere confirmación.
- **Progresión:** doble progresión con RIR; descarga solo con estancamiento **y** señales de fatiga.

## Integraciones externas (opcionales)

| Función | Servicio | Qué se envía | Sin conexión |
| --- | --- | --- | --- |
| Código de barras | Open Food Facts | Solo el número del código | Búsqueda en la base local; alta manual desde la etiqueta |
| Preguntas libres | Claude (Anthropic) | Pregunta + resumen numérico visible en la app | Asistente local con 9 preguntas clave |
| Foto de comida | Claude (Anthropic) | La foto elegida | Registro manual |

## Animaciones de ejercicios

`src/renderer/src/components/ExerciseAnimation.tsx` dibuja figuras originales en SVG con cinemática directa: cada patrón de movimiento (sentadilla, bisagra, press, remo, jalón, curl…) define dos posturas por ángulos articulares y un punto de anclaje (pies, cadera, hombros o manos), y la animación interpola entre ellas. No se usan imágenes de terceros: las bases de imágenes "libres" disponibles no documentan el origen de sus fotografías, así que se descartaron para no arriesgar derechos de autor. Respeta la preferencia del sistema de reducir movimiento. `#anim-debug` muestra todas las posturas para revisión.

## Ampliaciones previstas

- Escaneo de código de barras con cámara (requiere una librería de decodificación; hoy se admite teclado y lectores USB).
- Base de datos SMAE completa con licencia verificada.
- Sincronización cifrada opcional entre dispositivos.
