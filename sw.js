/**
 * Service Worker: Digital Keys to Soil Taxonomy
 *
 * Caching strategies:
 * - STATIC (HTML, JS, manifest): Cache-first, update in background
 * - DYNAMIC (taxonomy JSON): Network-first, cache fallback
 * - OTHER: Network-first with cache fallback
 *
 * Update CACHE_VERSION when static files change.
 */

const CACHE_VERSION = 'v10-2026-03';
const STATIC_CACHE = 'static-' + CACHE_VERSION;
const DYNAMIC_CACHE = 'dynamic-' + CACHE_VERSION;

// Resolve relative to SW location so it works at any deploy path
// (e.g. username.github.io/DST/ or localhost:8000/)
const BASE = new URL('./', self.location).href;

const STATIC_PATHS = [
    '',
    'index.html',
    'manifest.json',
    'style.css',
    'scripts/dst-core.js',
];

const DYNAMIC_PATHS = [
    'data/dst-data.json',
];

const STATIC_URLS = STATIC_PATHS.map(function(p) { return new URL(p, BASE).href; });
const DYNAMIC_URLS = DYNAMIC_PATHS.map(function(p) { return new URL(p, BASE).href; });

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => cache.addAll(STATIC_URLS))
            .then(() => self.skipWaiting())
            .catch(error => console.error('Cache install failed:', error))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(cacheNames => Promise.all(
                cacheNames
                    .filter(name => {
                        const isStatic = name.startsWith('static-') && name !== STATIC_CACHE;
                        const isDynamic = name.startsWith('dynamic-') && name !== DYNAMIC_CACHE;
                        return isStatic || isDynamic;
                    })
                    .map(name => caches.delete(name))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const request = event.request;

    if (request.method !== 'GET') return;
    // Skip cross-origin requests
    if (!request.url.startsWith(BASE)) return;

    // Static assets: cache-first
    if (STATIC_URLS.includes(request.url)) {
        event.respondWith(
            caches.match(request)
                .then(response => response || fetchAndCache(request, STATIC_CACHE))
                .catch(() => new Response('Resource not found', { status: 404 }))
        );
        return;
    }

    // Dynamic assets: network-first
    if (DYNAMIC_URLS.includes(request.url)) {
        event.respondWith(networkFirst(request, DYNAMIC_CACHE));
        return;
    }

    // Other: network-first
    event.respondWith(networkFirst(request, DYNAMIC_CACHE));
});

function fetchAndCache(request, cacheName) {
    return fetch(request).then(response => {
        if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(cacheName).then(cache => cache.put(request, clone));
        }
        return response;
    });
}

function networkFirst(request, cacheName) {
    return fetch(request)
        .then(response => {
            if (response && response.status === 200) {
                const clone = response.clone();
                caches.open(cacheName).then(cache => cache.put(request, clone));
            }
            return response;
        })
        .catch(() => caches.match(request));
}
