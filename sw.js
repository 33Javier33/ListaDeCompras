const CACHE = 'lista-pro-v2';

const LOCAL_ASSETS = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './manifest.json',
    './icon-192x192.png',
    './icon-512x512.png',
];

// Instalar: pre-cachear archivos locales
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(c => c.addAll(LOCAL_ASSETS))
    );
    self.skipWaiting();
});

// Activar: limpiar caches viejos
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch: cache-first para recursos locales, network-first para externos
self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;

    const url = new URL(e.request.url);
    const isLocal = url.origin === self.location.origin;

    if (isLocal) {
        // Cache first → network fallback
        e.respondWith(
            caches.match(e.request).then(cached => {
                if (cached) return cached;
                return fetch(e.request).then(res => {
                    if (res.ok) {
                        caches.open(CACHE).then(c => c.put(e.request, res.clone()));
                    }
                    return res;
                });
            })
        );
    } else {
        // Network first → cache fallback (CDN, fuentes, etc.)
        e.respondWith(
            fetch(e.request)
                .then(res => {
                    if (res.ok) {
                        caches.open(CACHE).then(c => c.put(e.request, res.clone()));
                    }
                    return res;
                })
                .catch(() => caches.match(e.request))
        );
    }
});
