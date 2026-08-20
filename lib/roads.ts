// Road geometry for the Roads page: simplify a closed segment, measure it, name its ends.
// Paths are [lat, lon] pairs (same order as Item.lat/lon). Used by the Convex parsers, scripts/build-roads.mjs and RoadMap.
import { distanceNm } from "./storm.ts";

export type LatLon = [lat: number, lon: number];

const milesBetween = (a: LatLon, b: LatLon) => distanceNm(a[0], a[1], b[0], b[1]) * 1.15078;

/** Perpendicular distance of p from segment a–b, in the path's own degree units (good enough to rank points). */
function deviation(p: LatLon, a: LatLon, b: LatLon) {
  const kx = Math.cos((a[0] * Math.PI) / 180); // shrink longitude so degrees are roughly square
  const [py, px] = [p[0], p[1] * kx], [ay, ax] = [a[0], a[1] * kx], [by, bx] = [b[0], b[1] * kx];
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * Douglas-Peucker by insertion: keep both ends, then add the point that strays furthest from the current line
 * until `max` points are kept or nothing strays more than `tol` degrees (~11 m at 1e-4). Rounded to `decimals`.
 */
export function simplifyPath(coords: LatLon[], max = 16, decimals = 4, tol = 1e-4): LatLon[] {
  const pts = coords.filter((c) => Number.isFinite(c[0]) && Number.isFinite(c[1]));
  if (pts.length <= 2) return pts.map((c) => round(c, decimals));
  const keep = new Set<number>([0, pts.length - 1]);
  while (keep.size < max) {
    const idx = [...keep].sort((a, b) => a - b);
    let best = -1, bestDev = tol;
    for (let s = 0; s < idx.length - 1; s++) {
      for (let i = idx[s] + 1; i < idx[s + 1]; i++) {
        const d = deviation(pts[i], pts[idx[s]], pts[idx[s + 1]]);
        if (d > bestDev) { bestDev = d; best = i; }
      }
    }
    if (best < 0) break;
    keep.add(best);
  }
  return [...keep].sort((a, b) => a - b).map((i) => round(pts[i], decimals));
}
const round = (c: LatLon, d: number): LatLon => [Number(c[0].toFixed(d)), Number(c[1].toFixed(d))];

/** GeoJSON LineString / MultiLineString coordinates ([lon, lat] order) → one [lat, lon] path (parts joined in order). */
export function geoJsonPath(geometry: { type: string; coordinates: unknown } | null | undefined): LatLon[] {
  if (!geometry) return [];
  const c = geometry.coordinates as number[][] | number[][][];
  const parts = geometry.type === "MultiLineString" ? (c as number[][][]) : geometry.type === "LineString" ? [c as number[][]] : [];
  return parts.flat().filter((p) => Array.isArray(p) && typeof p[0] === "number" && typeof p[1] === "number").map((p) => [p[1], p[0]] as LatLon);
}

export function pathMiles(path: LatLon[]): number {
  let mi = 0;
  for (let i = 1; i < path.length; i++) mi += milesBetween(path[i - 1], path[i]);
  return mi;
}

/** The point halfway along the path (by length), for "Open in Maps". */
export function pathMidpoint(path: LatLon[]): LatLon | undefined {
  if (!path.length) return undefined;
  const half = pathMiles(path) / 2;
  let run = 0;
  for (let i = 1; i < path.length; i++) {
    const seg = milesBetween(path[i - 1], path[i]);
    if (run + seg >= half) {
      const t = seg ? (half - run) / seg : 0;
      return [path[i - 1][0] + (path[i][0] - path[i - 1][0]) * t, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * t];
    }
    run += seg;
  }
  return path[path.length - 1];
}

/** Nearest named place to a point, with how far it is in miles. */
export function nearestPlace<P extends { lat: number; lon: number }>(p: LatLon, places: P[]): { place: P; miles: number } | undefined {
  let best: { place: P; miles: number } | undefined;
  for (const place of places) {
    const miles = milesBetween(p, [place.lat, place.lon]);
    if (!best || miles < best.miles) best = { place, miles };
  }
  return best;
}

/** Plain words for a path's length: "2.1 miles", "0.4 miles", "350 feet". */
export const milesWord = (mi: number) => (mi < 0.1 ? `${Math.round((mi * 5280) / 10) * 10} feet` : `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} miles`);

/** Places people say, with coordinates, for naming where a closure starts and ends and labelling the map. `big` ones label the island map. */
export type Place = { island: "hawaii" | "maui" | "oahu" | "kauai"; name: string; lat: number; lon: number; big?: boolean };
export const PLACES: Place[] = [
  { island: "hawaii", name: "Hilo", lat: 19.7297, lon: -155.09, big: true },
  { island: "hawaii", name: "Kailua-Kona", lat: 19.64, lon: -155.99, big: true },
  { island: "hawaii", name: "Waimea", lat: 20.02, lon: -155.67, big: true },
  { island: "hawaii", name: "Pāhoa", lat: 19.49, lon: -154.95, big: true },
  { island: "hawaii", name: "Nāʻālehu", lat: 19.06, lon: -155.59, big: true },
  { island: "hawaii", name: "Honokaʻa", lat: 20.08, lon: -155.47, big: true },
  { island: "hawaii", name: "Volcano", lat: 19.44, lon: -155.23, big: true },
  { island: "hawaii", name: "Hāwī", lat: 20.24, lon: -155.83, big: true },
  { island: "hawaii", name: "Captain Cook", lat: 19.5, lon: -155.92, big: true },
  { island: "hawaii", name: "Keaʻau", lat: 19.62, lon: -155.04 },
  { island: "hawaii", name: "Kurtistown", lat: 19.6, lon: -155.06 },
  { island: "hawaii", name: "Mountain View", lat: 19.55, lon: -155.11 },
  { island: "hawaii", name: "Hawaiian Paradise Park", lat: 19.59, lon: -154.97 },
  { island: "hawaii", name: "Leilani Estates", lat: 19.47, lon: -154.92 },
  { island: "hawaii", name: "Kapoho", lat: 19.5, lon: -154.84 },
  { island: "hawaii", name: "Kalapana", lat: 19.35, lon: -154.99 },
  { island: "hawaii", name: "Pāhala", lat: 19.2, lon: -155.48 },
  { island: "hawaii", name: "Ocean View", lat: 19.1, lon: -155.77 },
  { island: "hawaii", name: "Miloliʻi", lat: 19.18, lon: -155.9 },
  { island: "hawaii", name: "Hōnaunau", lat: 19.42, lon: -155.91 },
  { island: "hawaii", name: "Kealakekua", lat: 19.52, lon: -155.92 },
  { island: "hawaii", name: "Hōlualoa", lat: 19.62, lon: -155.95 },
  { island: "hawaii", name: "Waikoloa", lat: 19.94, lon: -155.79 },
  { island: "hawaii", name: "Puakō", lat: 19.97, lon: -155.85 },
  { island: "hawaii", name: "Kawaihae", lat: 20.04, lon: -155.83 },
  { island: "hawaii", name: "Kapaʻau", lat: 20.23, lon: -155.8 },
  { island: "hawaii", name: "Waipiʻo", lat: 20.11, lon: -155.59 },
  { island: "hawaii", name: "Paʻauilo", lat: 20.04, lon: -155.37 },
  { island: "hawaii", name: "Laupāhoehoe", lat: 19.98, lon: -155.24 },
  { island: "hawaii", name: "Hakalau", lat: 19.9, lon: -155.13 },
  { island: "hawaii", name: "Honomū", lat: 19.87, lon: -155.11 },
  { island: "hawaii", name: "Pepeʻekeo", lat: 19.83, lon: -155.1 },
  { island: "maui", name: "Kahului", lat: 20.89, lon: -156.47, big: true },
  { island: "maui", name: "Wailuku", lat: 20.89, lon: -156.5 },
  { island: "maui", name: "Kīhei", lat: 20.76, lon: -156.46, big: true },
  { island: "maui", name: "Wailea", lat: 20.69, lon: -156.44 },
  { island: "maui", name: "Lahaina", lat: 20.88, lon: -156.68, big: true },
  { island: "maui", name: "Kāʻanapali", lat: 20.93, lon: -156.69 },
  { island: "maui", name: "Pāʻia", lat: 20.91, lon: -156.37 },
  { island: "maui", name: "Makawao", lat: 20.86, lon: -156.31 },
  { island: "maui", name: "Kula", lat: 20.79, lon: -156.33, big: true },
  { island: "maui", name: "Hāna", lat: 20.76, lon: -155.99, big: true },
  { island: "maui", name: "Kaunakakai", lat: 21.09, lon: -157.02, big: true },
  { island: "maui", name: "Lānaʻi City", lat: 20.83, lon: -156.92, big: true },
  { island: "oahu", name: "Honolulu", lat: 21.31, lon: -157.86, big: true },
  { island: "oahu", name: "Kāneʻohe", lat: 21.41, lon: -157.8, big: true },
  { island: "oahu", name: "Kapolei", lat: 21.34, lon: -158.06, big: true },
  { island: "oahu", name: "Kailua", lat: 21.4, lon: -157.74 },
  { island: "oahu", name: "Waipahu", lat: 21.39, lon: -158.01 },
  { island: "oahu", name: "Pearl City", lat: 21.4, lon: -157.97 },
  { island: "oahu", name: "ʻAiea", lat: 21.38, lon: -157.93 },
  { island: "oahu", name: "Mililani", lat: 21.45, lon: -158.01 },
  { island: "oahu", name: "Wahiawā", lat: 21.5, lon: -158.02, big: true },
  { island: "oahu", name: "Haleʻiwa", lat: 21.59, lon: -158.1, big: true },
  { island: "oahu", name: "Waiʻanae", lat: 21.44, lon: -158.19, big: true },
  { island: "oahu", name: "Hawaiʻi Kai", lat: 21.28, lon: -157.71 },
  { island: "oahu", name: "Waimānalo", lat: 21.35, lon: -157.71 },
  { island: "oahu", name: "Kaʻaʻawa", lat: 21.55, lon: -157.85 },
  { island: "oahu", name: "Lāʻie", lat: 21.65, lon: -157.92, big: true },
  { island: "oahu", name: "Kahuku", lat: 21.68, lon: -157.95 },
  { island: "kauai", name: "Līhuʻe", lat: 21.98, lon: -159.37, big: true },
  { island: "kauai", name: "Kapaʻa", lat: 22.08, lon: -159.32, big: true },
  { island: "kauai", name: "Anahola", lat: 22.14, lon: -159.31 },
  { island: "kauai", name: "Kīlauea", lat: 22.21, lon: -159.41 },
  { island: "kauai", name: "Princeville", lat: 22.22, lon: -159.48 },
  { island: "kauai", name: "Hanalei", lat: 22.2, lon: -159.5, big: true },
  { island: "kauai", name: "Kōloa", lat: 21.91, lon: -159.47 },
  { island: "kauai", name: "Poʻipū", lat: 21.88, lon: -159.46, big: true },
  { island: "kauai", name: "Hanapēpē", lat: 21.91, lon: -159.59 },
  { island: "kauai", name: "Waimea", lat: 21.96, lon: -159.67, big: true },
  { island: "kauai", name: "Kekaha", lat: 21.97, lon: -159.72 },
];

/** "between Kaʻohe and Leilani Estates" / "near Pāhala": the closest places to a path's two ends. */
export function endsWord(path: LatLon[], island: Place["island"]): string {
  const places = PLACES.filter((p) => p.island === island);
  const a = nearestPlace(path[0], places), b = nearestPlace(path[path.length - 1], places);
  if (!a || !b) return "";
  if (a.place.name === b.place.name || pathMiles(path) < 1) return `near ${a.place.name}`;
  return `between ${a.place.name} and ${b.place.name}`;
}
