"use client";
import { useEffect, useMemo, useState } from "react";
import { conePolygon, type Storm } from "@/lib/storm";

type Coast = { type: "MultiPolygon"; coordinates: [number, number][][][] };
let coastCache: Coast | null = null;

type Props = {
  storm: Storm;
  place?: { lat: number; lon: number; label: string };
  compact?: boolean;
  className?: string;
};

type Pt = { hour: number; at: number; lat: number; lon: number; windKt: number; outlook?: boolean };
type Mark = { x: number; y: number; above: boolean; text: string };

const HST = "Pacific/Honolulu";
const dayKey = (ms: number) => new Intl.DateTimeFormat("en-US", { timeZone: HST, weekday: "short", day: "numeric" }).format(ms);
const dayShort = (ms: number) => new Intl.DateTimeFormat("en-US", { timeZone: HST, weekday: "short" }).format(ms);

/** Picture-only: steel → gold → orange → red as the wind picks up. */
function windColor(kt: number) {
  if (kt >= 96) return "var(--storm-mh)";
  if (kt >= 64) return "var(--storm-hu)";
  if (kt >= 34) return "var(--storm-ts)";
  return "var(--storm-td)";
}

/** Ocean, sand islands, a path that is the story, dots that get hotter as the wind does. */
export default function StormMap({ storm, place, className }: Props) {
  const [coast, setCoast] = useState<Coast | null>(coastCache);
  useEffect(() => {
    if (coastCache) return;
    fetch("/hawaii-coast.json").then((r) => r.json()).then((c) => { coastCache = c; setCoast(c); }).catch(() => {});
  }, []);

  const W = 800, H = 440;
  const points: Pt[] = useMemo(
    () => [{ hour: 0, at: storm.issuedAt, lat: storm.lat, lon: storm.lon, windKt: storm.windKt, outlook: false }, ...storm.forecast],
    [storm],
  );
  const cone = useMemo(() => conePolygon(points), [points]);

  // Bounds: main islands + the decision window of the forecast, padded. The past track and far outlook
  // points are still drawn (SVG clips them) but don't drive the zoom, or the islands shrink to specks.
  const proj = useMemo(() => {
    let minLon = -160.6, maxLon = -154.6, minLat = 18.6, maxLat = 22.4;
    const eat = (lon: number, lat: number) => { minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon); minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat); };
    const islandsLat = 20.5, islandsLon = -157.5;
    const d2 = (p: { lat: number; lon: number }) => (p.lat - islandsLat) ** 2 + ((p.lon - islandsLon) * 0.94) ** 2;
    const dNow = d2(points[0]);
    const inWindow = points.filter((p) => p.hour <= 72 || d2(p) < dNow);
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
  const [nowX, nowY] = f(points[0].lon, points[0].lat);
  const scalePx = 200 / 1.15078 / proj.nmPerPx;

  const firm = points.filter((p) => !p.outlook);
  const later = points.filter((p) => p.outlook);
  const outlookRun = firm.length && later.length ? [firm[firm.length - 1], ...later] : [];

  const days = dayMarksFor(points).map((p) => {
    const [x, y] = f(p.lon, p.lat);
    return { x, y, text: dayShort(p.at) };
  });
  const labels = placeLabels(nowX, nowY, days, H);

  return (
    <div className={`relative ${className ?? ""}`}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`Map of ${storm.name}: the path it is on, and how strong the wind is along the way`}>
        <rect width={W} height={H} fill="var(--map-water)" />
        {[0.28, 0.5, 0.72].map((t) => (
          <line key={t} x1={0} y1={H * t} x2={W} y2={H * t} stroke="var(--map-water-line)" strokeWidth={1.25} />
        ))}

        {coast?.coordinates.map((poly, i) => (
          <path key={`halo-${i}`} d={path(poly[0])} fill="var(--map-land)" stroke="var(--map-shore)" strokeOpacity={0.7} strokeWidth={8} strokeLinejoin="round" />
        ))}
        {coast?.coordinates.map((poly, i) => (
          <path key={`land-${i}`} d={path(poly[0])} fill="var(--map-land)" stroke="var(--map-coast)" strokeWidth={1.4} strokeLinejoin="round" />
        ))}

        {cone.length > 2 && (
          <path d={path(cone)} fill="var(--storm-hu)" fillOpacity={0.12} stroke="var(--storm-hu)" strokeOpacity={0.55} strokeWidth={1.5} strokeDasharray="7 6" />
        )}

        {past.length > 0 && <path d={line([...past, points[0]])} fill="none" stroke="var(--map-coast)" strokeWidth={1.5} strokeDasharray="2 5" strokeLinecap="round" />}

        {firm.length > 1 && <path d={line(firm)} fill="none" stroke="var(--map-mark-halo)" strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />}
        {firm.slice(1).map((p, i) => (
          <path key={`f-${i}`} d={line([firm[i], p])} fill="none" stroke={windColor(firm[i].windKt)} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {outlookRun.length > 1 && <path d={line(outlookRun)} fill="none" stroke="var(--map-mark-halo)" strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />}
        {outlookRun.slice(1).map((p, i) => (
          <path key={`o-${i}`} d={line([outlookRun[i], p])} fill="none" stroke={windColor(outlookRun[i].windKt)} strokeWidth={2} strokeDasharray="6 7" strokeLinecap="round" strokeOpacity={0.7} />
        ))}

        {past.map((t) => {
          const [x, y] = f(t.lon, t.lat);
          return <circle key={t.adv} cx={x} cy={y} r={3} fill="var(--map-coast)" />;
        })}

        {points.map((p, i) => {
          const [x, y] = f(p.lon, p.lat);
          const r = 5 + Math.min(p.windKt, 140) / 16;
          const fill = p.outlook ? "var(--map-water)" : windColor(p.windKt);
          return (
            <g key={i}>
              {/* SMIL ignores prefers-reduced-motion; the CSS keyframe is caught by the global reset. */}
              {i === 0 && <circle className="st-pulse" cx={x} cy={y} r={17} fill={windColor(p.windKt)} />}
              <circle cx={x} cy={y} r={r} fill={fill} stroke={windColor(p.windKt)} strokeWidth={2.25} />
            </g>
          );
        })}

        {/* The scale belongs on the map. scalePx is in SVG units; below the map it was being
            used as a percentage of a text span, which is what made it collide with its label. */}
        <g transform={`translate(18 ${H - 16})`} aria-hidden>
          <line x1={0} y1={0} x2={scalePx} y2={0} stroke="var(--map-town)" strokeWidth={2.5} strokeLinecap="butt" />
          <line x1={1} y1={-5} x2={1} y2={5} stroke="var(--map-town)" strokeWidth={2.5} />
          <line x1={scalePx - 1} y1={-5} x2={scalePx - 1} y2={5} stroke="var(--map-town)" strokeWidth={2.5} />
          <text x={scalePx / 2} y={-9} textAnchor="middle" className="cs-svgt" style={{ fill: "var(--map-town)" }}
            stroke="var(--map-label-halo)" strokeWidth={3} paintOrder="stroke">200 miles</text>
        </g>
      </svg>

      {labels.map((l) => (
        <Label key={l.text} x={l.x} y={l.y} h={H} above={l.above} className="font-semibold text-ink">{l.text}</Label>
      ))}

      <p className="storm-map-key num">
        <span className="storm-map-swatches" title="Dot color is how strong the wind is">
          <i aria-hidden style={{ background: "var(--storm-td)" }} />
          <i aria-hidden style={{ background: "var(--storm-ts)" }} />
          <i aria-hidden style={{ background: "var(--storm-hu)" }} />
          <i aria-hidden style={{ background: "var(--storm-mh)" }} />
          <span className="ml-s2">weaker → stronger</span>
        </span>
      </p>
    </div>
  );
}

/** One label per new calendar day on the forecast. Tight pairs are dropped later, not shoved aside. */
function dayMarksFor(points: Pt[]): Pt[] {
  const out: Pt[] = [];
  let lastDay = dayKey(points[0].at);
  for (const p of points.slice(1)) {
    if (p.hour > 120) break;
    const d = dayKey(p.at);
    if (d === lastDay) continue;
    out.push(p);
    lastDay = d;
  }
  return out;
}

/** Sit each name on its dot. If it would collide or hang off the picture, skip it. */
function placeLabels(nowX: number, nowY: number, days: { x: number; y: number; text: string }[], H: number): Mark[] {
  const W = 800;
  const taken: Mark[] = [];
  const fits = (x: number, y: number, above: boolean) => {
    if (x < 40 || x > W - 40) return false;
    if (above && y < 32) return false;
    if (!above && y > H - 28) return false;
    const ax = x, ay = above ? y - 28 : y + 24;
    return taken.every((t) => Math.hypot(ax - t.x, ay - (t.above ? t.y - 28 : t.y + 24)) >= 96);
  };
  const add = (x: number, y: number, text: string, preferAbove: boolean) => {
    const above = preferAbove || y > H * 0.78;
    if (!fits(x, y, above)) return;
    taken.push({ x, y, above, text });
  };
  add(nowX, nowY, "Now", true);
  for (const d of days) add(d.x, d.y, d.text, false);
  return taken;
}

function Label({ x, y, h, above, className, children }: { x: number; y: number; h: number; above?: boolean; className: string; children: React.ReactNode }) {
  const W = 800, H = h;
  if (x < 0 || x > W || y < 0 || y > H) return null;
  return (
    <span className={`pointer-events-none absolute whitespace-nowrap text-small ${className}`}
      style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%`, transform: `translate(-50%, ${above ? "calc(-100% - 0.55rem)" : "0.55rem"})`, textShadow: "0 0 4px var(--map-label-halo), 0 0 8px var(--map-label-halo)" }}>
      {children}
    </span>
  );
}
