const CACHE_NAME = 'kd-admin-v3';
const PRECACHE = [
  '/admin/',
  '/admin/styles.css',
  '/admin/app.js',
  '/favicon.svg',
  '/assets/brand/kaymen-lockup.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Let navigation requests (OAuth redirects, page loads) pass through untouched
  if (e.request.mode === 'navigate') return;

  // Network-first for API calls
  if (e.request.url.includes('/api/') || e.request.url.includes('/auth/')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  // Stale-while-revalidate for static assets
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
