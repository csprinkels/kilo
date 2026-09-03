// Tropical cyclone types + geometry shared by the parser (convex/) and the tracker UI (app/).
import type { Island } from "./types";

export type Quadrants = [ne: number, se: number, sw: number, nw: number]; // nautical miles
export type WindRadii = { 34?: Quadrants; 50?: Quadrants; 64?: Quadrants };

export type ForecastPoint = {
  hour: number;          // forecast hour from the advisory time (0 = current)
  at: number;            // epoch ms
  lat: number; lon: number;
  windKt: number; gustKt: number;
  radii: WindRadii;
  outlook?: boolean;     // day 4-5 "OUTLOOK" points: larger errors
};

export type TrackPoint = { at: number; lat: number; lon: number; windKt: number; adv: number; cls: string };

export type Storm = {
  id: string;            // "cp012026"
  name: string;          // "Lala"
  cls: string;           // HU | TS | TD | PTC | PC | SS | STD | EX
  advNum: number;
  issuedAt: number;
  nextAdvisoryAt?: number;
  headline?: string;     // from the public advisory
  warnings: string[];    // "A Hurricane Warning is in effect for ... Maro Reef"
  lat: number; lon: number;
  windKt: number; gustKt: number; pressureMb?: number;
  moveDirDeg?: number; moveKt?: number;
  radii: WindRadii;
  forecast: ForecastPoint[]; // excludes hour 0; use current position for that
  track: TrackPoint[];       // past advisories incl. this one, oldest first
  links: { public?: string; forecast?: string; discussion?: string; graphics?: string; cone?: string };
};

export type StormsSnapshot = { gen: number; storms: Storm[] };

// ---------- units & categories ----------
export const ktToMph = (kt: number) => Math.round(kt * 1.15078);
export const nmToMi = (nm: number) => Math.round(nm * 1.15078);

export type Category = { label: string; short: string; level: 0 | 1 | 2 | 3 | 4 | 5 | -1 };
export function categoryOf(windKt: number, cls?: string): Category {
  if (cls === "PTC") return { label: "Potential tropical cyclone", short: "PTC", level: -1 };
  if (cls === "PC" || cls === "EX") return { label: "Post-tropical", short: "PT", level: -1 };
  if (windKt >= 137) return { label: "Category 5 hurricane", short: "5", level: 5 };
  if (windKt >= 113) return { label: "Category 4 hurricane", short: "4", level: 4 };
  if (windKt >= 96) return { label: "Category 3 hurricane", short: "3", level: 3 };
  if (windKt >= 83) return { label: "Category 2 hurricane", short: "2", level: 2 };
  if (windKt >= 64) return { label: "Category 1 hurricane", short: "1", level: 1 };
  if (windKt >= 34) return { label: "Tropical storm", short: "TS", level: 0 };
  return { label: "Tropical depression", short: "TD", level: -1 };
}

export const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
export const compass = (deg: number) => COMPASS[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];

// ---------- geometry (nautical miles, degrees) ----------
const R_NM = 3440.065;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function distanceNm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_NM * Math.asin(Math.sqrt(a));
}
export function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number) {
  const y = Math.sin(rad(lon2 - lon1)) * Math.cos(rad(lat2));
  const x = Math.cos(rad(lat1)) * Math.sin(rad(lat2)) - Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lon2 - lon1));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}
export function destination(lat: number, lon: number, bearing: number, distNm: number): [lat: number, lon: number] {
  const d = distNm / R_NM, b = rad(bearing), la1 = rad(lat), lo1 = rad(lon);
  const la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(b));
  const lo2 = lo1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la1), Math.cos(d) - Math.sin(la1) * Math.sin(la2));
  return [deg(la2), deg(lo2)]; // deliberately NOT wrapped to ±180: keeps cones continuous across the antimeridian
}

// ---------- cone of uncertainty ----------
// NHC 2026 radii (nm) for the Eastern + Central Pacific, 2/3 of 2021-2025 track errors. https://www.nhc.noaa.gov/aboutcone.shtml
export const CONE_RADII_NM: [hour: number, nm: number][] = [[0, 0], [12, 25], [24, 37], [36, 48], [48, 56], [60, 66], [72, 78], [96, 106], [120, 138]];
export function coneRadiusNm(hour: number) {
  for (let i = 1; i < CONE_RADII_NM.length; i++) {
    const [h0, r0] = CONE_RADII_NM[i - 1], [h1, r1] = CONE_RADII_NM[i];
    if (hour <= h1) return r0 + ((hour - h0) / (h1 - h0)) * (r1 - r0);
  }
  return CONE_RADII_NM[CONE_RADII_NM.length - 1][1];
}

/** Swath polygon ([lon,lat][]) built NHC-style: circles of growing radius at each forecast point, joined by tangents. */
export function conePolygon(points: { lat: number; lon: number; hour: number }[]): [number, number][] {
  const pts = points.filter((p) => p.hour <= 120);
  if (pts.length < 2) return [];
  const left: [number, number][] = [], right: [number, number][] = [];
  const headingAt = (i: number) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    return bearingDeg(a.lat, a.lon, b.lat, b.lon);
  };
  const ll = (x: [number, number]): [number, number] => [x[1], x[0]];
  pts.forEach((p, i) => {
    const r = coneRadiusNm(p.hour), h = headingAt(i);
    if (r === 0) { left.push([p.lon, p.lat]); right.push([p.lon, p.lat]); return; }
    left.push(ll(destination(p.lat, p.lon, h - 90, r)));
    right.push(ll(destination(p.lat, p.lon, h + 90, r)));
  });
  // End cap: semicircle around the last point from right side to left side.
  const last = pts[pts.length - 1], hl = headingAt(pts.length - 1), rl = coneRadiusNm(last.hour);
  const cap: [number, number][] = [];
  for (let a = 90; a >= -90; a -= 15) cap.push(ll(destination(last.lat, last.lon, hl + a, rl)));
  return [...right, ...cap, ...left.reverse()];
}

// ---------- what it means for a place ----------
export const ISLAND_POINTS: Record<Exclude<Island, "state">, { lat: number; lon: number; label: string }> = {
  hawaii: { lat: 19.6, lon: -155.5, label: "Hawaiʻi Island" },
  maui: { lat: 20.8, lon: -156.3, label: "Maui" },
  oahu: { lat: 21.45, lon: -158.0, label: "Oʻahu" },
  kauai: { lat: 22.05, lon: -159.5, label: "Kauaʻi" },
};

const quadrantIndex = (bearing: number) => (bearing < 90 ? 0 : bearing < 180 ? 1 : bearing < 270 ? 2 : 3);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpQ = (a: Quadrants | undefined, b: Quadrants | undefined, t: number): Quadrants | undefined =>
  a && b ? [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)] : a ?? b;

/** Hourly interpolation of the official forecast (hour 0 = current position). */
export function hourlyPath(storm: Storm): ForecastPoint[] {
  const pts: ForecastPoint[] = [
    { hour: 0, at: storm.issuedAt, lat: storm.lat, lon: storm.lon, windKt: storm.windKt, gustKt: storm.gustKt, radii: storm.radii },
    ...storm.forecast,
  ];
  const out: ForecastPoint[] = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    for (let h = a.hour; h < b.hour; h++) {
      const t = (h - a.hour) / (b.hour - a.hour);
      out.push({
        hour: h, at: lerp(a.at, b.at, t), lat: lerp(a.lat, b.lat, t), lon: lerp(a.lon, b.lon, t),
        windKt: lerp(a.windKt, b.windKt, t), gustKt: lerp(a.gustKt, b.gustKt, t),
        radii: { 34: lerpQ(a.radii[34], b.radii[34], t), 50: lerpQ(a.radii[50], b.radii[50], t), 64: lerpQ(a.radii[64], b.radii[64], t) },
        outlook: b.outlook,
      });
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

export type Outlook = {
  closest: { at: number; distNm: number; windKt: number; bearingFromPlace: number; hour: number };
  tsWindsFrom?: number;   // earliest hour (epoch ms) the place sits inside the 34-kt radius
  tsWindsUntil?: number;
  hurricaneWindsFrom?: number;
  movingAway: boolean;
};

/** Closest approach + wind-arrival windows for one place, from the deterministic official forecast. */
export function outlookFor(storm: Storm, place: { lat: number; lon: number }): Outlook {
  const path = hourlyPath(storm);
  let closest = { at: 0, distNm: Infinity, windKt: 0, bearingFromPlace: 0, hour: 0 };
  let tsFrom: number | undefined, tsUntil: number | undefined, huFrom: number | undefined;
  for (const p of path) {
    const d = distanceNm(p.lat, p.lon, place.lat, place.lon);
    if (d < closest.distNm) closest = { at: p.at, distNm: d, windKt: p.windKt, bearingFromPlace: bearingDeg(place.lat, place.lon, p.lat, p.lon), hour: p.hour };
    const q = quadrantIndex(bearingDeg(p.lat, p.lon, place.lat, place.lon));
    const r34 = p.radii[34]?.[q] ?? 0, r64 = p.radii[64]?.[q] ?? 0;
    if (d <= r34) { tsFrom ??= p.at; tsUntil = p.at; }
    if (d <= r64) huFrom ??= p.at;
  }
  // Moving away only when the whole official forecast never brings it closer than it is right now.
  // A 12-hour gradient called a recurving storm "moving away" while the day-5 track turned back toward us:
  // Lowell read as moving away from Maui with its closest approach still 113 hours out.
  const movingAway = path.length > 1 && closest.hour === 0;
  return { closest, tsWindsFrom: tsFrom, tsWindsUntil: tsUntil, hurricaneWindsFrom: huFrom, movingAway };
}
