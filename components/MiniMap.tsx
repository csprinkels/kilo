"use client";
import { useEffect, useState } from "react";
import type { Mark } from "@/lib/feed";
import type { Island } from "@/lib/types";

type IslandId = Exclude<Island, "state">;
type Coast = { type: "MultiPolygon"; coordinates: [number, number][][][] };

// One fetch for the whole session, shared with DotMap's copy; the service worker keeps it offline.
let coastCache: Coast | null = null;
const waiting: ((c: Coast) => void)[] = [];
function useCoast(): Coast | null {
  const [coast, setCoast] = useState<Coast | null>(coastCache);
  useEffect(() => {
    if (coastCache) return;
    waiting.push(setCoast);
    if (waiting.length > 1) return; // a fetch is already in flight
    fetch("/hawaii-coast.json").then((r) => r.json()).then((c: Coast) => {
      coastCache = c;
      waiting.splice(0).forEach((fn) => fn(c));
    }).catch(() => { waiting.length = 0; });
  }, []);
  return coast;
}

/** [south, north, west, east] per island — the same frames RoadMap draws to. */
const FRAME: Record<IslandId, [number, number, number, number]> = {
  hawaii: [18.85, 20.33, -156.15, -154.73], maui: [20.45, 21.3, -157.4, -155.9],
  oahu: [21.2, 21.77, -158.35, -157.58], kauai: [21.8, 22.3, -159.88, -159.22],
};

/**
 * The 56px picture beside a feed row: the island, and the one thing the row is about.
 * A storm sits far offshore, so the frame widens to hold it rather than cropping it away —
 * the whole point of the picture is how far out the thing is.
 */
export default function MiniMap({ island, mark, size = 56 }: { island: IslandId; mark: Mark; size?: number }) {
  const coast = useCoast();
  const [s0, n0, w0, e0] = FRAME[island];
  let [s, n, w, e] = [s0, n0, w0, e0];

  const pts: [number, number][] = mark.kind === "path" ? mark.path.map(([la, lo]) => [la, lo]) : [[mark.lat, mark.lon]];
  for (const [la, lo] of pts) { s = Math.min(s, la); n = Math.max(n, la); w = Math.min(w, lo); e = Math.max(e, lo); }
  const padLat = (n - s) * 0.08, padLon = (e - w) * 0.08;
  s -= padLat; n += padLat; w -= padLon; e += padLon;

  const V = 100;
  const kx = Math.cos(((s + n) / 2) * Math.PI / 180);
  const scale = Math.min(V / ((e - w) * kx), V / (n - s));
  const ox = (V - (e - w) * kx * scale) / 2, oy = (V - (n - s) * scale) / 2;
  const f = (lat: number, lon: number): [number, number] => [ox + (lon - w) * kx * scale, oy + (n - lat) * scale];
  const d = (ring: [number, number][]) =>
    ring.map(([lo, la], i) => `${i ? "L" : "M"}${f(la, lo).map((v) => v.toFixed(1)).join(",")}`).join("") + "Z";

  return (
    <svg viewBox={`0 0 ${V} ${V}`} width={size} height={size} role="img" aria-hidden focusable="false" className="cs-mini">
      <rect width={V} height={V} fill="var(--map-water)" />
      {coast?.coordinates.map((poly, i) => (
        <path key={i} d={d(poly[0])} fill="var(--map-land)" stroke="var(--map-coast)" strokeWidth={0.8} />
      ))}
      {mark.kind === "path" ? (
        <path d={mark.path.map(([la, lo], i) => `${i ? "L" : "M"}${f(la, lo).map((v) => v.toFixed(1)).join(",")}`).join("")}
          fill="none" stroke="var(--danger)" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <>
          <circle cx={f(mark.lat, mark.lon)[0]} cy={f(mark.lat, mark.lon)[1]} r={9} fill="var(--danger)" fillOpacity={0.18} />
          <circle cx={f(mark.lat, mark.lon)[0]} cy={f(mark.lat, mark.lon)[1]} r={4} fill="var(--danger)" />
        </>
      )}
    </svg>
  );
}
