// Offline cache: network-first for pages, cache-first for assets and fonts.
const CACHE = 'last-stand-v1';
const ROOT = self.registration.scope; // works under any base path (e.g. /last-stand/)
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll([ROOT, ROOT + 'manifest.webmanifest', ROOT + 'icon-192.png', ROOT + 'icon-512.png', ROOT + 'icon.svg'])));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;
  const font = url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com');
  if (!sameOrigin && !font) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { caches.open(CACHE).then(c => c.put(ROOT, r.clone())); return r; }).catch(() => caches.match(ROOT)));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok || r.type === 'opaque') { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return r;
  })));
});
