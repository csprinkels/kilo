import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseObs, parseForecast, parseSrf, parseNdbc, parseAirNow, compactQuakes, parseHans, parseSo2, parseCap, parseSirens } from "../convex/parsers/pages.ts";

const txt = (f: string) => readFileSync(new URL(`../fixtures/${f}`, import.meta.url), "utf8");
const fx = (f: string) => JSON.parse(txt(f));

test("weather parsers: obs (with METAR fallback), forecast periods, SRF zones, NDBC, AirNow", () => {
  const obs = parseObs(fx("nws-obs-phto.json"))!;
  assert.ok(obs && obs.f! > 60 && obs.f! < 100, `temp ${obs?.f}`);
  const metar = parseObs({ features: [{ properties: { timestamp: "2026-08-20T08:53:00+00:00", rawMessage: "PHTO 200853Z AUTO 24003KT 10SM CLR 24/22 A2997", temperature: { value: null }, relativeHumidity: { value: null }, windSpeed: { value: null }, windDirection: { value: null }, windGust: { value: null } } }] })!;
  assert.equal(metar.f, 75); assert.equal(metar.wDir, 240); assert.equal(metar.wMph, 3); assert.ok(metar.rh! > 80);

  const fc = parseForecast(fx("nws-forecast-hilo.json"));
  assert.equal(fc.fc.length, 4); assert.ok(fc.fc[0].n && fc.fc[0].s.length <= 40 && fc.fc[0].wind);

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
