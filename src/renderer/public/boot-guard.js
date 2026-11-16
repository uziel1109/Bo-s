// Guardián de arranque: si un archivo de la app no carga (por ejemplo, una versión vieja guardada en caché),
// limpia la caché de la app y recarga una sola vez. Si aún falla, muestra un mensaje con un botón para reparar.
// Nunca toca tus datos (están en IndexedDB, no en la caché).
(function () {
  var KEY = 'bodyos-boot-retry';
  var shown = false;

  function repair() {
    var tasks = [];
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations)
      tasks.push(navigator.serviceWorker.getRegistrations().then(function (rs) { return Promise.all(rs.map(function (r) { return r.unregister(); })); }));
    if (window.caches && caches.keys)
      tasks.push(caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); }));
    return Promise.all(tasks).catch(function () {}).then(function () { location.reload(); });
  }

  function show(reason) {
    if (shown) return;
    shown = true;
    var retried = false;
    try { retried = sessionStorage.getItem(KEY) === '1'; } catch (e) {}
    if (!retried) {
      try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
      repair();
      return;
    }
    var box = document.createElement('div');
    box.setAttribute('style', 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;background:#0a0c0f;color:#eef1f5;font:16px -apple-system,system-ui,sans-serif;z-index:99999;text-align:center');
    box.innerHTML = '<div style="max-width:440px"><div style="font-size:22px;font-weight:700;margin-bottom:10px">BODY OS no pudo cargar</div>' +
      '<div style="color:#93a4b8;margin-bottom:18px">Tus datos están a salvo. Toca el botón para limpiar los archivos guardados de la app y volver a cargarla (necesita internet).</div>' +
      '<button id="bodyos-repair" style="font:inherit;font-weight:700;padding:12px 22px;border:0;border-radius:12px;background:#c8f53c;color:#11140a">Reparar y recargar</button>' +
      '<div style="color:#5b6573;font-size:12px;margin-top:16px;word-break:break-all"></div></div>';
    box.querySelector('div div:last-child').textContent = reason || '';
    document.body.appendChild(box);
    document.getElementById('bodyos-repair').onclick = repair;
  }

  window.addEventListener('error', function (e) {
    var t = e.target;
    if (t && (t.tagName === 'SCRIPT' || t.tagName === 'LINK')) show('No se pudo cargar ' + (t.src || t.href || 'un archivo'));
  }, true);

  window.addEventListener('load', function () {
    setTimeout(function () {
      var root = document.getElementById('root');
      if (root && root.childElementCount === 0) show('La app no terminó de iniciar.');
      else try { sessionStorage.removeItem(KEY); } catch (e) {}
    }, 15000);
  });

  window.__bodyosBootFailed = show;
})();
