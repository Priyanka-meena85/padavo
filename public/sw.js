// ==============================================================================
// PADAVO SERVICE WORKER — TRUE OFFLINE PWA & BACKGROUND SYNC (v1.4)
// ==============================================================================
const CACHE_NAME = 'padavo-saas-v1.4';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/home.html',
  '/buyer-tracking-uk.html',
  '/manifest.json',
  '/logo.png',
  '/logo.jpg',
  '/padavo-logo.png',
  '/padavo-logo.jpg',
  '/favicon.ico',
  '/favicon.png',
  '/favicon.svg',
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
            console.log('[Padavo SW] Purging legacy cache:', key);
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

  // 3. For any cross-origin requests (Tailwind CDN, Google Fonts, Unsplash images, unpkg):
  // NEVER call event.respondWith! Returning immediately allows the browser to fetch natively
  // without triggering connect-src CSP restrictions or Response conversion errors.
  if (!isSameOrigin) {
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
          const logoFallback = (await caches.match('/logo.png')) || (await caches.match('/logo.jpg'));
          if (logoFallback) return logoFallback;
          return new Response(null, { status: 404, statusText: 'Image Unavailable Offline' });
        }
        // CRITICAL: Always return a valid Response instance so respondWith never receives undefined
        return new Response(null, { status: 504, statusText: 'Offline' });
      });
    })
  );
});
