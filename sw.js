const CACHE_NAME = 'kids-playzone-v1';
const ASSETS = [
  './index.html',
  './style.css',
  './games-data.js',
  './app.js',
  './play/audio-manager.js',
  './play/particle-grid.js',
  './play/flappy-rocket.js',
  './play/stack-tower.js',
  './play/reflex-racer.js',
  './play/retro-snake.js'
];

// Install Event
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching Game Shell and Assets');
      return cache.addAll(ASSETS);
    })
  );
});

// Activate Event
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
});

// Fetch Event
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(e.request).catch(() => {
        // Fallback or silence error if offline and resource is not in cache
      });
    })
  );
});
