// ===== SERVICE WORKER - TEVA PWA =====
const CACHE_NAME = 'teva-pwa-v2.0.0';
const DYNAMIC_CACHE = 'teva-dynamic-v2.0.0';

// Files to cache on install
const STATIC_ASSETS = [
    './',
    './index.html',
    './teva.png',
    './METFONE.txt',
    './CELLCARD.txt',
    './METFONE1.txt',
    './manifest.json'
];

// Files that should always be fetched from network
const NETWORK_ONLY = [
    'METFONE.txt',
    'CELLCARD.txt',
    'METFONE1.txt'
];

// ===== INSTALL EVENT =====
self.addEventListener('install', (event) => {
    console.log('🔧 Service Worker: Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('📦 Service Worker: Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('✅ Service Worker: Install completed');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('❌ Service Worker: Install failed', error);
            })
    );
});

// ===== ACTIVATE EVENT =====
self.addEventListener('activate', (event) => {
    console.log('🔄 Service Worker: Activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME && cacheName !== DYNAMIC_CACHE) {
                            console.log('🗑️ Service Worker: Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('✅ Service Worker: Activation completed');
                return self.clients.claim();
            })
    );
});

// ===== FETCH EVENT =====
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') return;
    
    // Handle network-only files (text files that update frequently)
    if (NETWORK_ONLY.some(file => url.pathname.includes(file))) {
        event.respondWith(networkFirstStrategy(request));
        return;
    }
    
    // HTML files - Network first, fallback to cache
    if (request.mode === 'navigate' || url.pathname.endsWith('.html')) {
        event.respondWith(networkFirstStrategy(request));
        return;
    }
    
    // Images and static assets - Cache first, fallback to network
    if (url.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico)$/)) {
        event.respondWith(cacheFirstStrategy(request));
        return;
    }
    
    // Default: Stale-while-revalidate
    event.respondWith(staleWhileRevalidateStrategy(request));
});

// ===== CACHE STRATEGIES =====

// Network First (for HTML and text files that update frequently)
async function networkFirstStrategy(request) {
    try {
        const networkResponse = await fetch(request, { cache: 'no-store' });
        
        // Update cache with new response
        const cache = await caches.open(DYNAMIC_CACHE);
        cache.put(request, networkResponse.clone());
        
        return networkResponse;
    } catch (error) {
        console.log('⚠️ Network failed, falling back to cache:', request.url);
        const cachedResponse = await caches.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Offline fallback for navigation
        if (request.mode === 'navigate') {
            return caches.match('./index.html');
        }
        
        throw error;
    }
}

// Cache First (for static assets)
async function cacheFirstStrategy(request) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
        // Update cache in background
        updateCacheInBackground(request);
        return cachedResponse;
    }
    
    try {
        const networkResponse = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, networkResponse.clone());
        return networkResponse;
    } catch (error) {
        console.error('❌ Fetch failed:', request.url, error);
        throw error;
    }
}

// Stale While Revalidate (for other resources)
async function staleWhileRevalidateStrategy(request) {
    const cachedResponse = await caches.match(request);
    
    const fetchPromise = fetch(request)
        .then(async (networkResponse) => {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
            return networkResponse;
        })
        .catch((error) => {
            console.log('⚠️ Network fetch failed:', request.url, error);
        });
    
    return cachedResponse || fetchPromise;
}

// Background cache update
async function updateCacheInBackground(request) {
    try {
        const networkResponse = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, networkResponse);
        console.log('🔄 Background cache updated:', request.url);
    } catch (error) {
        console.log('⚠️ Background update failed:', request.url);
    }
}

// ===== PERIODIC CONTENT CHECK =====
const CONTENT_FILES = ['METFONE.txt', 'CELLCARD.txt', 'METFONE1.txt'];
let lastContentCheck = Date.now();

async function checkForContentUpdates() {
    console.log('🔍 Checking for content updates...');
    
    const updatePromises = CONTENT_FILES.map(async (fileName) => {
        try {
            const response = await fetch(fileName + '?t=' + Date.now(), {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' }
            });
            
            if (response.ok) {
                const newContent = await response.text();
                const cache = await caches.open(DYNAMIC_CACHE);
                const cachedResponse = await cache.match(fileName);
                
                if (cachedResponse) {
                    const oldContent = await cachedResponse.text();
                    if (oldContent !== newContent) {
                        console.log('🔄 Content updated:', fileName);
                        await cache.put(fileName, response.clone());
                        return { fileName, updated: true, content: newContent };
                    }
                } else {
                    await cache.put(fileName, response.clone());
                    return { fileName, updated: true, content: newContent };
                }
            }
        } catch (error) {
            console.error('❌ Failed to check update for:', fileName, error);
        }
        return { fileName, updated: false };
    });
    
    const results = await Promise.all(updatePromises);
    const hasUpdates = results.some(r => r.updated);
    
    if (hasUpdates) {
        // Notify all clients about the update
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'contentUpdated',
                timestamp: Date.now(),
                updates: results.filter(r => r.updated)
            });
        });
    }
    
    lastContentCheck = Date.now();
    return hasUpdates;
}

// ===== PERIODIC SYNC =====
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'content-sync') {
        event.waitUntil(checkForContentUpdates());
    }
});

// ===== BACKGROUND SYNC =====
self.addEventListener('sync', (event) => {
    if (event.tag === 'content-update') {
        event.waitUntil(checkForContentUpdates());
    }
});

// ===== PUSH NOTIFICATION =====
self.addEventListener('push', (event) => {
    let data = {
        title: 'TEVA',
        body: 'មានការធ្វើបច្ចុប្បន្នភាពថ្មី!',
        icon: './teva.png',
        badge: './teva.png'
    };
    
    if (event.data) {
        try {
            data = { ...data, ...event.data.json() };
        } catch (e) {
            data.body = event.data.text();
        }
    }
    
    const options = {
        body: data.body,
        icon: data.icon,
        badge: data.badge,
        vibrate: [200, 100, 200],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'open',
                title: 'បើកមើល'
            },
            {
                action: 'close',
                title: 'បិទ'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// ===== NOTIFICATION CLICK =====
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    if (event.action === 'close') return;
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                for (const client of clientList) {
                    if (client.url.includes('/index.html') && 'focus' in client) {
                        return client.focus();
                    }
                }
                return clients.openWindow('./');
            })
    );
});

// ===== MESSAGE HANDLER =====
self.addEventListener('message', (event) => {
    console.log('📨 Service Worker received message:', event.data);
    
    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data.type === 'CHECK_UPDATES') {
        event.waitUntil(
            checkForContentUpdates().then((hasUpdates) => {
                event.ports[0].postMessage({ hasUpdates });
            })
        );
    }
    
    if (event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => caches.delete(cacheName))
                );
            }).then(() => {
                console.log('🗑️ All caches cleared');
                event.ports[0].postMessage({ success: true });
            })
        );
    }
});

// ===== AUTO UPDATE CHECK (Every 5 minutes) =====
setInterval(() => {
    const now = Date.now();
    if (now - lastContentCheck > 300000) { // 5 minutes
        checkForContentUpdates().then((hasUpdates) => {
            if (hasUpdates) {
                console.log('🔄 Auto-update detected changes');
            }
        });
    }
}, 300000);

// ===== ONLINE/OFFLINE HANDLING =====
self.addEventListener('message', (event) => {
    if (event.data.type === 'ONLINE_STATUS') {
        const isOnline = event.data.online;
        console.log(`🌐 Service Worker: Client is ${isOnline ? 'online' : 'offline'}`);
        
        if (isOnline) {
            checkForContentUpdates().then((hasUpdates) => {
                if (hasUpdates) {
                    self.clients.matchAll().then((clients) => {
                        clients.forEach((client) => {
                            client.postMessage({
                                type: 'backgroundUpdate',
                                message: 'មាតិកាត្រូវបានធ្វើបច្ចុប្បន្នភាពពេលអ្នកនៅក្រៅបណ្តាញ'
                            });
                        });
                    });
                }
            });
        }
    }
});

// ===== VERSION CHECK =====
async function checkVersion() {
    try {
        const response = await fetch('./index.html?t=' + Date.now(), {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache' }
        });
        
        if (response.ok) {
            const newHtml = await response.text();
            const versionMatch = newHtml.match(/CACHE_NAME = 'teva-pwa-v([\d.]+)'/);
            
            if (versionMatch) {
                const newVersion = versionMatch[1];
                const currentVersion = CACHE_NAME.match(/v([\d.]+)/)[1];
                
                if (newVersion !== currentVersion) {
                    console.log('🔄 New version detected:', newVersion);
                    
                    const clients = await self.clients.matchAll();
                    clients.forEach(client => {
                        client.postMessage({
                            type: 'newVersion',
                            version: newVersion
                        });
                    });
                    
                    return true;
                }
            }
        }
    } catch (error) {
        console.error('❌ Version check failed:', error);
    }
    return false;
}

// Check version every hour
setInterval(() => {
    checkVersion();
}, 3600000);

console.log('✅ TEVA Service Worker v2.0.0 loaded and ready!');
