// One-time export of each island's state highways for the offline Roads map: public/{island}-roads.json = { lines: [[[lat, lon], ...], ...] }.
// Source: Hawaiʻi Statewide GIS Program, Transportation MapServer (geodata.hawaii.gov). Run: node scripts/build-roads.mjs [island ...]
import { writeFile } from "node:fs/promises";
import { simplifyPath } from "../lib/roads.ts";

const BASE = "https://geodata.hawaii.gov/arcgis/rest/services/Transportation/MapServer";
// layer id + WHERE that keeps highways only (trunk/primary), per island. Field names differ per county layer.
const SOURCES = {
  hawaii: { layer: 8, where: "1=1" },                                            // "Hawaii County Major Roads": 65 highway features
  oahu: { layer: 7, where: "type='HWY' OR type='FWY'" },                          // "Oahu Major Roads": drop ramps/exits
  maui: { layer: 5, where: "UPPER(fullname) LIKE '%HIGHWAY%' OR UPPER(fullname) LIKE '%HWY%'" },   // "Maui Roads" (incl. Molokaʻi, Lānaʻi)
  kauai: { layer: 4, where: "UPPER(fullname) LIKE '%HWY%' OR UPPER(fullname) LIKE '%HIGHWAY%'" },  // "Kauai Roads"
};
const BUDGET = 40 * 1024;

async function fetchAll(layer, where) {
  const feats = [];
  for (let offset = 0; ; offset += 2000) {
    const url = `${BASE}/${layer}/query?where=${encodeURIComponent(where)}&outFields=objectid&outSR=4326&f=geojson&resultRecordCount=2000&resultOffset=${offset}`;
    const fc = await (await fetch(url)).json();
    if (fc.error) throw new Error(JSON.stringify(fc.error));
    feats.push(...(fc.features ?? []));
    if (!fc.properties?.exceededTransferLimit && (fc.features ?? []).length < 2000) break;
  }
  return feats;
}

const toParts = (g) => (g?.type === "MultiLineString" ? g.coordinates : g?.type === "LineString" ? [g.coordinates] : []);

/** County layers split a highway into hundreds of block-long pieces; chain pieces that share an endpoint into long lines. */
function chain(parts) {
  const key = ([lat, lon]) => `${lat.toFixed(4)},${lon.toFixed(4)}`;
  const lines = parts.map((p) => [...p]);
  const starts = new Map();
  for (const l of lines) starts.set(key(l[0]), [...(starts.get(key(l[0])) ?? []), l]);
  const used = new Set();
  const out = [];
  for (const l of lines) {
    if (used.has(l)) continue;
    used.add(l);
    let cur = l;
    for (;;) {
      const next = (starts.get(key(cur[cur.length - 1])) ?? []).find((n) => !used.has(n));
      if (!next) break;
      used.add(next);
      cur.push(...next.slice(1));
    }
    out.push(cur);
  }
  return out;
}

async function build(island) {
  const { layer, where } = SOURCES[island];
  const feats = await fetchAll(layer, where);
  const raw = chain(feats.flatMap((f) => toParts(f.geometry)).map((part) => part.map(([lon, lat]) => [lat, lon])));
  // Loosen the tolerance until the file fits the budget: the map is 800 px wide, nobody needs 10 m detail.
  let tol = 2e-4, json = "";
  for (; tol < 0.02; tol *= 1.5) {
    const lines = raw.map((p) => simplifyPath(p, 400, 4, tol)).filter((p) => p.length >= 2);
    json = JSON.stringify({ lines });
    if (Buffer.byteLength(json) <= BUDGET) break;
  }
  await writeFile(new URL(`../public/${island}-roads.json`, import.meta.url), json);
  console.log(`${island}: ${feats.length} features → ${raw.length} lines, ${raw.reduce((n, p) => n + p.length, 0)} → ${JSON.parse(json).lines.reduce((n, p) => n + p.length, 0)} points, tol ${tol.toExponential(1)}, ${(Buffer.byteLength(json) / 1024).toFixed(1)} KB`);
}

const islands = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SOURCES);
for (const i of islands) await build(i).catch((e) => console.error(`${i}: ${e.message}`));
