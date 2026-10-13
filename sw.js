// Mi Gym — service worker (modo sin conexión)
// ⚠ Cada vez que cambies CUALQUIER archivo de la app, subí este número
//   (por ejemplo v2.0.0 → v2.0.1). Si no, el iPhone puede seguir mostrando la versión vieja.
const VERSION = 'migym-v2.0.0';
const ARCHIVOS = ['./', './index.html', './data.js', './anim.js', './store.js', './app.js', './manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k.startsWith('migym-') && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Responde al instante con lo guardado y, en paralelo, busca la versión nueva
// para la próxima vez que abras la app. Sin señal en el gimnasio, igual abre.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== location.origin) return;

  const red = fetch(req).then(r => {
    if (r && r.ok && r.type === 'basic') {
      const copia = r.clone();
      return caches.open(VERSION).then(c => c.put(req, copia)).then(() => r, () => r);
    }
    return r;
  }).catch(() => null);
  e.waitUntil(red);

  e.respondWith(
    caches.match(req, { ignoreSearch: true })
      .then(c => c || (req.mode === 'navigate' ? caches.match('./index.html') : null))
      .then(c => c || red.then(r => r || new Response('Sin conexión', { status: 504, statusText: 'Offline' })))
  );
});
