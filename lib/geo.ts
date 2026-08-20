// Point-in-polygon for the offline tsunami zone check. GeoJSON rings are [lon, lat]; callers pass lat/lon.
export type Ring = [number, number][];
export type ZoneFeature = { type: "Feature"; properties: { c: number }; geometry: { type: "Polygon"; coordinates: Ring[] } | { type: "MultiPolygon"; coordinates: Ring[][] } };
export type ZoneCollection = { type: "FeatureCollection"; features: ZoneFeature[] };

function inRing(lon: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const inPolygon = (lon: number, lat: number, rings: Ring[]) => inRing(lon, lat, rings[0]) && !rings.slice(1).some((h) => inRing(lon, lat, h));

/** Metres from a point to the nearest edge of any ring (for "you are right at the edge of the zone"). */
function metresToEdge(lon: number, lat: number, rings: Ring[]): number {
  const kx = Math.cos((lat * Math.PI) / 180) * 111_320, ky = 110_540;
  let best = Infinity;
  for (const ring of rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const ax = (ring[j][0] - lon) * kx, ay = (ring[j][1] - lat) * ky, bx = (ring[i][0] - lon) * kx, by = (ring[i][1] - lat) * ky;
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}

/** The zone code at a point (1 evacuation, 2 extreme) or null, plus metres to the nearest zone edge. */
export function zoneAt(lat: number, lon: number, zones: ZoneCollection): { code: number | null; edgeM: number } {
  let code: number | null = null, edgeM = Infinity;
  for (const f of zones.features) {
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const rings of polys) {
      edgeM = Math.min(edgeM, metresToEdge(lon, lat, rings));
      if (inPolygon(lon, lat, rings)) code = code === null ? f.properties.c : Math.min(code, f.properties.c); // 1 (evacuate) wins over 2 (extreme)
    }
  }
  return { code, edgeM };
}
