const CACHE_NAME = 'kids-playzone-v10';
const ASSETS = [
  './games.html',
  './index.html',
  './kids_gaming_hero.png',
  './kids_mascot.png',
  './style.css',
  './games-data.js',
  './app.js',
  './play/audio-manager.js',
  './play/particle-grid.js',
  './play/flappy-rocket.js',
  './play/stack-tower.js',
  './play/reflex-racer.js',
  './play/retro-snake.js',
  './play/endless-runner.js',
  './play/balloon-pop.js',
  './play/word-search.js',
  './play/bubble-shooter.js',
  './play/space-defender.js',
  './play/air-hockey.js',
  './play/archery-master.js',
  './play/road-traffic.js',
  './play/sushi-spin.js',
  './play/match-3-candy.js',
  './play/merge-puzzle.js',
  './play/math-mahjong.js',
  './play/pixel-painter.js',
  './play/platform-jumper.js',
  './play/idle-miner.js',
  './play/merge-restaurant.js',
  './play/block-blitz.js',
  './play/slide-puzzle.js',
  './play/knife-throw.js',
  './play/flow-connect.js'
];

// Install Event
self.addEventListener('install', (e) => {
  self.skipWaiting();
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
    }).then(() => self.clients.claim())
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
