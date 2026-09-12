// 'surftober-src' is a SENTINEL: build.mjs replaces it with
// 'surftober-<content hash>' at deploy, so every deploy gets a fresh cache
// automatically — no more manual vNN bumps. The sentinel value is what runs
// when this file is served RAW (localhost dev, the GitHub Pages fallback):
// functional, but without automatic cache busting.
const CACHE = 'surftober-src';
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

const ASSETS = [
  './', 
  './index.html', 
  './landing.html',
  './register.html',
  './styles.css',
  './app.js',
  './awards.js',
  './photo-kit.js',
  './manifest.webmanifest',
  './logo.svg',
  './icon-maskable.svg',
  './version.js'
];

// UPDATE POLICY (v1.49.1, after a deploy-time race left a desktop tab
// unstyled): assets are content-hashed and every HTML references its own
// hashes, so a new worker has no reason to hurry. It precaches, then WAITS
// until every page controlled by the previous worker is gone before it
// activates and purges the old cache. No skipWaiting on install and no
// claiming of open pages — that combination could hijack a page built from
// the previous HTML, delete the cache holding its hashed CSS/JS, and 404 on
// the origin (old hashes are gone after a deploy) → a page with no styles.
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
});

// Self-heal for the one case the policy above can't prevent: a page whose
// HTML is stale relative to the deployment (e.g. served from a CDN edge that
// hadn't switched yet) asks for a hashed asset the origin no longer has. A
// 404 on a hashed CSS/JS name means "this page is from an old deploy" — reload
// that page once so it fetches fresh HTML, rather than leaving it unstyled.
// Rate-limited per page URL so a genuinely missing asset can't cause a loop.
const HASHED_ASSET = /\.[0-9a-f]{8}\.(css|js|svg|webmanifest)$/;
const healedAt = new Map(); // client url -> timestamp
async function healStaleClient(clientId){
  if (!clientId) return;
  const client = await self.clients.get(clientId);
  if (!client || typeof client.navigate !== 'function') return;
  const last = healedAt.get(client.url) || 0;
  if (Date.now() - last < 60 * 1000) return;
  healedAt.set(client.url, Date.now());
  try { await client.navigate(client.url); } catch (_) { /* not a window client */ }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;

  // Only handle same-origin requests
  if (url.origin !== location.origin) return;

  // Vercel-injected routes (Web Analytics script + view beacons). These are
  // same-origin, so without this they'd hit the cache-first branch below —
  // pinning the script in cache forever and, worse, potentially serving a
  // cached response instead of actually sending a beacon. Always let them
  // go straight to the network.
  // Same reasoning for /api/* (the keep-alive cron endpoint): never serve an
  // API response from cache.
  if (url.pathname.startsWith('/_vercel/') || url.pathname.startsWith('/api/')) return;

  // Deploy marker: always fetch fresh (bypass HTTP + SW cache) so the
  // visible version reliably reflects what is actually live.
  if (url.pathname.endsWith('version.js')) {
    e.respondWith(
      fetch(req.url, { cache: 'no-store' }).catch(() => caches.match('./version.js'))
    );
    return;
  }

  // Handle navigations (HTML pages): network-first with cache fallback.
  // Cache under the page's own URL — caching everything as './index.html'
  // meant a visit to landing.html poisoned the offline copy of the app.
  const acceptsHTML = req.headers.get('accept')?.includes('text/html');
  if (req.mode === 'navigate' || acceptsHTML) {
    e.respondWith(
      fetch(req)
        .then((r) => {
          // Only cache good responses — a cached 404/500 would be served offline forever.
          if (r.ok) {
            const copy = r.clone();
            caches.open(CACHE).then((c) => c.put(new URL(url.pathname, location.origin).href, copy));
          }
          return r;
        })
        .catch(() =>
          caches.match(url.pathname.endsWith('/') ? './index.html' : new URL(url.pathname, location.origin).href)
            .then((res) => res || caches.match('./index.html'))
        )
    );
    return;
  }

  // Static assets: cache-first, then network
  e.respondWith(
    caches.match(req).then((res) =>
      res ||
      fetch(req)
        .then((r) => {
          if (r.ok) {
            const copy = r.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          } else if (r.status === 404 && HASHED_ASSET.test(url.pathname)) {
            healStaleClient(e.clientId);
          }
          return r;
        })
    )
  );
});
