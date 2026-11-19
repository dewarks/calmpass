// Calmpass offline support (web / iPhone home-screen version; not used in the Android app).
//  - The app page: network first, so updates arrive; the saved copy is used when offline.
//  - App files in /assets (their names change every build): saved forever once loaded.
//  - Map tiles: saved as you browse (up to MAX_TILES), so areas you've seen work offline.
//  - Searches and place lookups always go to the network.

// Filled in at build time (see vite.config.js): a build id and every file the app needs.
const VERSION = '0.3.2-mwnm8by1'
const PRECACHE = ["./apple-touch-icon.png","./assets/index-BunyV-y7.css","./assets/index-Cgr8sE-4.js","./assets/inter-cyrillic-400-normal-obahsSVq.woff2","./assets/inter-cyrillic-500-normal-BasfLYem.woff2","./assets/inter-cyrillic-600-normal-CWCymEST.woff2","./assets/inter-cyrillic-700-normal-CjBOestx.woff2","./assets/inter-cyrillic-ext-400-normal-BQZuk6qB.woff2","./assets/inter-cyrillic-ext-500-normal-B0yAr1jD.woff2","./assets/inter-cyrillic-ext-600-normal-Dfes3d0z.woff2","./assets/inter-cyrillic-ext-700-normal-BjwYoWNd.woff2","./assets/inter-latin-400-normal-C38fXH4l.woff2","./assets/inter-latin-500-normal-Cerq10X2.woff2","./assets/inter-latin-600-normal-LgqL8muc.woff2","./assets/inter-latin-700-normal-Yt3aPRUw.woff2","./assets/inter-latin-ext-400-normal-C1nco2VV.woff2","./assets/inter-latin-ext-500-normal-CV4jyFjo.woff2","./assets/inter-latin-ext-600-normal-D2bJ5OIk.woff2","./assets/inter-latin-ext-700-normal-Ca8adRJv.woff2","./assets/web-BlwGA7I0.js","./assets/web-Dlta8oCB.js","./assets/web-hMuhexwd.js","./icon-192.png","./icon-512.png","./icon-maskable-512.png","./icon.svg","./manifest.webmanifest"]

const APP = `calmpass-app-${VERSION}`
const TILES = 'calmpass-tiles'
const MAX_TILES = 600
const SHELL = ['./', './index.html', ...PRECACHE]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(APP).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('calmpass-app-') && k !== APP).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

async function trimTiles() {
  const cache = await caches.open(TILES)
  const keys = await cache.keys()
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_TILES))) await cache.delete(k)
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  // Map tiles: cache first.
  if (url.hostname.endsWith('tile.openstreetmap.org')) {
    event.respondWith(
      caches.open(TILES).then(async (cache) => {
        const hit = await cache.match(req)
        if (hit) return hit
        const res = await fetch(req)
        // Only real (CORS) responses: opaque ones count as ~7 MB each against storage limits.
        if (res.ok) {
          cache.put(req, res.clone())
          trimTiles()
        }
        return res
      }),
    )
    return
  }

  if (url.origin !== self.location.origin) return // searches etc.: network only

  // The page itself: network first, saved copy when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          caches.open(APP).then((c) => c.put('./index.html', res.clone()))
          return res
        })
        .catch(() => caches.match('./index.html')),
    )
    return
  }

  // Everything else from our own site: saved copy first, then network (and save it).
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) caches.open(APP).then((c) => c.put(req, res.clone()))
          return res
        }),
    ),
  )
})
