const CACHE_PREFIX = 'jlpt-wordbook-app-' + encodeURIComponent(new URL(self.registration.scope).pathname) + '-';
const CACHE_NAME = CACHE_PREFIX + '5bd347d122970d9d';
const PRECACHE_FILES = ["index.html","src/app.js","src/review.js","src/storage.js","src/style.css","data/cards.json","data/NOTICE.md","data/LICENSE","manifest.webmanifest","icon.svg","icon-192.png","icon-512.png"];
const assetUrls = PRECACHE_FILES.map(path => new URL(path, self.registration.scope).href);
const home = new URL('index.html', self.registration.scope).href;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(assetUrls)));
  // Let the old version finish its session before activating a new vocabulary bundle.
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  const isHome = event.request.mode === 'navigate' && (url.pathname === new URL(self.registration.scope).pathname || url.pathname === new URL(home).pathname);
  if (!isHome && !assetUrls.includes(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Keep a complete app version together, including its Korean vocabulary.
    const cached = await cache.match(isHome ? home : event.request);
    return cached ?? fetch(event.request);
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type !== 'CHECK_OFFLINE') return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const stored = await Promise.all(assetUrls.map(url => cache.match(url)));
    event.ports[0]?.postMessage({ type: 'OFFLINE_STATUS', ready: stored.every(Boolean) });
  })());
});
