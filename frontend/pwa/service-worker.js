const CACHE_NAME = 'resto-field-cache-v12';
const ASSETS_TO_CACHE = [
  '/',
  '/login',
  '/restaurants',
  '/add-restaurant',
  '/profile',
  '/admin',
  '/css/style.css',
  '/css/dashboard.css',
  '/css/add-restaurant.css',
  '/js/api.js',
  '/js/auth.js',
  '/js/location.js',
  '/js/db-offline.js',
  '/js/restaurants.js',
  '/assets/images/default-restaurant.svg',
  '/pwa/manifest.json',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://fonts.googleapis.com/css2?family=Outfit:wght=300;400;500;600;700&display=swap'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || e.request.url.includes('/api/')) {
    return;
  }

  // Only handle same-origin requests unless they are explicitly in the pre-cache list (like leaflet or fonts)
  const isPreCached = ASSETS_TO_CACHE.some(asset => e.request.url.includes(asset));
  if (!e.request.url.startsWith(self.location.origin) && !isPreCached) {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((response) => {
        if (response && response.status === 200) {
          const responseCopy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseCopy);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(e.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (e.request.mode === 'navigate') {
            return caches.match('/');
          }
        });
      })
  );
});
