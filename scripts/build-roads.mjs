// One-time export of each island's state highways for the offline Roads map: public/{island}-roads.json = { lines: [{ n: name, r: routeNumber, p: [[lat, lon], ...] }, ...] }.
// Names and route numbers let the Roads page draw the county's named detour ("Use Highway 19 instead").
// Source: Hawaiʻi Statewide GIS Program, Transportation MapServer (geodata.hawaii.gov). Run: node scripts/build-roads.mjs [island ...]
import { writeFile } from "node:fs/promises";
import { simplifyPath } from "../lib/roads.ts";

const BASE = "https://geodata.hawaii.gov/arcgis/rest/services/Transportation/MapServer";
// layer id + WHERE that keeps highways only (trunk/primary), per island. Field names differ per county layer.
const SOURCES = {
  hawaii: { layer: 8, where: "1=1", name: "fename", route: "highway" },                                   // "Hawaii County Major Roads": 65 highway features
  oahu: { layer: 7, where: "type='HWY' OR type='FWY'", name: "fullname" },                                // "Oahu Major Roads": drop ramps/exits
  maui: { layer: 5, where: "UPPER(fullname) LIKE '%HIGHWAY%' OR UPPER(fullname) LIKE '%HWY%'", name: "fullname", route: "stroute" },   // "Maui Roads" (incl. Molokaʻi, Lānaʻi)
  kauai: { layer: 4, where: "UPPER(fullname) LIKE '%HWY%' OR UPPER(fullname) LIKE '%HIGHWAY%'", name: "fullname" },  // "Kauai Roads"
};
const BUDGET = 40 * 1024;

async function fetchAll(layer, where, fields) {
  const feats = [];
  for (let offset = 0; ; offset += 2000) {
    const url = `${BASE}/${layer}/query?where=${encodeURIComponent(where)}&outFields=${encodeURIComponent(fields.join(","))}&outSR=4326&f=geojson&resultRecordCount=2000&resultOffset=${offset}`;
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
  const { layer, where, name, route } = SOURCES[island];
  const feats = await fetchAll(layer, where, ["objectid", name, route].filter(Boolean));
  // Chain within one road (same name + route number) so a detour can be drawn as that road.
  const groups = new Map();
  for (const f of feats) {
    const n = String(f.properties?.[name] ?? "").trim();
    const r = Number(route ? f.properties?.[route] : 0) || 0;
    const k = `${n}|${r}`;
    if (!groups.has(k)) groups.set(k, { n, r, parts: [] });
    groups.get(k).parts.push(...toParts(f.geometry).map((part) => part.map(([lon, lat]) => [lat, lon])));
  }
  const raw = [...groups.values()].flatMap((g) => chain(g.parts).map((p) => ({ n: g.n, r: g.r, p })));
  // Loosen the tolerance until the file fits the budget: the map is 800 px wide, nobody needs 10 m detail.
  let tol = 2e-4, json = "";
  for (; tol < 0.02; tol *= 1.5) {
    const lines = raw.map((l) => ({ ...l, p: simplifyPath(l.p, 400, 4, tol) })).filter((l) => l.p.length >= 2);
    json = JSON.stringify({ lines });
    if (Buffer.byteLength(json) <= BUDGET) break;
  }
  await writeFile(new URL(`../public/${island}-roads.json`, import.meta.url), json);
  const out = JSON.parse(json).lines;
  console.log(`${island}: ${feats.length} features → ${raw.length} lines (${new Set(out.map((l) => l.n)).size} names), ${raw.reduce((n, l) => n + l.p.length, 0)} → ${out.reduce((n, l) => n + l.p.length, 0)} points, tol ${tol.toExponential(1)}, ${(Buffer.byteLength(json) / 1024).toFixed(1)} KB`);
}

const islands = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SOURCES);
for (const i of islands) await build(i).catch((e) => console.error(`${i}: ${e.message}`));
