// One-time export of tsunami evacuation zones (state GIS Hazards layer 11) per island for the offline "Am I in a zone?" check.
// public/zones/{island}.json = FeatureCollection of zone_code 1 (evacuation) and 2 (extreme) polygons, ~50 m tolerance.
// Anything outside these polygons is not a mapped evacuation zone. Run: node scripts/build-zones.mjs
import { mkdir, writeFile } from "node:fs/promises";
const URL_ = "https://geodata.hawaii.gov/arcgis/rest/services/Hazards/MapServer/11/query?where=zone_code%20IN%20(1,2)&outFields=zone_code,island&outSR=4326&f=geojson&geometryPrecision=4&maxAllowableOffset=0.0005";
const GROUP = { HAWAII: "hawaii", MAUI: "maui", MOLOKAI: "maui", LANAI: "maui", OAHU: "oahu", KAUAI: "kauai", NIIHAU: "kauai" };
const fc = await (await fetch(URL_)).json();
if (!fc.features) throw new Error(JSON.stringify(fc).slice(0, 200));
const by = {};
for (const f of fc.features) {
  const k = GROUP[String(f.properties.island).toUpperCase()];
  if (!k) continue;
  (by[k] ??= []).push({ type: "Feature", properties: { c: f.properties.zone_code }, geometry: f.geometry });
}
await mkdir(new URL("../public/zones/", import.meta.url), { recursive: true });
for (const [k, features] of Object.entries(by)) {
  const json = JSON.stringify({ type: "FeatureCollection", features });
  await writeFile(new URL(`../public/zones/${k}.json`, import.meta.url), json);
  console.log(`${k}: ${features.length} polygons, ${(Buffer.byteLength(json) / 1024).toFixed(0)} KB`);
}
