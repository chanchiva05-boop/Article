const CACHE_NAME = 'teva-v6';
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

// Network First - ALWAYS try network first for txt files
async function networkFirst(request) {
  try {
    const response = await fetch(request, { 
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    
    if (response && response.status === 200) {
      const responseToCache = response.clone();
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, responseToCache);
      console.log('🔄 Updated cache:', request.url);
      return response;
    }
    throw new Error('Network failed');
  } catch (error) {
    console.log('📦 Offline, using cache:', request.url);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;
    
    // Fallback for txt files
    if (request.url.includes('METFONE.txt')) {
      return new Response('កាកម៉េសហ្អា', { headers: { 'Content-Type': 'text/plain' } });
    }
    if (request.url.includes('CELLCARD.txt')) {
      return new Response('TEVA555', { headers: { 'Content-Type': 'text/plain' } });
    }
    return new Response('Offline', { status: 503 });
  }
}

// Cache First for static assets
function cacheFirst(request) {
  return caches.match(request)
    .then(response => response || fetch(request));
}

// Handle fetch events
self.addEventListener('fetch', event => {
  const url = event.request.url;
  
  if (url.includes('METFONE.txt') || url.includes('CELLCARD.txt')) {
    event.respondWith(networkFirst(event.request));
  } else {
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

// Listen for force update message
self.addEventListener('message', async (event) => {
  if (event.data === 'forceUpdate') {
    console.log('📡 Force update triggered');
    const cache = await caches.open(CACHE_NAME);
    await cache.delete('./METFONE.txt');
    await cache.delete('./CELLCARD.txt');
    
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage('refreshContent');
    });
  }
});
