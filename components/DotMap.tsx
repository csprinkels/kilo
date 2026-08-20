"use client";
import { useEffect, useState } from "react";

type Coast = { type: "MultiPolygon"; coordinates: [number, number][][][] };
let coastCache: Coast | null = null;
/** One ink dot: `r` in viewBox units (bigger = bigger thing), `opacity` 0–1 (lighter = older). */
export type Dot = { id: string; lat: number; lon: number; r: number; opacity?: number };

/** Main Hawaiian Islands with ink dots (quakes, sirens…). Not tappable. Fixed bounds; no tiles; works offline once the coastline is cached. */
export default function DotMap({ dots, caption, label = "Map of the Hawaiian Islands", className }: { dots: Dot[]; caption?: string; label?: string; className?: string }) {
  const [coast, setCoast] = useState<Coast | null>(coastCache);
  useEffect(() => {
    if (coastCache) return;
    fetch("/hawaii-coast.json").then((r) => r.json()).then((c) => { coastCache = c; setCoast(c); }).catch(() => {});
  }, []);
  const W = 800, H = 440;
  const minLon = -160.6, maxLon = -154.5, minLat = 18.7, maxLat = 22.5;
  const kx = Math.cos(20.6 * Math.PI / 180);
  const s = Math.min(W / ((maxLon - minLon) * kx), H / (maxLat - minLat));
  const ox = (W - (maxLon - minLon) * kx * s) / 2, oy = (H - (maxLat - minLat) * s) / 2;
  const f = (lon: number, lat: number): [number, number] => [ox + (lon - minLon) * kx * s, oy + (maxLat - lat) * s];
  const path = (coords: [number, number][]) => coords.map(([lon, lat], i) => `${i ? "L" : "M"}${f(lon, lat).map((n) => n.toFixed(1)).join(",")}`).join(" ") + "Z";
  return (
    <figure className={className}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={label}>
        <rect width={W} height={H} fill="var(--surface)" />
        {coast?.coordinates.map((poly, i) => <path key={i} d={path(poly[0])} fill="var(--surface-2)" stroke="var(--ink-2)" strokeWidth={1} />)}
        {dots.map((d) => {
          const [x, y] = f(d.lon, d.lat);
          return <circle key={d.id} cx={x} cy={y} r={d.r} fill="var(--ink)" fillOpacity={d.opacity ?? 0.9} stroke="var(--surface)" strokeWidth={1} />;
        })}
      </svg>
      {caption && <figcaption className="px-s4 py-s3 text-small text-ink-2">{caption}</figcaption>}
    </figure>
  );
}
