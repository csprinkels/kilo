"use client";
import { useEffect, useState } from "react";
import { PLACES, type LatLon, type RoadLine } from "@/lib/roads";

type Coast = { type: "MultiPolygon"; coordinates: [number, number][][][] };
type Roads = { lines: RoadLine[] };
type IslandId = "hawaii" | "maui" | "oahu" | "kauai";

/** A road that is closed (county, red, solid), partly closed (roadwork, orange dashes) or a single trouble spot (dot). */
export type Segment = { key: string; kind: "closed" | "lane" | "spot"; path?: LatLon[]; lat?: number; lon?: number; approx?: boolean };

// One fetch per file per session; the service worker keeps them for offline.
const cache = new Map<string, unknown>();
export function useStatic<T>(url: string): T | null {
  const [v, setV] = useState<T | null>((cache.get(url) as T) ?? null);
  useEffect(() => {
    if (cache.has(url)) return;
    fetch(url).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j) { cache.set(url, j); setV(j); } }).catch(() => {});
  }, [url]);
  return v;
}
/** The island's highway pack (names, route numbers, simplified paths), or null until it loads. */
export const useRoads = (island: IslandId) => useStatic<Roads>(`/${island}-roads.json`);

/** Whole-island frames: [south, north, west, east]. Niʻihau and the far northwest islets are left out on purpose. */
const FRAME: Record<IslandId, [number, number, number, number]> = {
  hawaii: [18.85, 20.33, -156.15, -154.73], maui: [20.45, 21.3, -157.4, -155.9], oahu: [21.2, 21.77, -158.35, -157.58], kauai: [21.8, 22.3, -159.88, -159.22],
};
const W = 800;
const MILE_LAT = 1 / 69; // degrees of latitude per mile

/** Fit a lat/lon box into the picture: pad, then widen or heighten so the box fills the SVG without stretching. */
function frameFor(box: [number, number, number, number], aspect: number) {
  let [s, n, w, e] = box;
  const kx = Math.cos(((s + n) / 2) * (Math.PI / 180));
  const want = (n - s) / ((e - w) * kx); // height ÷ width in projected units
  if (want < aspect) { const h = (e - w) * kx * aspect, c = (s + n) / 2; s = c - h / 2; n = c + h / 2; }
  else { const ww = (n - s) / aspect / kx, c = (w + e) / 2; w = c - ww / 2; e = c + ww / 2; }
  return { s, n, w, e, kx };
}

/**
 * The Roads picture: coastline, grey highways, town names, and every closed road drawn on top.
 * `focus` zooms to one segment with about 3 miles of road around it. `detour` draws the county's named alternate route in the accent colour.
 * `you` marks the reader's own spot when they asked for it. Renders with coast only if a roads file is missing.
 */
export default function RoadMap({ island, segments, focus, detour, you, label }: { island: IslandId; segments: Segment[]; focus?: LatLon[]; detour?: RoadLine[]; you?: LatLon; label: string }) {
  const coast = useStatic<Coast>("/hawaii-coast.json");
  const roads = useRoads(island);

  let box = FRAME[island];
  if (focus?.length) {
    const lats = focus.map((p) => p[0]), lons = focus.map((p) => p[1]);
    const pad = 3 * MILE_LAT, kpad = pad / Math.cos(lats[0] * (Math.PI / 180));
    box = [Math.min(...lats) - pad, Math.max(...lats) + pad, Math.min(...lons) - kpad, Math.max(...lons) + kpad];
    // If the detour runs outside the zoomed frame, widen the frame to reach its nearest point so "the blue line" is visible.
    const pts = (detour ?? []).flatMap((l) => l.p);
    if (pts.length && !pts.some(([la, lo]) => la > box[0] && la < box[1] && lo > box[2] && lo < box[3])) {
      const c: LatLon = [(box[0] + box[1]) / 2, (box[2] + box[3]) / 2];
      const near = pts.reduce((a, b) => (Math.hypot(b[0] - c[0], b[1] - c[1]) < Math.hypot(a[0] - c[0], a[1] - c[1]) ? b : a));
      box = [Math.min(box[0], near[0] - pad), Math.max(box[1], near[0] + pad), Math.min(box[2], near[1] - kpad), Math.max(box[3], near[1] + kpad)];
    }
  }
  const kx0 = Math.cos(((box[0] + box[1]) / 2) * (Math.PI / 180));
  const natural = (box[1] - box[0]) / ((box[3] - box[2]) * kx0);
  const aspect = focus ? 0.62 : Math.min(1, Math.max(0.55, natural)); // a zoomed segment is a wide picture; an island keeps its shape
  const H = Math.round(W * aspect);
  const { s, n, w, e, kx } = frameFor(box, aspect);
  const sc = W / ((e - w) * kx);
  const f = (lat: number, lon: number): [number, number] => [(lon - w) * kx * sc, (n - lat) * sc];
  const d = (pts: LatLon[], close = false) => pts.map(([lat, lon], i) => `${i ? "L" : "M"}${f(lat, lon).map((v) => v.toFixed(1)).join(",")}`).join(" ") + (close ? "Z" : "");
  const inside = (lat: number, lon: number) => lat > s && lat < n && lon > w && lon < e;

  const places = PLACES.filter((p) => p.island === island && (focus ? inside(p.lat, p.lon) : p.big));
  const lines = segments.filter((g) => g.path && g.path.length >= 2);
  const spots = segments.filter((g) => !(g.path && g.path.length >= 2) && g.lat != null && g.lon != null && inside(g.lat, g.lon));

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={label}>
        <rect width={W} height={H} fill="var(--surface)" />
        {coast?.coordinates.map((poly, i) => <path key={i} d={d(poly[0].map(([lon, lat]) => [lat, lon]), true)} fill="var(--surface-2)" stroke="var(--ink-2)" strokeOpacity={0.5} strokeWidth={1.5} />)}
        {roads?.lines.map((l, i) => <path key={i} d={d(l.p)} fill="none" stroke="var(--ink-2)" strokeOpacity={0.55} strokeWidth={focus ? 4 : 2.5} strokeLinejoin="round" strokeLinecap="round" />)}
        {detour?.map((l, i) => <path key={`d${i}`} d={d(l.p)} fill="none" stroke="var(--brand)" strokeWidth={focus ? 8 : 5} strokeLinejoin="round" strokeLinecap="round" />)}
        {lines.filter((g) => g.kind === "lane").map((g) => <path key={g.key} d={d(g.path!)} fill="none" stroke="var(--warn)" strokeWidth={focus ? 7 : 5} strokeDasharray="12 9" strokeLinecap="round" strokeLinejoin="round" />)}
        {lines.filter((g) => g.kind === "closed").map((g) => <path key={g.key} d={d(g.path!)} fill="none" stroke="var(--danger)" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />)}
        {spots.map((g) => { const [x, y] = f(g.lat!, g.lon!); const c = g.kind === "lane" ? "var(--warn)" : "var(--danger)"; return g.approx
          ? <circle key={g.key} cx={x} cy={y} r={16} fill={c} fillOpacity={0.25} stroke={c} strokeWidth={2} strokeDasharray="4 4" />  /* "about here": neighborhood only */
          : <circle key={g.key} cx={x} cy={y} r={9} fill={c} stroke="var(--surface)" strokeWidth={3} />; })}
        {places.map((p) => { const [x, y] = f(p.lat, p.lon); return <circle key={p.name} cx={x} cy={y} r={4} fill="var(--ink)" />; })}
        {you && inside(you[0], you[1]) && (() => { const [x, y] = f(you[0], you[1]); return <g><circle cx={x} cy={y} r={14} fill="var(--brand)" fillOpacity={0.2} /><circle cx={x} cy={y} r={7} fill="var(--brand)" stroke="var(--surface)" strokeWidth={3} /></g>; })()}
      </svg>
      {/* Town names as HTML so they follow the reader's text size instead of the picture's scale */}
      {places.map((p) => {
        const [x, y] = f(p.lat, p.lon);
        const px = x / W; // names near an edge hang inward so the picture's edge never cuts them
        const pos = px < 0.15 ? { left: `${px * 100}%` } : px > 0.85 ? { right: `${(1 - px) * 100}%` } : { left: `${px * 100}%`, transform: "translateX(-50%)" };
        return <span key={p.name} className="pointer-events-none absolute whitespace-nowrap text-small font-semibold text-ink" style={{ ...pos, top: `${(y / H) * 100}%`, marginTop: "0.4rem", textShadow: "0 0 4px var(--surface), 0 0 4px var(--surface)" }}>{p.name}</span>;
      })}
    </div>
  );
}
