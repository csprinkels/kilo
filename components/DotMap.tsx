"use client";
import { useEffect, useState } from "react";

type Coast = { type: "MultiPolygon"; coordinates: [number, number][][][] };
let coastCache: Coast | null = null;
export type Dot = { id: string; lat: number; lon: number; r: number; color: string; opacity?: number; label?: string };

/** Main Hawaiian Islands with dots (quakes, sirens…). Fixed bounds; no tiles; works offline once the coastline is cached. */
export default function DotMap({ dots, selected, onSelect, className }: { dots: Dot[]; selected?: string; onSelect?: (id: string) => void; className?: string }) {
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
    <svg viewBox={`0 0 ${W} ${H}`} className={`block h-auto w-full ${className ?? ""}`} role="img" aria-label="Map of the Hawaiian Islands">
      <rect width={W} height={H} fill="var(--surface)" />
      {coast?.coordinates.map((poly, i) => <path key={i} d={path(poly[0])} fill="var(--ink-2)" fillOpacity={0.5} stroke="var(--ink)" strokeWidth={0.8} />)}
      {dots.map((d) => {
        const [x, y] = f(d.lon, d.lat);
        const on = d.id === selected;
        return (
          <g key={d.id} onClick={() => onSelect?.(d.id)} style={{ cursor: onSelect ? "pointer" : "default" }}>
            {on && <circle cx={x} cy={y} r={d.r + 6} fill="none" stroke="var(--ink)" strokeWidth={2} />}
            <circle cx={x} cy={y} r={d.r} fill={d.color} fillOpacity={d.opacity ?? 0.8} stroke="var(--surface)" strokeWidth={1} />
            {d.label && <text x={x} y={y - d.r - 5} fontSize={12} fontWeight={600} textAnchor="middle" fill="var(--ink)" stroke="var(--surface)" strokeWidth={3} paintOrder="stroke">{d.label}</text>}
          </g>
        );
      })}
    </svg>
  );
}
