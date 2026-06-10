const CACHE_NAME = 'expense-tracker-v1';
const ASSETS = [
  '/-APP/',
  '/-APP/index.html',
  '/-APP/css/app.css',
  '/-APP/js/db.js',
  '/-APP/js/parser.js',
  '/-APP/js/voice.js',
  '/-APP/js/ui.js',
  '/-APP/js/app.js'
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
