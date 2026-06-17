const CACHE_NAME = 'matrix-v1';
const urlsToCache = [ './index.html' ];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.map(key => { if (key !== CACHE_NAME) return caches.delete(key); })
  )));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
