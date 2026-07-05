const CACHE_NAME = 'emom-v2';
const APP_SHELL = './emom_timer.html';
const ASSETS = [
  './',
  APP_SHELL,
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg',
  'https://cdn.jsdelivr.net/npm/vue@3.5.31/dist/vue.global.min.js'
];

async function putInCache(request, response) {
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response);
}

async function networkFirst(request, fallbackUrl) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      await putInCache(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (_) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await cache.match(fallbackUrl);
      if (fallback) return fallback;
    }
    throw _;
  }
}

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      ),
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const requestUrl = new URL(e.request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;

  if (e.request.mode === 'navigate') {
    e.respondWith(networkFirst(e.request, APP_SHELL));
    return;
  }

  if (isSameOrigin || requestUrl.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(networkFirst(e.request));
  }
});
