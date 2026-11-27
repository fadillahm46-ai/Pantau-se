/**
 * PANTAU SE — Service Worker (PWA)
 * - Pre-cache App Shell (HTML, JS lokal, manifest, ikon)
 * - Bypass total untuk request API Supabase, Google Apps Script (GAS), & Drive
 * - Network-First untuk dokumen & script aplikasi (selalu dapat update terbaru saat online)
 * - Stale-While-Revalidate untuk aset statis / CDN agar tetap responsif saat koneksi lemah
 */

const CACHE_VERSION = 'v1.0.22';
const SHELL_CACHE = `pantau-se-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `pantau-se-runtime-${CACHE_VERSION}`;

const APP_SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/favicon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon.svg',
  './js/app-core.js',
  './js/app-manpower-performa.js',
  './js/app-atr-punishment.js',
  './js/app-roster-info-master.js',
  './js/app-roster-views.js',
  './js/app-operasional-se.js',
  './js/app-table-bulk-select.js',
  './js/app-cloud-sync.js',
  './js/app-access-nav.js',
  './js/app-auth.js'
];

// Host / path yang WAJIB selalu direct network (tidak pernah dicache)
const BYPASS_HOSTS = [
  'supabase.co',
  'supabase.in',
  'script.google.com',
  'script.googleusercontent.com',
  'drive.google.com',
  'docs.google.com',
  'sheets.googleapis.com'
];

function shouldBypassRequest(request, url) {
  if (request.method !== 'GET') return true;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return true;
  if (url.pathname.startsWith('/api/')) return true;
  return BYPASS_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(async (cache) => {
      await Promise.all(
        APP_SHELL_ASSETS.map((assetUrl) =>
          cache.add(new Request(assetUrl, { cache: 'reload' })).catch(() => null)
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  let url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return;
  }

  if (shouldBypassRequest(request, url)) {
    return;
  }

  const isSameOrigin = url.origin === self.location.origin;

  // Same-origin (HTML, JS, JSON, SVG): Network-First dengan fallback Cache
  if (isSameOrigin) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok && networkResponse.type === 'basic') {
            const copy = networkResponse.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy)).catch(() => { });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          if (request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return new Response('Offline — resource tidak tersedia di cache.', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
        })
    );
    return;
  }

  // External static CDN (FontAwesome, Chart.js, SheetJS, Google Fonts, dll): Stale-While-Revalidate
  event.respondWith(
    caches.open(RUNTIME_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && (response.ok || response.type === 'opaque')) {
            cache.put(request, response.clone()).catch(() => { });
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});

self.addEventListener('message', (event) => {
  if (!event.data || typeof event.data !== 'object') return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
    );
  }
});
