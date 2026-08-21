"use client";
import { useEffect, useMemo, useState } from "react";
import { conePolygon, type Storm } from "@/lib/storm";
import { fmtDayTime } from "@/lib/brand";

type Coast = { type: "MultiPolygon"; coordinates: [number, number][][][] };
let coastCache: Coast | null = null;

type Props = {
  storm: Storm;
  place?: { lat: number; lon: number; label: string };
  compact?: boolean;
  className?: string;
};

/** Monochrome track + cone. Labels are HTML (not SVG text) so they follow the user's text size. */
export default function StormMap({ storm, place, compact, className }: Props) {
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
    return { f, nmPerPx: 60 / s };
  }, [points, place, H]);

  const { f } = proj;
  const path = (coords: [number, number][]) => coords.map(([lon, lat], i) => `${i ? "L" : "M"}${f(lon, lat).map((n) => n.toFixed(1)).join(",")}`).join(" ") + "Z";
  const line = (pts: { lon: number; lat: number }[]) => pts.map((p, i) => `${i ? "L" : "M"}${f(p.lon, p.lat).map((n) => n.toFixed(1)).join(",")}`).join(" ");

  const past = storm.track.filter((t) => t.adv < storm.advNum).sort((a, b) => a.at - b.at);
  const last = points[points.length - 1];
  const [nowX, nowY] = f(points[0].lon, points[0].lat);
  const [lastX, lastY] = f(last.lon, last.lat);
  const [placeX, placeY] = place ? f(place.lon, place.lat) : [NaN, NaN];
  const nearPlace = Math.hypot(nowX - placeX, nowY - placeY) < 200; // labels would collide; the pulsing ring still says "now"
  const scalePx = 200 / 1.15078 / proj.nmPerPx; // 200 statute miles

  return (
    <div className={`relative ${className ?? ""}`}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`Map of ${storm.name}: where it is and where the center will probably go`}>
        <rect width={W} height={H} fill="var(--surface)" />
        {cone.length > 2 && <path d={path(cone)} fill="var(--brand)" fillOpacity={0.15} stroke="var(--brand)" strokeOpacity={0.6} strokeWidth={1.5} strokeDasharray="6 4" />}
        {coast?.coordinates.map((poly, i) => <path key={i} d={path(poly[0])} fill="var(--ink-2)" fillOpacity={0.55} stroke="var(--ink)" strokeWidth={0.8} />)}

        {past.length > 0 && <path d={line([...past, points[0]])} fill="none" stroke="var(--ink-2)" strokeWidth={2} strokeDasharray="3 5" />}
        {past.map((t) => { const [x, y] = f(t.lon, t.lat); return <circle key={t.adv} cx={x} cy={y} r={3} fill="var(--ink-2)" />; })}

        <path d={line(points)} fill="none" stroke="var(--ink)" strokeWidth={2.5} strokeLinejoin="round" />
        {points.map((p, i) => {
          const [x, y] = f(p.lon, p.lat);
          const r = 4 + Math.min(p.windKt, 140) / 14; // dot size says how strong the wind is
          return (
            <g key={i}>
              {i === 0 && <circle cx={x} cy={y} r={18} fill="var(--ink)" opacity={0.25}><animate attributeName="r" values="12;26;12" dur="2.4s" repeatCount="indefinite" /><animate attributeName="opacity" values="0.35;0;0.35" dur="2.4s" repeatCount="indefinite" /></circle>}
              <circle cx={x} cy={y} r={r} fill={p.outlook ? "var(--surface)" : "var(--ink)"} stroke="var(--ink)" strokeWidth={2} />
            </g>
          );
        })}

        {place && <circle cx={placeX} cy={placeY} r={6} fill="var(--brand)" stroke="var(--surface)" strokeWidth={2} />}
      </svg>

      {/* HTML labels: real rem text, positioned by percentage so they ride along with the picture. */}
      {!nearPlace && <Label x={nowX} y={nowY} h={H} above className="font-semibold text-ink">Now</Label>}
      {!compact && storm.forecast.length > 0 && <Label x={lastX} y={lastY} h={H} className="text-ink">{fmtDayTime(last.at)}</Label>}
      {/* The island's name goes on the side away from the storm, so it never sits on the track or the cone. */}
      {place && <Label x={placeX} y={placeY} h={H} above={nowY > placeY} className="font-semibold text-brand">{place.label}</Label>}
      <p className="flex items-center justify-end gap-s2 px-s4 pb-s3 text-small text-ink-2 num"><span className="inline-block h-0.5 bg-ink" style={{ width: `${(scalePx / W) * 100}%` }} aria-hidden /> 200 miles</p>
    </div>
  );
}

/** A text label pinned to a map point; anchored so it never runs past the picture's edge. */
function Label({ x, y, h, above, className, children }: { x: number; y: number; h: number; above?: boolean; className: string; children: React.ReactNode }) {
  const W = 800, H = h;
  if (x < 0 || x > W || y < 0 || y > H) return null; // point is off the picture
  const side = x < W * 0.2 ? "start" : x > W * 0.8 ? "end" : "mid";
  const tx = side === "start" ? "0" : side === "end" ? "-100%" : "-50%";
  return (
    <span className={`pointer-events-none absolute whitespace-nowrap text-small [text-shadow:0_0_0.25rem_var(--surface)] ${className}`}
      style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%`, transform: `translate(${tx}, ${above ? "calc(-100% - 0.9rem)" : "0.7rem"})` }}>
      {children}
    </span>
  );
}
