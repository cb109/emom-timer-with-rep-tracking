const CACHE_NAME = 'emom-v3';
const APP_SHELL = './emom_timer.html';
const ASSETS = [
  './',
  APP_SHELL,
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.jsdelivr.net/npm/vue@3.5.31/dist/vue.global.min.js'
];

const APP_SHELL_URL = new URL(APP_SHELL, self.registration.scope).href;

async function precacheAssets() {
  const cache = await caches.open(CACHE_NAME);

  // Keep required app files strict for install.
  await cache.addAll(['./', APP_SHELL, './manifest.json', './icon-192.png', './icon-512.png']);

  // CDN dependency is best-effort to avoid install failures from transient outages.
  try {
    await cache.add('https://cdn.jsdelivr.net/npm/vue@3.5.31/dist/vue.global.min.js');
  } catch (_) {
    // Ignore optional CDN precache failures.
  }
}

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
      const fallback =
        (await cache.match(fallbackUrl)) ||
        (await cache.match(APP_SHELL_URL)) ||
        (await cache.match(APP_SHELL)) ||
        (await cache.match('./'));
      if (fallback) return fallback;
    }
    return new Response('Offline', {
      status: 503,
      statusText: 'Offline',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

self.addEventListener('install', (e) => {
  e.waitUntil(precacheAssets());
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
