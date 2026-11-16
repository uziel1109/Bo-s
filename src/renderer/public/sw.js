// Service worker de BODY OS (versión web): permite abrir la app sin conexión.
// Estrategia:
// - Página (navegación): primero la red (con tiempo límite); si no hay conexión, la copia guardada.
//   Así, después de una actualización nunca se sirve una página vieja que apunte a archivos que ya no existen.
// - Archivos con huella en /assets/ (nunca cambian de contenido): primero la caché.
// - Lo demás (iconos, manifiesto, wasm…): caché y actualización en segundo plano.
// Solo guarda archivos de la propia app; tus datos viven en IndexedDB, no aquí.
const CACHE = 'bodyos-app-v2';
const NAV_TIMEOUT_MS = 4000;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest', './icons/apple-touch-icon.png'])));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return; // APIs externas: siempre en red

  if (req.mode === 'navigate') {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        try {
          const res = await Promise.race([fetch(req, { cache: 'no-cache' }), timeout(NAV_TIMEOUT_MS)]);
          if (res.ok) cache.put('./index.html', res.clone());
          return res;
        } catch {
          return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
        }
      }),
    );
    return;
  }

  if (url.pathname.includes('/assets/')) {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
