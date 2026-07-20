const CACHE_NAME = 'dombi-v3';
const OFFLINE_URL = '/offline';

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll([OFFLINE_URL]))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET' || !request.url.startsWith('http')) return;

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((c) => c.put(request, clone));
                    }
                    return response;
                })
                .catch(() => caches.match(request).then((c) => c || caches.match(OFFLINE_URL)))
        );
        return;
    }

    if (request.url.match(/\.(js|css|woff2?|png|jpg|svg|ico)(\?.*)?$/)) {
        event.respondWith(
            caches.match(request).then((cached) => {
                if (cached) return cached;
                return fetch(request).then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((c) => c.put(request, clone));
                    }
                    return response;
                });
            })
        );
        return;
    }

    if (request.headers.get('Accept')?.includes('application/json') || request.url.includes('/api/')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((c) => c.put(request, clone));
                    }
                    return response;
                })
                .catch(() => caches.match(request))
        );
    }
});

self.addEventListener('push', (event) => {
  let data;
  try { data = event.data?.json(); } catch { data = null; }
  data = data ?? { title: 'Dombi', body: '' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/favicon.png',
      badge: '/badge.png',
      data: { url: data.url },
      tag: data.tag,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
      const existing = cs.find((c) => {
        const cUrl = c.url.endsWith('/') ? c.url : c.url + '/';
        const tUrl = url.endsWith('/') ? url : url + '/';
        return cUrl === tUrl;
      });
      if (existing) {
        existing.focus();
        existing.postMessage({ type: 'NAVIGATE', url });
        return;
      }
      clients.openWindow(url);
    })
  );
});
