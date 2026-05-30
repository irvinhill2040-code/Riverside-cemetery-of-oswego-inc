// Riverside Cemetery PWA Service Worker
const CACHE_NAME = 'riverside-cemetery-v1';
const ASSETS_TO_CACHE = [
  '/Riverside-cemetery-of-oswego-inc/',
  '/Riverside-cemetery-of-oswego-inc/index.html',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// Install event - cache essential files
self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Caching app shell');
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.log('Some assets failed to cache:', err);
        // Continue even if some files fail to cache
        return ASSETS_TO_CACHE.filter(url => !url.startsWith('https://'))
          .reduce((promise, url) => promise.then(() => cache.add(url)), Promise.resolve());
      });
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // For API requests (supabase), try network first, fallback to cache
  if (event.request.url.includes('supabase')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache successful responses
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Network failed, try cache
          return caches.match(event.request)
            .then(response => response || new Response('Offline - please check your connection', { status: 503 }));
        })
    );
    return;
  }

  // For everything else, try cache first, fallback to network
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request)
          .then(response => {
            // Cache successful responses
            if (response.ok && event.request.method === 'GET') {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseClone);
              });
            }
            return response;
          })
          .catch(() => {
            // Return offline page if available
            return caches.match('/Riverside-cemetery-of-oswego-inc/index.html')
              .then(response => response || new Response('Offline - please check your connection', { status: 503 }));
          });
      })
  );
});

// Handle messages from the app
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
