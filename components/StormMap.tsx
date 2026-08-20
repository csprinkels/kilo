"use client";
import { useEffect, useMemo, useState } from "react";
import { categoryOf, conePolygon, type Storm } from "@/lib/storm";
import { fmtDayTime } from "@/lib/brand";

type Coast = { type: "MultiPolygon"; coordinates: [number, number][][][] };
let coastCache: Coast | null = null;

export const CAT_COLOR: Record<number, string> = {
  [-1]: "#7c8796", 0: "#d9a400", 1: "#f08a24", 2: "#e4632a", 3: "#d23c2a", 4: "#a8142d", 5: "#7b1fa2",
};
export const catColor = (windKt: number, cls?: string) => CAT_COLOR[categoryOf(windKt, cls).level];

type Props = {
  storm: Storm;
  place?: { lat: number; lon: number; label: string };
  selected?: number;               // index into [now, ...forecast]
  onSelect?: (i: number) => void;
  compact?: boolean;
  className?: string;
};

export default function StormMap({ storm, place, selected = 0, onSelect, compact, className }: Props) {
  const [coast, setCoast] = useState<Coast | null>(coastCache);
  useEffect(() => {
    if (coastCache) return;
    fetch("/hawaii-coast.json").then((r) => r.json()).then((c) => { coastCache = c; setCoast(c); }).catch(() => {});
  }, []);

  const W = 800, H = compact ? 420 : 560;
  const points = useMemo(() => [{ hour: 0, at: storm.issuedAt, lat: storm.lat, lon: storm.lon, windKt: storm.windKt, outlook: false }, ...storm.forecast], [storm]);
  const cone = useMemo(() => conePolygon(points), [points]);

  // Bounds: main islands + the decision window of the forecast, padded. The past track and far outlook
  // points are still drawn (SVG clips them) but don't drive the zoom, or the islands shrink to specks.
  // Equirectangular with cos(lat) x-scale is fine at these latitudes.
  const proj = useMemo(() => {
    let minLon = -160.6, maxLon = -154.6, minLat = 18.6, maxLat = 22.4;
    const eat = (lon: number, lat: number) => { minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon); minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat); };
    const islandsLat = 20.5, islandsLon = -157.5;
    const d2 = (p: { lat: number; lon: number }) => (p.lat - islandsLat) ** 2 + ((p.lon - islandsLon) * 0.94) ** 2;
    const dNow = d2(points[0]);
    const inWindow = points.filter((p) => p.hour <= 72 || d2(p) < dNow); // later points only if they come closer than today
    for (const p of inWindow) eat(p.lon, p.lat);
    const lastHour = inWindow[inWindow.length - 1].hour;
    for (const [lon, lat] of conePolygon(points.filter((p) => p.hour <= lastHour))) eat(lon, lat);
    if (place) eat(place.lon, place.lat);
    const padLon = (maxLon - minLon) * 0.08 + 0.5, padLat = (maxLat - minLat) * 0.12 + 0.5;
    minLon -= padLon; maxLon += padLon; minLat -= padLat; maxLat += padLat;
    const kx = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
    const s = Math.min(W / ((maxLon - minLon) * kx), H / (maxLat - minLat));
    const ox = (W - (maxLon - minLon) * kx * s) / 2, oy = (H - (maxLat - minLat) * s) / 2;
    const f = (lon: number, lat: number): [number, number] => [ox + (lon - minLon) * kx * s, oy + (maxLat - lat) * s];
    return { f, minLon, maxLon, minLat, maxLat, nmPerPx: 60 / s };
  }, [points, place, H]);

  const { f } = proj;
  const path = (coords: [number, number][]) => coords.map(([lon, lat], i) => `${i ? "L" : "M"}${f(lon, lat).map((n) => n.toFixed(1)).join(",")}`).join(" ") + "Z";
  const line = (pts: { lon: number; lat: number }[]) => pts.map((p, i) => `${i ? "L" : "M"}${f(p.lon, p.lat).map((n) => n.toFixed(1)).join(",")}`).join(" ");

  const grat: number[] = [];
  for (let g = Math.ceil(proj.minLon / 5) * 5; g <= proj.maxLon; g += 5) grat.push(g);
  const gratLat: number[] = [];
  for (let g = Math.ceil(proj.minLat / 5) * 5; g <= proj.maxLat; g += 5) gratLat.push(g);

  const past = storm.track.filter((t) => t.adv < storm.advNum).sort((a, b) => a.at - b.at);
  const sel = points[Math.min(selected, points.length - 1)];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`block h-auto w-full ${className ?? ""}`} role="img" aria-label={`Map of ${storm.name} track and forecast cone`}>
      <rect width={W} height={H} fill="var(--surface)" />
      {grat.map((g) => { const [x] = f(g, 0); return <g key={`lon${g}`}><line x1={x} y1={0} x2={x} y2={H} stroke="var(--line)" strokeWidth={1} /><text x={x + 4} y={H - 6} fontSize={11} fill="var(--muted)">{Math.abs(g)}°W</text></g>; })}
      {gratLat.map((g) => { const [, y] = f(0, g); return <g key={`lat${g}`}><line x1={0} y1={y} x2={W} y2={y} stroke="var(--line)" strokeWidth={1} /><text x={6} y={y - 4} fontSize={11} fill="var(--muted)">{g}°N</text></g>; })}

      {cone.length > 2 && <path d={path(cone)} fill="var(--brand)" fillOpacity={0.13} stroke="var(--brand)" strokeOpacity={0.6} strokeWidth={1.5} strokeDasharray="6 4" />}

      {coast?.coordinates.map((poly, i) => <path key={i} d={path(poly[0])} fill="var(--ink-2)" fillOpacity={0.55} stroke="var(--ink)" strokeWidth={0.8} />)}

      {past.length > 0 && <path d={line([...past, points[0]])} fill="none" stroke="var(--muted)" strokeWidth={2} strokeDasharray="3 5" />}
      {past.map((t) => { const [x, y] = f(t.lon, t.lat); return <circle key={t.adv} cx={x} cy={y} r={3.5} fill={catColor(t.windKt, t.cls)} stroke="var(--surface)" strokeWidth={1} />; })}

      <path d={line(points)} fill="none" stroke="var(--ink)" strokeWidth={2.5} strokeLinejoin="round" />
      {points.map((p, i) => {
        const [x, y] = f(p.lon, p.lat);
        const isSel = i === selected, isNow = i === 0;
        const r = isNow ? 9 : p.outlook ? 6 : 7;
        const label = isNow ? "Now" : fmtDayTime(p.at);
        // Label sits perpendicular to the local track direction, alternating sides, so a north-running track doesn't stack labels.
        const [px0, py0] = f(points[Math.max(0, i - 1)].lon, points[Math.max(0, i - 1)].lat);
        const [px1, py1] = f(points[Math.min(points.length - 1, i + 1)].lon, points[Math.min(points.length - 1, i + 1)].lat);
        const len = Math.hypot(px1 - px0, py1 - py0) || 1;
        const side = i % 2 === 0 ? 1 : -1;
        const nx = (-(py1 - py0) / len) * side, ny = ((px1 - px0) / len) * side;
        const lx = x + nx * (r + 14), ly = y + ny * (r + 14) + 4;
        const anchor = Math.abs(nx) < 0.3 ? "middle" : nx > 0 ? "start" : "end";
        return (
          <g key={i} onClick={() => onSelect?.(i)} style={{ cursor: onSelect ? "pointer" : "default" }}>
            {isNow && <circle cx={x} cy={y} r={18} fill={catColor(p.windKt, storm.cls)} opacity={0.25}><animate attributeName="r" values="12;26;12" dur="2.4s" repeatCount="indefinite" /><animate attributeName="opacity" values="0.35;0;0.35" dur="2.4s" repeatCount="indefinite" /></circle>}
            {isSel && <circle cx={x} cy={y} r={r + 6} fill="none" stroke="var(--ink)" strokeWidth={2} />}
            <circle cx={x} cy={y} r={r} fill={catColor(p.windKt, isNow ? storm.cls : undefined)} stroke="var(--surface)" strokeWidth={2} />
            {!compact && (
              <text x={lx} y={ly} fontSize={12} fontWeight={isSel ? 700 : 500} textAnchor={anchor} fill="var(--ink)" stroke="var(--surface)" strokeWidth={3} paintOrder="stroke">{label}</text>
            )}
          </g>
        );
      })}

      {place && (() => { const [x, y] = f(place.lon, place.lat); return (
        <g>
          <circle cx={x} cy={y} r={5} fill="var(--brand)" stroke="var(--surface)" strokeWidth={2} />
          <text x={x} y={y + 20} fontSize={12} fontWeight={600} textAnchor="middle" fill="var(--brand)" stroke="var(--surface)" strokeWidth={3} paintOrder="stroke">{place.label}</text>
        </g>
      ); })()}

      {/* Scale bar: 200 nautical miles */}
      {(() => { const px = 200 / proj.nmPerPx; const x0 = W - px - 16, y0 = H - 18; return (
        <g><line x1={x0} y1={y0} x2={x0 + px} y2={y0} stroke="var(--ink)" strokeWidth={2} /><text x={x0 + px / 2} y={y0 - 5} fontSize={11} textAnchor="middle" fill="var(--muted)">230 mi</text></g>
      ); })()}
      {!compact && sel && <title>{`${storm.name} · ${fmtDayTime(sel.at)}`}</title>}
    </svg>
  );
}
