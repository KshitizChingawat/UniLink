// Only the public offline screen is stored. Workspace data always uses the network.
const cacheName = 'unilink-offline-v1';
const offlinePage = '/offline.html';

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.add(new Request(offlinePage, { cache: 'reload' }))));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('unilink-offline-') && key !== cacheName).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || request.mode !== 'navigate' || url.origin !== self.location.origin || /^\/api(?:\/|$)/.test(url.pathname)) return;
  event.respondWith(fetch(request).catch(async () => {
    const cache = await caches.open(cacheName);
    return (await cache.match(offlinePage)) || Response.error();
  }));
});
