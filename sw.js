// ═══════════════════════════════════════════════════════════
// RIVERSIDE CEMETERY — SERVICE WORKER
// Offline Mode © 2025 Irvin Hill
// ═══════════════════════════════════════════════════════════
const CACHE_NAME = 'riverside-cemetery-v1';
const OFFLINE_URL = '/Riverside-cemetery-of-oswego-inc/';

// Files to cache on install
const STATIC_ASSETS = [
  '/Riverside-cemetery-of-oswego-inc/',
  '/Riverside-cemetery-of-oswego-inc/index.html',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
];

// Install — cache all static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.log('SW: Some assets failed to cache', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — serve from cache when offline
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip Supabase API calls — handle in app
  if (url.hostname.includes('supabase')) return;
  // Skip non-GET
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Offline — serve from cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // For navigation requests, return the app
          if (event.request.mode === 'navigate') {
            return caches.match(OFFLINE_URL);
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});

// Listen for messages from app
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
  if (event.data === 'cacheRecords') {
    // App sends burial records to cache
    event.waitUntil(
      caches.open(CACHE_NAME).then(cache => {
        return cache.put('offline-records', new Response(
          JSON.stringify(event.data.records),
          { headers: { 'Content-Type': 'application/json' } }
        ));
      })
    );
  }
});
