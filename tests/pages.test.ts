import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseAltModels, parseObs, parseForecast, parseSrf, parseNdbc, parseAirNow, compactQuakes, parseHans, parseSo2, parseCap, parseSirens } from "../convex/parsers/pages.ts";

const txt = (f: string) => readFileSync(new URL(`../fixtures/${f}`, import.meta.url), "utf8");
const fx = (f: string) => JSON.parse(txt(f));

test("weather parsers: obs (with METAR fallback), forecast periods, SRF zones, NDBC, AirNow", () => {
  const obs = parseObs(fx("nws-obs-phto.json"))!;
  assert.ok(obs && obs.f! > 60 && obs.f! < 100, `temp ${obs?.f}`);
  const metar = parseObs({ features: [{ properties: { timestamp: "2026-08-20T08:53:00+00:00", rawMessage: "PHTO 200853Z AUTO 24003KT 10SM CLR 24/22 A2997", temperature: { value: null }, relativeHumidity: { value: null }, windSpeed: { value: null }, windDirection: { value: null }, windGust: { value: null } } }] })!;
  assert.equal(metar.f, 75); assert.equal(metar.wDir, 240); assert.equal(metar.wMph, 3); assert.ok(metar.rh! > 80);

  const fc = parseForecast(fx("nws-forecast-hilo.json"));
  assert.equal(fc.fc.length, 14, "7 days + nights"); assert.ok(fc.fc[0].n && fc.fc[0].s.length <= 40 && fc.fc[0].wind);

  const srf = parseSrf(txt("srf-hfo.txt"));
  assert.deepEqual(Object.keys(srf.zones), ["Kauai", "Oahu", "Maui", "Big Island Windward and Southeast", "Big Island Leeward"]);
  assert.deepEqual(srf.zones["Big Island Leeward"]["West"], ["1-3", "1-3"]);
  assert.equal(srf.uv, "Extreme");
  assert.equal(new Date(srf.at).toISOString(), "2026-08-20T01:44:00.000Z");

  const buoys = parseNdbc(txt("ndbc-hi.txt"), [{ id: "51206", name: "Hilo" }, { id: "51201", name: "Waimea Bay" }]);
  assert.equal(buoys.length, 2); assert.equal(buoys.find((b) => b.id === "51206")!.hFt, 4.6);

  const air = parseAirNow(txt("airnow-hi.dat"));
  assert.ok(air.length >= 3 && air.every((a) => a.cat && a.pm25 >= 0));
  assert.ok(air.some((a) => a.name === "Hilo"));
});

test("quakes: compact shape, cap + more flag", () => {
  const { q, more } = compactQuakes(fx("usgs-hi.json"), 5);
  assert.equal(q.length, 5); assert.equal(more, true);
  assert.ok(q.every((x) => x.i && x.ll.length === 2 && !x.p.endsWith(", Hawaii") && Number.isInteger(x.t)));
  const notable = compactQuakes(fx("usgs-notable.json"));
  assert.ok(notable.q.every((x) => x.m >= 3.5));
});

test("volcano: HANS status + sections, SO2 sites", () => {
  const k = parseHans(fx("hans-summary.json"), { "332010": fx("hans-newest-332010.json") }, { "332010": txt("hans-sms.txt") }, "332010", "Kīlauea")!;
  assert.equal(k.level, "ADVISORY"); assert.equal(k.color, "YELLOW"); assert.equal(k.erupting, false); assert.equal(k.prevLevel, "WATCH");
  assert.match(k.sms, /^Kīlauea volcano is not erupting/);
  assert.ok(Object.keys(k.sections).length >= 2, JSON.stringify(Object.keys(k.sections)));
  assert.ok(Object.values(k.sections).every((s) => s.length <= 400));
  const air = parseSo2(fx("hiso2-recent.json"), Date.parse("2026-08-20T11:30:00Z"));
  assert.ok(air.some((a) => a.name === "Hilo" && a.so2 != null));
  assert.ok(air.every((a) => !a.stale));
});

test("tsunami: CAP info statement is 'info' then 'none' once expired; sirens", () => {
  const live = parseCap(txt("ptwc-cap.xml"), Date.parse("2026-08-12T04:00:00Z"));
  assert.equal(live.level, "info"); assert.match(live.headline!, /INFORMATION STATEMENT/);
  assert.equal(parseCap(txt("ptwc-cap.xml"), Date.parse("2026-08-20T00:00:00Z")).level, "none");
  const s = parseSirens(fx("hiema-sirens.json"));
  assert.equal(s.total, 405); assert.equal(s.bad.length, 42); assert.ok(s.bad.every((b) => b.ll[0] > 18 && b.ll[1] < -154));
});

test("volcano: Mauna Loa at NORMAL comes from its monthly notice when absent from the daily summary", () => {
  const ml = parseHans(fx("hans-summary.json"), { "332020": fx("hans-newest-332020.json") }, {}, "332020", "Mauna Loa");
  assert.ok(ml, "fallback produced a status");
  assert.equal(ml!.level, "NORMAL"); assert.equal(ml!.color, "GREEN"); assert.equal(ml!.erupting, false);
});

test("hourly: 36 parallel arrays under 1 KB, condition codes from icon paths", async () => {
  const { parseHourly, conditionCode } = await import("../convex/parsers/pages.ts");
  const h = parseHourly(fx("nws-hourly-hilo.json"), 36, Date.parse("2026-08-20T17:30:00Z"))!;
  assert.equal(h.t.length, 36); assert.equal(h.p.length, 36); assert.equal(h.c.length, 36);
  assert.ok(Buffer.byteLength(JSON.stringify(h)) < 1000, `${Buffer.byteLength(JSON.stringify(h))} B`);
  assert.ok(h.t.every((t) => t > 50 && t < 100) && h.p.every((p) => p >= 0 && p <= 100));
  assert.equal(conditionCode("https://api.weather.gov/icons/land/day/rain_showers,20?size=medium"), 5);
  assert.equal(conditionCode("https://api.weather.gov/icons/land/night/tsra_sct,40?size=medium"), 7);
  assert.equal(conditionCode("https://api.weather.gov/icons/land/day/skc?size=medium"), 0);
  assert.equal(conditionCode("https://api.weather.gov/icons/land/day/bkn?size=medium"), 3);
  assert.equal(conditionCode("", "Partly Cloudy"), 2);
});

test("open-meteo alt models: aligned to t0, 36 whole °F, gaps interpolated", () => {
  const json = fx("open-meteo-hilo.json");
  const t0 = Date.parse("2026-08-21T10:00:00-10:00");
  const alt = parseAltModels(json, t0);
  assert.ok(alt.length >= 2, `models ${alt.length}`);
  for (const a of alt) { assert.ok(["ECMWF", "GFS", "ICON"].includes(a.m)); assert.equal(a.t.length, 36); assert.ok(a.t.every((x) => Number.isInteger(x) && x > 50 && x < 100)); }
  assert.equal(alt.find((a) => a.m === "ECMWF")!.t[0], Math.round(json.hourly.temperature_2m_ecmwf_ifs025[10]));
  const gappy = structuredClone(json); gappy.hourly.temperature_2m_gfs_seamless[12] = null; gappy.hourly.temperature_2m_icon_seamless.fill(null, 10, 30);
  const alt2 = parseAltModels(gappy, t0);
  assert.ok(!alt2.some((a) => a.m === "ICON"), "drops >20% missing"); assert.ok(Number.isInteger(alt2.find((a) => a.m === "GFS")!.t[2]));
  assert.deepEqual(parseAltModels(json, Date.parse("2026-09-01T00:00:00-10:00")), []);
});
