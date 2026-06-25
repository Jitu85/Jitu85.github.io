const CACHE_NAME = 'kids-playzone-v12';
const RUNTIME_CACHE = 'kids-playzone-runtime-v1';
const ASSETS = [
  './games.html',
  './index.html',
  './terms.html',
  './privacy.html',
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
  './play/flow-connect.js',
  './play/neon-breakout.js',
  './play/asteroid-blast.js',
  './play/memory-match.js',
  './play/neon-pinball.js',
  './play/dodge-blitz.js',
  './play/circuit-breaker.js'
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
          if (key !== CACHE_NAME && key !== RUNTIME_CACHE) {
            console.log('[Service Worker] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(e.request).then((networkResponse) => {
        if (networkResponse && (networkResponse.ok || networkResponse.type === 'opaque')) {
          const responseToCache = networkResponse.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(e.request, responseToCache));
        }
        return networkResponse;
      }).catch(() => {
        const accept = e.request.headers.get('accept') || '';

        if (e.request.mode === 'navigate' || accept.includes('text/html')) {
          return caches.match('./index.html');
        }

        if (accept.includes('image')) {
          return caches.match('./kids_gaming_hero.png');
        }

        return new Response('', {
          status: 503,
          statusText: 'Offline',
          headers: { 'Content-Type': 'text/plain' }
        });
      });
    })
  );
});
