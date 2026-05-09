const CACHE_NAME = 'rackhouse-static-v2';
const STATIC_ASSETS = [
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon.svg',
  '/icons/maskable-icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  // Do not intercept HTML navigation requests (e.g. "/").
  if (request.mode === 'navigate' || request.destination === 'document') {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  const isStaticAsset =
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/favicon.svg' ||
    url.pathname === '/icons/icon.svg' ||
    url.pathname === '/icons/maskable-icon.svg' ||
    url.pathname.startsWith('/_next/static/');

  if (!isStaticAsset) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic' || response.redirected) {
          return response;
        }

        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone)).catch(() => undefined);

        return response;
      });
    })
  );
});
