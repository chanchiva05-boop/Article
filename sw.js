const CACHE_NAME = 'teva-v4';
const urlsToCache = [
  './',
  './index.html',
  './METFONE.txt',
  './CELLCARD.txt',
  './teva.png'
];

// Install Service Worker
self.addEventListener('install', event => {
  console.log('Service Worker installing...', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching files...');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Network First for txt files (always get latest)
function networkFirst(request) {
  return fetch(request, { cache: 'no-store' })
    .then(response => {
      if (response && response.status === 200) {
        const responseToCache = response.clone();
        caches.open(CACHE_NAME)
          .then(cache => {
            cache.put(request, responseToCache);
          });
        return response;
      }
      throw new Error('Network failed');
    })
    .catch(() => {
      console.log('Using cached version for:', request.url);
      return caches.match(request);
    });
}

// Cache First for static assets
function cacheFirst(request) {
  return caches.match(request)
    .then(response => {
      return response || fetch(request);
    });
}

// Handle fetch events
self.addEventListener('fetch', event => {
  const url = event.request.url;
  
  // Network First for txt files (METFONE.txt and CELLCARD.txt)
  if (url.includes('METFONE.txt') || url.includes('CELLCARD.txt')) {
    event.respondWith(networkFirst(event.request));
  } 
  // Cache First for other files (HTML, CSS, images)
  else {
    event.respondWith(cacheFirst(event.request));
  }
});

// Activate and clean old caches
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

// Listen for update messages from client
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});