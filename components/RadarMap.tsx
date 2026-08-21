"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import "leaflet/dist/leaflet.css";
import { fmtTime } from "@/lib/brand";

type Frame = { time: number; path: string; future: boolean };
type Maps = { host: string; radar: { past: Frame[]; nowcast: Frame[] } };

const TILES = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
// RainViewer (free, no key): 13 frames of the past two hours every ten minutes, plus up to three of the next half hour.
// Colour scheme 2 is their "universal blue"; smoothing on, snow off. Tiles exist up to zoom 7 only, so Leaflet scales
// 512px zoom-7 tiles up for the island view (that is also why it never shows a street-level picture: there is none).
const RADAR = (host: string, path: string) => `${host}${path}/512/{z}/{x}/{y}/2/1_1.png`;

const onlineStore = {
  subscribe: (cb: () => void) => { addEventListener("online", cb); addEventListener("offline", cb); return () => { removeEventListener("online", cb); removeEventListener("offline", cb); }; },
  get: () => navigator.onLine,
};

/**
 * Rain right now, from weather radar, over the street map: blue where it is raining, darker where it is heavy.
 * A slider runs from two hours ago to now (and a little ahead when RainViewer offers it) so you can see which way it is moving.
 * Live data only: shows nothing without a signal, and the service worker never keeps radar tiles.
 */
export default function RadarMap({ lat, lon, label }: { lat: number; lon: number; label: string }) {
  const online = useSyncExternalStore(onlineStore.subscribe, onlineStore.get, () => true);
  const ref = useRef<HTMLDivElement>(null);
  const [frames, setFrames] = useState<Frame[] | null>(null);
  const [host, setHost] = useState("");
  const [at, setAt] = useState(0);
  const [failed, setFailed] = useState(false);
  const layers = useRef<import("leaflet").TileLayer[]>([]);

  // The frame list, once.
  useEffect(() => {
    let live = true;
    void Promise.resolve().then(async () => {
      try {
        const r = await fetch("https://api.rainviewer.com/public/weather-maps.json", { signal: AbortSignal.timeout(15_000) });
        const j = (await r.json()) as Maps;
        const all = [...j.radar.past.map((f) => ({ ...f, future: false })), ...(j.radar.nowcast ?? []).map((f) => ({ ...f, future: true }))];
        if (!live) return;
        setHost(j.host); setFrames(all); setAt(j.radar.past.length - 1); // start on "now"
      } catch { if (live) setFailed(true); }
    });
    return () => { live = false; };
  }, []);

  // The map and every radar layer, once the frames are known. Layers stack at opacity 0 and the slider lifts one.
  useEffect(() => {
    const el = ref.current;
    if (!el || !frames || !host) return;
    let cancelled = false;
    let map: import("leaflet").Map | undefined;
    import("leaflet").then((L) => {
      if (cancelled) return;
      const css = getComputedStyle(document.documentElement);
      map = L.map(el, { scrollWheelZoom: false, zoomSnap: 0.5, attributionControl: true });
      map.attributionControl.setPrefix(false);
      L.tileLayer(TILES, { subdomains: "abcd", maxZoom: 18, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, © CARTO · <a href="https://www.rainviewer.com/">RainViewer</a>' }).addTo(map);
      layers.current = frames.map((f) => L.tileLayer(RADAR(host, f.path), { opacity: 0, tileSize: 512, zoomOffset: -1, maxNativeZoom: 8, maxZoom: 11, zIndex: 5 }).addTo(map!));
      layers.current[frames.length - (frames.filter((f) => f.future).length) - 1]?.setOpacity(0.72);
      L.circleMarker([lat, lon], { radius: 5, color: "#fff", weight: 2, fillColor: css.getPropertyValue("--brand").trim(), fillOpacity: 1, interactive: false }).addTo(map); // small, so the town's own name still reads
      map.setView([lat, lon], 8.5);
      map.setMaxZoom(11);
    });
    return () => { cancelled = true; layers.current = []; map?.remove(); };
  }, [frames, host, lat, lon]);

  // Slider → which frame is visible.
  useEffect(() => { layers.current.forEach((l, i) => l.setOpacity(i === at ? 0.72 : 0)); }, [at]);

  if (!online || failed) return null;
  const f = frames?.[at];
  const nowIdx = frames ? frames.findIndex((x) => x.future) - 1 : -1;
  const when = !f ? "" : at === (nowIdx < 0 ? frames!.length - 1 : nowIdx) ? "Now" : f.future ? `Expected at ${fmtTime(f.time * 1000)}` : fmtTime(f.time * 1000);

  return (
    <div className="picture mt-s3">
      <div ref={ref} className="h-[20rem] w-full" role="img" aria-label={label} />
      {frames && frames.length > 1 && (
        <div className="px-s4 pb-s3 pt-s2">
          <div className="flex items-center justify-between text-small text-ink-2 num">
            <span>2 hours ago</span>
            <span className="font-semibold text-ink">{when}</span>
            <span>{frames.some((x) => x.future) ? "Next half hour" : ""}</span>
          </div>
          <input type="range" min={0} max={frames.length - 1} value={at} onChange={(e) => setAt(Number(e.target.value))} aria-label="Time" className="mt-s1 h-11 w-full accent-[var(--brand)]" />
        </div>
      )}
    </div>
  );
}
