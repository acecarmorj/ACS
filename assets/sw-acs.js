const CACHE_NAME = 'acs-campo-v7';
const ASSETS = [
  './',
  './index.html',
  './index_alternativo.html',
  './painel.html',
  './painel_alternativo.html',
  './cartao.html',
  './cartao_alternativo.html',
  './assets/ace-theme.css?v=20260403e',
  './assets/ace-theme-alt.css?v=20260403e',
  './assets/runtime-config.js?v=20260403e',
  './assets/carmo-territorios-data.js?v=20260403e',
  './assets/index-core.js?v=20260403e',
  './assets/index-render.js?v=20260403e',
  './assets/index-actions.js?v=20260403e',
  './assets/painel-app.js?v=20260403e',
  './assets/cartao-app.js?v=20260402b'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).catch(() => Promise.resolve())
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return;
  }

  const acceptsHtml = (event.request.headers.get('accept') || '').includes('text/html');
  const isNavigation = event.request.mode === 'navigate' || acceptsHtml;

  if (isNavigation) {
    event.respondWith(
      fetch(event.request).then(networkResponse => {
        const cloned = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned)).catch(() => Promise.resolve());
        return networkResponse;
      }).catch(() => caches.match(event.request).then(cacheResponse => cacheResponse || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cacheResponse => {
      if (cacheResponse) {
        return cacheResponse;
      }
      return fetch(event.request).then(networkResponse => {
        const cloned = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned)).catch(() => Promise.resolve());
        return networkResponse;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
