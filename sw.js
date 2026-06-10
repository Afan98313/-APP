const CACHE_NAME = 'expense-tracker-v1';
const ASSETS = [
  '/记账APP/',
  '/记账APP/index.html',
  '/记账APP/css/app.css',
  '/记账APP/js/db.js',
  '/记账APP/js/parser.js',
  '/记账APP/js/voice.js',
  '/记账APP/js/ui.js',
  '/记账APP/js/app.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS).catch(err => {
      // Continue even if some assets fail to cache
      console.warn('Cache install partial:', err);
    }))
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
});
