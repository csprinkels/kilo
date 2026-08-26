"use client";
import { useEffect, useRef, useSyncExternalStore } from "react";
import "leaflet/dist/leaflet.css";
import RoadMap, { type Segment } from "./RoadMap";
import type { LatLon, RoadLine } from "@/lib/roads";

type IslandId = "hawaii" | "maui" | "oahu" | "kauai";
type Props = { island: IslandId; segments: Segment[]; focus?: LatLon[]; detour?: RoadLine[]; you?: LatLon; label: string; className?: string };

/** Whole-island views: [south, north, west, east]. */
const FRAME: Record<IslandId, [number, number, number, number]> = {
  hawaii: [18.85, 20.33, -156.15, -154.73], maui: [20.45, 21.3, -157.4, -155.9], oahu: [21.2, 21.77, -158.35, -157.58], kauai: [21.8, 22.3, -159.88, -159.22],
};
// CARTO's free OpenStreetMap tiles; the service worker keeps every tile you have seen, so a road you looked at stays on the map with no signal.
// The same light street style in dark mode (dimmed in CSS): CARTO's dark tiles show nothing at island zoom.
const TILES = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

const onlineStore = {
  subscribe: (cb: () => void) => { addEventListener("online", cb); addEventListener("offline", cb); return () => { removeEventListener("online", cb); removeEventListener("offline", cb); }; },
  get: () => navigator.onLine,
};

/**
 * A real street map (OpenStreetMap via Leaflet) with the closed roads drawn on top: red solid = closed, orange dashes = one lane,
 * blue = the county's way around, a blue dot = you. Pinch or use + / − to zoom, drag to move. With no signal it falls back to the drawn island.
 */
export default function TileMap(props: Props) {
  const online = useSyncExternalStore(onlineStore.subscribe, onlineStore.get, () => true);
  const { className: _c, ...drawn } = props; // eslint-disable-line @typescript-eslint/no-unused-vars
  if (!online) return <RoadMap {...drawn} />;
  return <Tiles {...props} />;
}

function Tiles({ island, segments, focus, detour, you, label, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  // Leaflet owns the DOM inside the div; rebuild only when what is drawn actually changes.
  const drawn = JSON.stringify({ island, segments, focus, detour, you });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    let map: import("leaflet").Map | undefined;
    import("leaflet").then((L) => {
      if (cancelled) return;
      const { segments, focus, detour, you } = JSON.parse(drawn) as Props;
      const css = getComputedStyle(document.documentElement);
      const color = (v: string) => css.getPropertyValue(v).trim();
      const halo = color("--map-mark-halo"); // the tile map is light in both schemes, but the halo is not: it is a token
      const zoomed = !!focus?.length; // marks are thinner on the whole-island view so short closures read as lines, not blobs

      map = L.map(el, { scrollWheelZoom: false, zoomSnap: 0.5 });
      map.attributionControl.setPrefix(false);
      L.tileLayer(TILES, { subdomains: "abcd", maxZoom: 18, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, © CARTO' }).addTo(map);

      for (const l of detour ?? []) L.polyline(l.p, { color: color("--brand"), weight: zoomed ? 7 : 5, opacity: 0.95 }).addTo(map);
      for (const g of segments) {
        const c = color(g.kind === "lane" ? "--warn" : "--danger");
        if (g.path && g.path.length >= 2) {
          const w = (g.kind === "lane" ? 5 : 7) - (zoomed ? 0 : 2);
          L.polyline(g.path, { color: halo, weight: w + 4, opacity: 0.9 }).addTo(map); // halo so the mark reads on any tile
          L.polyline(g.path, { color: c, weight: w, dashArray: g.kind === "lane" ? "10 8" : undefined }).addTo(map);
        } else if (g.lat != null && g.lon != null) {
          L.circleMarker([g.lat, g.lon], g.approx
            ? { radius: 16, color: c, weight: 2, dashArray: "4 4", fillColor: c, fillOpacity: 0.25 } // "about here": neighborhood only
            : { radius: zoomed ? 9 : 7, color: halo, weight: 3, fillColor: c, fillOpacity: 1 }).addTo(map);
        }
      }
      if (you) L.circleMarker(you, { radius: 9, color: halo, weight: 3, fillColor: color("--brand"), fillOpacity: 1 }).addTo(map);

      let bounds: import("leaflet").LatLngBounds;
      if (focus?.length) {
        bounds = L.latLngBounds(focus).pad(0.35);
        // Reach the nearest point of the way around so "the blue line" is always in the picture.
        const pts = (detour ?? []).flatMap((l) => l.p);
        if (pts.length && !pts.some((p) => bounds.contains(p))) {
          const c = bounds.getCenter();
          bounds.extend(pts.reduce((a, b) => (c.distanceTo(b) < c.distanceTo(a) ? b : a)));
        }
      } else {
        const [s, n, w, e] = FRAME[island];
        bounds = L.latLngBounds([s, w], [n, e]);
      }
      map.fitBounds(bounds, { padding: [12, 12] });
    });
    return () => { cancelled = true; map?.remove(); };
  }, [island, drawn]);

  return <div ref={ref} className={`w-full ${className ?? "h-[22rem]"}`} role="img" aria-label={label} />;
}
