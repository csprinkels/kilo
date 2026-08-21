// App shell: cache-first for same-origin pages/assets so the UI opens with zero signal.
// Data JSON is fetched by the page itself (lib/data.ts) with its own localStorage fallback.
const SHELL = "shell-v10";
// Big, rarely-changing map data lives in its own cache. Bumping SHELL must never cost someone the evacuation
// zones they will need with no signal — and `alerts` (the last push digest, which the page renders offline)
// is spared for the same reason. Anything NOT in this list is an old shell and gets swept on activate.
const PACKS = "packs-v1";
// Street-map tiles you have already seen (Roads page) stay for offline; capped so they never crowd the phone.
const TILES = "tiles-v1";
const TILE_HOST = /\.basemaps\.cartocdn\.com$/;
const TILE_CAP = 600;
const KEEP = [SHELL, PACKS, "alerts", TILES];
const PACK_URL = /^\/(?:zones\/[a-z]+\.json|[a-z]+-roads\.json|hawaii-coast\.json)$/;
const PACK_FILES = ["/hawaii-coast.json", "/hawaii-roads.json", "/maui-roads.json", "/oahu-roads.json", "/kauai-roads.json"];
const PAGES = ["/", "/sources/", "/storms/", "/traffic/", "/weather/", "/quakes/", "/volcano/", "/tsunami/", "/report/", "/manifest.webmanifest", "/icon-192.png",
  "/maps/hawaii-terrain.png", "/maps/hawaii-streets.png", "/maps/maui-terrain.png", "/maps/maui-streets.png", "/maps/oahu-terrain.png", "/maps/oahu-streets.png", "/maps/kauai-terrain.png", "/maps/kauai-streets.png",
  "/icons/weather/clear-day.svg", "/icons/weather/clear-night.svg", "/icons/weather/partly-cloudy-day.svg", "/icons/weather/partly-cloudy-night.svg", "/icons/weather/overcast-day.svg", "/icons/weather/overcast-night.svg", "/icons/weather/overcast.svg", "/icons/weather/partly-cloudy-day-drizzle.svg", "/icons/weather/partly-cloudy-night-drizzle.svg", "/icons/weather/partly-cloudy-day-rain.svg", "/icons/weather/partly-cloudy-night-rain.svg", "/icons/weather/rain.svg", "/icons/weather/thunderstorms-day-rain.svg", "/icons/weather/thunderstorms-night-rain.svg", "/icons/weather/fog-day.svg", "/icons/weather/fog-night.svg", "/icons/weather/wind.svg", "/icons/weather/hurricane.svg", "/icons/weather/sunrise.svg", "/icons/weather/sunset.svg", "/icons/weather/raindrop.svg", "/icons/weather/humidity.svg", "/icons/weather/uv-index.svg", "/icons/topic/road.svg", "/icons/topic/quake.svg", "/icons/topic/volcano.svg", "/icons/topic/tsunami.svg", "/icons/topic/neighbors.svg", "/icons/topic/shelter.svg", "/icons/topic/school.svg", "/icons/topic/power.svg", "/icons/topic/alert.svg", "/icons/topic/storm.svg", "/icons/topic/air.svg"];

// Precache the pages plus every /_next/static asset they reference, so a first-visit-then-offline reload still hydrates.
async function precache() {
  const c = await caches.open(SHELL);
  await c.addAll(PAGES);
  const assets = new Set();
  for (const p of ["/", "/sources/", "/storms/", "/traffic/", "/weather/", "/quakes/", "/volcano/", "/tsunami/", "/report/"]) {
    const html = await (await c.match(p)).text();
    for (const m of html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)) assets.add(m[1]);
  }
  await c.addAll([...assets]);
  // Map packs are best-effort and one at a time: a single missing file must not take the whole shell down.
  // Evacuation zones are fetched on demand into the same cache (see PACK_URL) and survive shell updates.
  const packs = await caches.open(PACKS);
  await Promise.allSettled(PACK_FILES.map((u) => packs.add(u)));
}

self.addEventListener("install", (e) => e.waitUntil(precache().then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (TILE_HOST.test(url.hostname)) {
    // Cache-first: a tile never changes enough to matter, and a cached tile is a road you can still see with no signal.
    e.respondWith(caches.open(TILES).then(async (c) => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok) {
        c.put(e.request, res.clone());
        c.keys().then((ks) => { if (ks.length > TILE_CAP) ks.slice(0, ks.length - TILE_CAP).forEach((k) => c.delete(k)); });
      }
      return res;
    }));
    return;
  }
  if (url.origin !== self.location.origin) return;
  // Pages: network first, so a new version shows on the next visit instead of the one after it.
  // The saved copy is still there the moment the network fails, which is the whole point of this app.
  if (e.request.mode === "navigate") {
    e.respondWith((async () => {
      const c = await caches.open(SHELL);
      try {
        const res = await fetch(e.request);
        if (res.ok) c.put(e.request, res.clone());
        return res;
      } catch {
        return (await c.match(e.request, { ignoreSearch: true })) || (await c.match("/")) || Response.error();
      }
    })());
    return;
  }
  // Stale-while-revalidate: serve cached shell instantly, refresh it in the background.
  e.respondWith(
    caches.open(PACK_URL.test(url.pathname) ? PACKS : SHELL).then(async (c) => {
      const cached = await c.match(e.request, { ignoreSearch: true });
      const net = fetch(e.request).then((res) => { if (res.ok) c.put(e.request, res.clone()); return res; }).catch(() => cached);
      return cached || net;
    }),
  );
});

// ---- Web Push: the notification IS the article. Store the digest so the app renders it with zero network. ----
self.addEventListener("push", (e) => {
  let p = null;
  try { p = e.data ? e.data.json() : null; } catch { p = null; }
  if (!p || !p.notification) return; // declarative payloads on Safari are shown by the system without us
  const n = p.notification;
  const work = (async () => {
    if (p.digest) {
      const c = await caches.open("alerts");
      await c.put(`/alerts/${p.digest.island}`, new Response(JSON.stringify(p.digest), { headers: { "Content-Type": "application/json" } }));
    }
    await self.registration.showNotification(n.title, {
      body: n.body, tag: n.tag, renotify: true, icon: "/icon-192.png", badge: "/icon-192.png", lang: n.lang || "en",
      data: { navigate: n.navigate || "/" },
    });
  })();
  e.waitUntil(work);
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.navigate || "/", self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    const open = list.find((c) => c.url.startsWith(self.location.origin));
    return open ? open.navigate(url).then((c) => c && c.focus()) : self.clients.openWindow(url);
  }));
});
