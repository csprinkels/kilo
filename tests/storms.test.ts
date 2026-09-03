import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseTcm, parseTcp, relevantStorms, preText, archiveTcmUrl } from "../convex/parsers/storms.ts";
import { conePolygon, outlookFor, categoryOf, ISLAND_POINTS, distanceNm, type Storm } from "../lib/storm.ts";

const txt = (f: string) => readFileSync(new URL(`../fixtures/${f}`, import.meta.url), "utf8");
const fx = (f: string) => JSON.parse(txt(f));

const toStorm = (tcm: ReturnType<typeof parseTcm>): Storm => ({
  id: "cp012026", ...tcm, warnings: [], track: [], links: {},
});

test("TCM: advisory 32 header, position, radii, 6 forecast + 2 outlook points", () => {
  const s = parseTcm(txt("tcm-lala-032.txt"));
  assert.equal(s.name, "Lala");
  assert.equal(s.cls, "HU");
  assert.equal(s.advNum, 32);
  assert.equal(s.issuedAt, Date.UTC(2026, 7, 20, 9, 0));
  assert.equal(s.lat, 23.5); assert.equal(s.lon, -171.9);
  assert.equal(s.windKt, 90); assert.equal(s.gustKt, 110); assert.equal(s.pressureMb, 963);
  assert.equal(s.moveDirDeg, 345); assert.equal(s.moveKt, 8);
  assert.deepEqual(s.radii[34], [150, 120, 80, 110]);
  assert.deepEqual(s.radii[64], [40, 35, 30, 35]);
  assert.equal(s.nextAdvisoryAt, Date.UTC(2026, 7, 20, 15, 0));
  assert.equal(s.forecast.length, 8);
  assert.deepEqual(s.forecast.map((p) => p.hour), [9, 21, 33, 45, 57, 69, 93, 117]);
  assert.equal(s.forecast[0].windKt, 85);
  assert.deepEqual(s.forecast[0].radii[34], [150, 120, 80, 110]);
  assert.equal(s.forecast[6].outlook, true);
  assert.equal(s.forecast[6].radii[64], undefined, "outlook points carry no 64-kt radii");
  assert.deepEqual(s.forecast[7].radii[50], [40, 40, 0, 30]);
});

test("TCM: every archived Lala advisory parses; track runs east to west past the islands", () => {
  const advs = Array.from({ length: 32 }, (_, i) => parseTcm(txt(`lala/fstadv.${String(i + 1).padStart(3, "0")}.txt`)));
  assert.equal(advs[0].cls, "PTC");
  assert.ok(advs.some((a) => a.cls === "TS") && advs.some((a) => a.cls === "HU"));
  assert.ok(advs.every((a) => a.forecast.length >= 5), "each advisory has a multi-day forecast");
  assert.ok(advs[0].lon > advs[31].lon, "moved west");
  assert.ok(advs.every((a, i) => i === 0 || a.issuedAt > advs[i - 1].issuedAt), "monotonic issue times");
  assert.equal(archiveTcmUrl("cp012026", 7), "https://www.nhc.noaa.gov/archive/2026/cp01/cp012026.fstadv.007.shtml");
});

test("TCP: headline and warnings", () => {
  const p = parseTcp(txt("tcp-lala-032.txt"), "Lala");
  assert.equal(p.headline, "Lala remains a potent hurricane as it nears the northwestern Hawaiian islands");
  assert.equal(p.warnings.length, 2);
  assert.match(p.warnings[0], /^A Hurricane Warning is in effect for — The Papahanaumokuakea/);
  assert.match(p.warnings[1], /Tropical Storm Warning.*French Frigate Shoals/);
});

test("CurrentStorms: relevance filter and <pre> extraction", () => {
  const cur = relevantStorms(fx("nhc-current-storms.json"));
  assert.equal(cur[0].id, "cp012026");
  assert.equal(relevantStorms({ activeStorms: [{ id: "ep052026", longitudeNumeric: -110 } as never] }).length, 0);
  assert.equal(relevantStorms({ activeStorms: [{ id: "ep052026", longitudeNumeric: -135 } as never] }).length, 1);
  assert.equal(preText("<html><pre>A &amp; B</pre></html>"), "A & B");
});

test("cone polygon and outlook: the advisory that put Kaʻū inside the 34-kt radius", () => {
  // Find the advisory where Hawaiʻi Island was closest.
  const advs = Array.from({ length: 32 }, (_, i) => toStorm(parseTcm(txt(`lala/fstadv.${String(i + 1).padStart(3, "0")}.txt`))));
  const hi = ISLAND_POINTS.hawaii;
  const nearest = advs.reduce((a, b) => (distanceNm(a.lat, a.lon, hi.lat, hi.lon) < distanceNm(b.lat, b.lon, hi.lat, hi.lon) ? a : b));
  assert.ok(distanceNm(nearest.lat, nearest.lon, hi.lat, hi.lon) < 120, "Lala passed within ~120 nm of the island centroid");

  // Two advisories earlier, the forecast should already show TS winds arriving and a close approach.
  const before = advs[advs.indexOf(nearest) - 2];
  const o = outlookFor(before, hi);
  assert.ok(o.closest.distNm < 150, `closest approach ${o.closest.distNm} nm`);
  assert.ok(o.tsWindsFrom && o.tsWindsFrom >= before.issuedAt, "TS winds forecast at or after issue time");
  assert.ok(o.tsWindsUntil! >= o.tsWindsFrom!);
  assert.equal(o.movingAway, false);

  const poly = conePolygon([{ lat: before.lat, lon: before.lon, hour: 0 }, ...before.forecast]);
  assert.ok(poly.length > 20);
  assert.ok(poly.every(([lon, lat]) => lon < -100 && lon > -185 && lat > 0 && lat < 50));
  const farWest = conePolygon([{ lat: 30, lon: -176, hour: 0 }, { lat: 33, lon: -179, hour: 24 }, { lat: 35, lon: -182, hour: 48 }]);
  assert.ok(farWest.every(([lon]) => lon < -170), "cone stays continuous past the dateline instead of wrapping to +179");

  // Advisory 32: far northwest and moving away from every main island.
  const last = advs[31];
  assert.equal(outlookFor(last, hi).movingAway, true);
  assert.equal(outlookFor(last, hi).tsWindsFrom, undefined);
  assert.equal(categoryOf(last.windKt).label, "Category 2 hurricane");
});

test("outlook: a storm heading west now but recurving toward us later is not 'moving away'", () => {
  // Lowell, 3 Sep 2026: due west at 9 kt off the south, then north across the island latitudes by day 5.
  // A 12-hour lookahead read that as moving away from Maui while the closest approach was still 113 hours out.
  const recurving: Storm = {
    id: "ep122026", name: "Lowell", cls: "HU", advNum: 29, issuedAt: Date.UTC(2026, 8, 3, 3, 0),
    warnings: [], track: [], links: {}, lat: 13.5, lon: -157.2, windKt: 120, gustKt: 145, radii: {},
    forecast: [
      { hour: 9, at: Date.UTC(2026, 8, 3, 12, 0), lat: 13.5, lon: -158.3, windKt: 120, gustKt: 145, radii: {} },
      { hour: 33, at: Date.UTC(2026, 8, 4, 12, 0), lat: 13.7, lon: -161.0, windKt: 120, gustKt: 145, radii: {} },
      { hour: 69, at: Date.UTC(2026, 8, 6, 0, 0), lat: 15.1, lon: -163.2, windKt: 120, gustKt: 145, radii: {} },
      { hour: 117, at: Date.UTC(2026, 8, 8, 0, 0), lat: 22.7, lon: -162.0, windKt: 100, gustKt: 120, radii: {}, outlook: true },
    ],
  };
  const o = outlookFor(recurving, ISLAND_POINTS.maui);
  assert.equal(o.movingAway, false, "the day-5 track turns back toward Maui");
  assert.ok(o.closest.hour > 100, `closest approach is late in the forecast, not now (hour ${o.closest.hour})`);

  // Hawaiʻi Island sits east of the whole track: it really is closest right now.
  const away = outlookFor(recurving, ISLAND_POINTS.hawaii);
  assert.equal(away.movingAway, true);
  assert.equal(away.closest.hour, 0);
});
