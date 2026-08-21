// Build the small, offline base-map images used behind live road conditions.
// Sources: Hawaiʻi Statewide GIS Program Elevation + Transportation MapServers.
// Run: node scripts/build-map-art.mjs [island ...]
import { mkdir, writeFile } from "node:fs/promises";

const ELEVATION = "https://geodata.hawaii.gov/arcgis/rest/services/Elevation/MapServer/export";
const TRANSPORTATION = "https://geodata.hawaii.gov/arcgis/rest/services/Transportation/MapServer/export";
const OUT = new URL("../public/maps/", import.meta.url);
const MAX_FILE = 180 * 1024;

// Bounds match RoadMap's unpadded island frames: [south, north, west, east].
const MAPS = {
  hawaii: { box: [18.85, 20.33, -156.15, -154.73], contours: [1], streets: 6 },
  maui: { box: [20.45, 21.3, -157.4, -155.9], contours: [4, 5, 6], streets: 5 },
  oahu: { box: [21.2, 21.77, -158.35, -157.58], contours: [8], streets: 3 },
  kauai: { box: [21.8, 22.3, -159.88, -159.22], contours: [3], streets: 4 },
};

function dimensions([south, north, west, east]) {
  const width = 1000;
  const kx = Math.cos(((south + north) / 2) * Math.PI / 180);
  return [width, Math.round(width * (north - south) / ((east - west) * kx))];
}

async function image(url, box, size, layers) {
  const [south, north, west, east] = box;
  const params = new URLSearchParams({
    bbox: `${west},${south},${east},${north}`,
    bboxSR: "4326",
    imageSR: "4326",
    size: size.join(","),
    format: "png32",
    transparent: "true",
    layers: `show:${layers.join(",")}`,
    f: "image",
  });
  const response = await fetch(`${url}?${params}`);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!response.headers.get("content-type")?.includes("image/png")) throw new Error(`expected PNG, got ${response.headers.get("content-type")}`);
  if (bytes.length > MAX_FILE) throw new Error(`${Math.round(bytes.length / 1024)} KB exceeds ${MAX_FILE / 1024} KB budget`);
  return bytes;
}

async function build(island) {
  const config = MAPS[island];
  if (!config) throw new Error(`unknown island: ${island}`);
  const size = dimensions(config.box);
  const [terrain, streets] = await Promise.all([
    image(ELEVATION, config.box, size, [10, ...config.contours]),
    image(TRANSPORTATION, config.box, size, [config.streets]),
  ]);
  await Promise.all([
    writeFile(new URL(`${island}-terrain.png`, OUT), terrain),
    writeFile(new URL(`${island}-streets.png`, OUT), streets),
  ]);
  console.log(`${island}: ${size.join("×")}, terrain ${Math.round(terrain.length / 1024)} KB, streets ${Math.round(streets.length / 1024)} KB`);
}

await mkdir(OUT, { recursive: true });
const islands = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(MAPS);
for (const island of islands) await build(island);
