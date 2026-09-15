const CACHE = 'nocontext-v1';
const BASE = '/NoContext-website/';
const CORE = [BASE, `${BASE}index.html`, `${BASE}404.html`, `${BASE}assets/css/style.css`, `${BASE}assets/css/mobile.css`, `${BASE}assets/js/main.js`, `${BASE}assets/js/pwa.js`, `${BASE}manifest.webmanifest`];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
    event.respondWith(caches.match(event.request).then(cached => {
        const network = fetch(event.request).then(response => {
            if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
            return response;
        }).catch(() => cached || caches.match(`${BASE}404.html`));
        return cached || network;
    }));
});
