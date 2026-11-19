// ==============================================================================
// PADAVO SERVICE WORKER — TRUE OFFLINE PWA & BACKGROUND SYNC (v1.3)
// ==============================================================================
const CACHE_NAME = 'padavo-saas-v1.3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/home.html',
  '/buyer-tracking-uk.html',
  '/manifest.json',
  '/logo.png',
  '/logo.jpg',
  '/lucide.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Padavo SW] Pre-caching core app shell & assets...');
      return cache.addAll(STATIC_ASSETS).catch((err) => console.log('Notice on pre-cache:', err));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Padavo SW] Clearing legacy cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // 1. Only intercept GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // 2. Let API requests bypass Service Worker cache
  if (event.request.url.includes('/api/')) {
    return;
  }

  const isSameOrigin = event.request.url.startsWith(self.location.origin);

  // 3. For cross-origin third-party resources (Unsplash, Google Fonts, CDN):
  // Let browser fetch directly; if network fails, catch gracefully without crashing SW
  if (!isSameOrigin) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Return valid empty Response on network failure so respondWith never receives undefined
        return new Response(null, { status: 404, statusText: 'Resource Unavailable Offline' });
      })
    );
    return;
  }

  // 4. Same-origin cache-first with background revalidation
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Revalidate in background
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }
        const clone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return networkResponse;
      }).catch(async () => {
        const accept = event.request.headers.get('accept') || '';
        // Fallback for HTML documents when offline
        if (accept.includes('text/html') || event.request.destination === 'document') {
          const fallback = await caches.match('/index.html');
          if (fallback) return fallback;
        }
        // Fallback for images
        if (accept.includes('image/') || event.request.destination === 'image') {
          const logoFallback = await caches.match('/logo.png');
          if (logoFallback) return logoFallback;
          return new Response(null, { status: 404, statusText: 'Image Unavailable Offline' });
        }
        // CRITICAL: Always return a valid Response instance so respondWith never receives undefined
        return new Response(null, { status: 504, statusText: 'Offline' });
      });
    })
  );
});
