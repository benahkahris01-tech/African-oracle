/* ═══════════════════════════════════════════════════════════════
   sw.js — The African Oracle Service Worker
   Strategy: Stale-While-Revalidate
   
   On first visit:    fetch from network, store in cache
   On repeat visits:  serve from cache INSTANTLY,
                      then fetch fresh version in background
                      so next visit gets the update
   
   This is what makes the site feel instant on slow mobile
   networks in Kenya and South Africa — the user always sees
   something immediately, never a blank loading screen.
   
   Cache version: bump CACHE_VERSION when you want all users
   to get a full fresh cache (e.g. major redesign).
   For normal updates the version query string handles it.
═══════════════════════════════════════════════════════════════ */

var CACHE_VERSION = "oracle-v1";
var CACHE_NAME    = CACHE_VERSION;

// Files to pre-cache on install — these are served instantly
// from the very first visit after the SW installs
var PRECACHE_URLS = [
  "/",
  "/index.html",
  "/stock.html",
  "/learn.html",
  "/about.html",
  "/contact.html",
  "/privacy.html",
  "/css/style.css",
  "/css/stock.css",
  "/css/learn.css",
  "/css/static-page.css",
  "/js/app.js",
  "/js/stock.js"
];

// ── Install: pre-cache all shell files ───────────────────────
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE_URLS);
    }).then(function () {
      // Activate immediately — don't wait for old SW to die
      return self.skipWaiting();
    })
  );
});

// ── Activate: delete old cache versions ──────────────────────
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) {
          return key !== CACHE_NAME;
        }).map(function (key) {
          return caches.delete(key);
        })
      );
    }).then(function () {
      // Take control of all pages immediately
      return self.clients.claim();
    })
  );
});

// ── Fetch: stale-while-revalidate ────────────────────────────
// 1. Check cache — if found, return it IMMEDIATELY (instant)
// 2. Simultaneously fetch fresh version from network
// 3. Update cache with fresh version for next visit
// 4. If no cache and network fails, show offline page
self.addEventListener("fetch", function (event) {
  var req = event.request;

  // Only handle GET requests — pass through POST etc.
  if (req.method !== "GET") return;

  // Don't cache Apps Script API calls — always need fresh data
  // (the sessionStorage in app.js handles that separately)
  if (req.url.indexOf("script.google.com") > -1) return;
  if (req.url.indexOf("googleapis.com") > -1 &&
      req.url.indexOf("fonts") === -1) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.match(req).then(function (cachedResponse) {

        // Fetch fresh version in background regardless
        var networkFetch = fetch(req).then(function (networkResponse) {
          // Only cache successful responses
          if (networkResponse && networkResponse.status === 200) {
            cache.put(req, networkResponse.clone());
          }
          return networkResponse;
        }).catch(function () {
          // Network failed — return null, cached version still serves
          return null;
        });

        // Return cached version IMMEDIATELY if available
        // Otherwise wait for network
        return cachedResponse || networkFetch;
      });
    })
  );
});