// ==============================================================================
// POLARIS Service Worker - Offline-First App Shell & Progressive Sync
// Version: polaris-v2.0.0
// ==============================================================================

const CACHE_NAME = 'polaris-shell-v2.0.0';

const PRECACHE_ASSETS = [
  '/',
  '/sitrep',
  '/logistics',
  '/stations',
  '/assets',
  '/expeditions',
  '/provenance',
  '/manifest.webmanifest',
  '/globe.svg',
];

// Install: pre-cache application shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn('[SW] Pre-cache non-fatal error:', err);
        return self.skipWaiting();
      })
  );
});

// Activate: prune obsolete caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: Stale-While-Revalidate for app shell, Network-first with fallback for API
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Ignore non-GET requests for caching
  if (request.method !== 'GET') {
    return;
  }

  // Handle API requests (Network first, then fallback)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({
            offline: true,
            message: 'Operating in offline mode. Changes spooled to local queue.',
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      })
    );
    return;
  }

  // Stale-While-Revalidate for navigations & static assets
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === 'basic'
          ) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          // If offline and request is HTML navigation, fallback to root cached page
          if (request.mode === 'navigate') {
            return caches.match('/');
          }
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});

// Background Sync (Chromium Progressive Enhancement)
self.addEventListener('sync', (event) => {
  if (event.tag === 'polaris-offline-sync') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        for (const client of clients) {
          client.postMessage({ type: 'TRIGGER_OFFLINE_SYNC' });
        }
      })
    );
  }
});

// Web Push event listener
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const payload = event.data.json();
    const title = payload.title || 'POLARIS Alert';
    const options = {
      body: payload.body || 'Operational update received from station.',
      icon: '/globe.svg',
      badge: '/globe.svg',
      data: payload.data || {},
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error('[SW] Push processing error:', err);
  }
});
