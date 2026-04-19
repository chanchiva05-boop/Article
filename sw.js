// sw.js - Enhanced Service Worker
// Version: 2.0.0 | Cache: teva-v11

const CONFIG = {
  CACHE_NAME: 'teva-v11',
  CACHE_VERSION: '2.0.0',
  DEBUG: true,
  TXT_FILES: ['METFONE.txt', 'CELLCARD.txt', 'METFONE1.txt'],
  FALLBACKS: {
    'METFONE.txt': 'កាកម៉េសហ្អា',
    'CELLCARD.txt': 'TEVA555',
    'METFONE1.txt': 'កាកម៉េសហ្អា1'
  },
  TIMEOUTS: {
    NETWORK: 5000,    // 5 seconds
    FETCH: 10000      // 10 seconds
  }
};

const urlsToCache = [
  './',
  './index.html',
  './teva.png',
  ...CONFIG.TXT_FILES.map(f => `./${f}`)
];

// ===== Utility Functions =====
const log = (...args) => CONFIG.DEBUG && console.log('[SW]', ...args);
const warn = (...args) => CONFIG.DEBUG && console.warn('[SW]', ...args);
const error = (...args) => CONFIG.DEBUG && console.error('[SW]', ...args);

const isTxtFile = (url) => CONFIG.TXT_FILES.some(file => url.includes(file));
const getFileName = (url) => CONFIG.TXT_FILES.find(file => url.includes(file)) || '';

const timeout = (promise, ms) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    )
  ]);
};

// ===== Cache Management =====
class CacheManager {
  static async clearOldCaches(currentCacheName) {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter(name => name !== currentCacheName)
        .map(name => {
          log('Deleting old cache:', name);
          return caches.delete(name);
        })
    );
  }

  static async clearTxtFiles(cacheName) {
    const cache = await caches.open(cacheName);
    const deletePromises = CONFIG.TXT_FILES.flatMap(file => [
      cache.delete(`./${file}`),
      cache.delete(file),
      cache.delete(new URL(file, self.location.origin).href)
    ]);
    await Promise.all(deletePromises);
    log('Cleared all TXT files from cache');
  }

  static async preCacheAll() {
    const cache = await caches.open(CONFIG.CACHE_NAME);
    try {
      await cache.addAll(urlsToCache);
      log('Pre-cached all files successfully');
    } catch (err) {
      error('Pre-cache failed:', err);
      throw err;
    }
  }
}

// ===== Network Strategies =====
const NetworkStrategies = {
  // Network First with timeout and fallback
  async networkFirst(request) {
    const originalUrl = request.url.split('?')[0];
    const fileName = getFileName(originalUrl);
    
    try {
      // Try network with cache-busting
      const fetchUrl = new URL(request.url);
      fetchUrl.searchParams.set('_', Date.now());
      
      const response = await timeout(
        fetch(fetchUrl, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        }),
        CONFIG.TIMEOUTS.NETWORK
      );
      
      if (response?.ok) {
        // Update cache in background
        this.updateCache(originalUrl, response.clone());
        
        // Notify clients
        await this.notifyClients('contentUpdated', {
          file: originalUrl,
          timestamp: Date.now()
        });
        
        return response;
      }
      throw new Error(`Network response not OK: ${response?.status}`);
      
    } catch (err) {
      warn('Network failed, trying cache:', originalUrl);
      
      // Try cache
      const cachedResponse = await caches.match(originalUrl);
      if (cachedResponse) {
        log('✅ Using cached version:', originalUrl);
        return cachedResponse;
      }
      
      // Use fallback if available
      if (fileName && CONFIG.FALLBACKS[fileName]) {
        warn('⚠️ Using fallback for:', fileName);
        return new Response(CONFIG.FALLBACKS[fileName], {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
      
      return new Response('Offline - Content not available', { 
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  },

  async htmlNetworkFirst(request) {
    try {
      const response = await timeout(
        fetch(request, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        }),
        CONFIG.TIMEOUTS.NETWORK
      );
      
      if (response?.ok) {
        const cache = await caches.open(CONFIG.CACHE_NAME);
        await cache.put(request, response.clone());
        log('Updated HTML cache');
        return response;
      }
      throw new Error('Network failed');
    } catch (err) {
      warn('Using cached HTML');
      const cachedResponse = await caches.match(request);
      if (cachedResponse) return cachedResponse;
      
      return new Response('Page not available offline', { 
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }
  },

  async cacheFirst(request) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      log('Cache hit:', request.url);
      return cachedResponse;
    }
    
    // Network fallback
    try {
      const response = await fetch(request);
      if (response?.ok) {
        const cache = await caches.open(CONFIG.CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch (err) {
      error('CacheFirst network error:', err);
      throw err;
    }
  },

  async updateCache(key, response) {
    try {
      const cache = await caches.open(CONFIG.CACHE_NAME);
      await cache.put(key, response);
      log('Cache updated:', key);
    } catch (err) {
      error('Failed to update cache:', err);
    }
  },

  async notifyClients(type, data = {}) {
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ 
        type, 
        source: 'sw',
        version: CONFIG.CACHE_VERSION,
        ...data 
      });
    });
  }
};

// ===== Event Handlers =====
self.addEventListener('install', event => {
  log(`Installing Service Worker v${CONFIG.CACHE_VERSION}`);
  
  event.waitUntil(
    CacheManager.preCacheAll()
      .then(() => self.skipWaiting())
      .catch(err => error('Install failed:', err))
  );
});

self.addEventListener('activate', event => {
  log(`Activating Service Worker v${CONFIG.CACHE_VERSION}`);
  
  event.waitUntil(
    CacheManager.clearOldCaches(CONFIG.CACHE_NAME)
      .then(() => self.clients.claim())
      .then(() => {
        log('Service Worker activated and ready');
        return NetworkStrategies.notifyClients('swActivated', {
          version: CONFIG.CACHE_VERSION
        });
      })
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = request.url;
  
  // Skip non-GET requests
  if (request.method !== 'GET') return;
  
  // Handle Service Worker updates
  if (url.includes('sw.js')) {
    event.respondWith(
      fetch(request, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      })
    );
    return;
  }
  
  // Route requests
  if (isTxtFile(url)) {
    event.respondWith(NetworkStrategies.networkFirst(request));
  } else if (url.includes('index.html') || request.mode === 'navigate') {
    event.respondWith(NetworkStrategies.htmlNetworkFirst(request));
  } else {
    event.respondWith(NetworkStrategies.cacheFirst(request));
  }
});

self.addEventListener('message', async event => {
  const { data } = event;
  log('Message received:', data);
  
  const handlers = {
    async forceUpdate() {
      log('Force update triggered');
      await CacheManager.clearTxtFiles(CONFIG.CACHE_NAME);
      await NetworkStrategies.notifyClients('refreshContent', {
        forceUpdate: true
      });
    },
    
    async checkUpdates() {
      log('Checking for updates...');
      const cache = await caches.open(CONFIG.CACHE_NAME);
      let hasUpdates = false;
      
      for (const file of CONFIG.TXT_FILES) {
        try {
          const url = new URL(`./${file}`, self.location.origin);
          url.searchParams.set('_', Date.now());
          
          const response = await timeout(
            fetch(url, {
              cache: 'no-store',
              headers: { 'Cache-Control': 'no-cache' }
            }),
            CONFIG.TIMEOUTS.FETCH
          );
          
          if (response?.ok) {
            const cachedResponse = await cache.match(`./${file}`);
            const newContent = await response.text();
            
            if (cachedResponse) {
              const oldContent = await cachedResponse.text();
              if (oldContent !== newContent) {
                hasUpdates = true;
                log('Content changed:', file);
              }
            } else {
              hasUpdates = true;
            }
            
            await cache.put(`./${file}`, response.clone());
            log('Updated:', file);
          }
        } catch (err) {
          warn(`Failed to check ${file}:`, err);
        }
      }
      
      await NetworkStrategies.notifyClients('updatesChecked', {
        hasUpdates,
        timestamp: Date.now()
      });
    },
    
    async skipWaiting() {
      await self.skipWaiting();
    }
  };
  
  const handler = handlers[data];
  if (handler) {
    try {
      await handler();
    } catch (err) {
      error('Message handler error:', err);
    }
  }
});

self.addEventListener('periodicsync', event => {
  if (event.tag === 'update-content') {
    event.waitUntil(updateContentInBackground());
  }
});

async function updateContentInBackground() {
  log('Background sync: updating content');
  const cache = await caches.open(CONFIG.CACHE_NAME);
  let hasUpdates = false;
  
  for (const file of CONFIG.TXT_FILES) {
    try {
      const url = new URL(`./${file}`, self.location.origin);
      url.searchParams.set('_', Date.now());
      
      const response = await timeout(
        fetch(url, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        }),
        CONFIG.TIMEOUTS.FETCH
      );
      
      if (response?.ok) {
        const cachedResponse = await cache.match(`./${file}`);
        const newContent = await response.text();
        
        if (cachedResponse) {
          const oldContent = await cachedResponse.text();
          if (oldContent !== newContent) {
            hasUpdates = true;
            log('Background update - content changed:', file);
          }
        }
        
        await cache.put(`./${file}`, response.clone());
        log('Background updated:', file);
      }
    } catch (err) {
      warn('Background update failed for:', file, err);
    }
  }
  
  if (hasUpdates) {
    await NetworkStrategies.notifyClients('backgroundUpdate', {
      timestamp: Date.now()
    });
  }
}

// Export version for debugging
self.CONFIG = CONFIG;
