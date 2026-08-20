// App shell: cache-first for same-origin pages/assets so the UI opens with zero signal.
// Data JSON is fetched by the page itself (lib/data.ts) with its own localStorage fallback.
const SHELL = "shell-v2";
const PAGES = ["/", "/sources/", "/manifest.webmanifest", "/icon-192.png"];

// Precache the pages plus every /_next/static asset they reference, so a first-visit-then-offline reload still hydrates.
async function precache() {
  const c = await caches.open(SHELL);
  await c.addAll(PAGES);
  const assets = new Set();
  for (const p of ["/", "/sources/"]) {
    const html = await (await c.match(p)).text();
    for (const m of html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)) assets.add(m[1]);
  }
  await c.addAll([...assets]);
}

self.addEventListener("install", (e) => e.waitUntil(precache().then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== SHELL).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  // Stale-while-revalidate: serve cached shell instantly, refresh it in the background.
  e.respondWith(
    caches.open(SHELL).then(async (c) => {
      const cached = await c.match(e.request, { ignoreSearch: true });
      const net = fetch(e.request).then((res) => { if (res.ok) c.put(e.request, res.clone()); return res; }).catch(() => cached);
      return cached || net;
    }),
  );
});
