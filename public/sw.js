// App shell: cache-first for same-origin pages/assets so the UI opens with zero signal.
// Data JSON is fetched by the page itself (lib/data.ts) with its own localStorage fallback.
const SHELL = "shell-v8";
const PAGES = ["/", "/sources/", "/storms/", "/traffic/", "/weather/", "/quakes/", "/volcano/", "/tsunami/", "/report/", "/manifest.webmanifest", "/icon-192.png", "/hawaii-coast.json", "/hawaii-roads.json", "/maui-roads.json", "/oahu-roads.json", "/kauai-roads.json",
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
