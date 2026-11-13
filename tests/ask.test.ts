import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ask, examples, NOTHING, type AskCtx } from "../lib/ask.ts";
import { parseSrf } from "../convex/parsers/pages.ts";
import type { Weather } from "../lib/pages.ts";
import type { Plain } from "../lib/plain.ts";
import type { Item } from "../lib/types.ts";
import type { RoadLine } from "../lib/roads.ts";

const now = Date.UTC(2026, 8, 3, 20, 0);
const item = (o: Partial<Item> & { key: string; type: Item["type"] }): Item => ({
  source: "hccda:roads", tier: "official", sev: 2, islands: ["hawaii"], districts: [], title: "", body: "", srcUrl: "",
  issuedAt: now - 3_600_000, lastConfirmedAt: now, hash: "", ...o,
});
const P = (headline: string, level: Plain["level"] = 2, action = "") => ({ headline, action, level }) as Plain;

const ROADS: RoadLine[] = [
  { n: "Saddle Rd", r: 200, p: [] },
  { n: "Mamalahoa Hwy", r: 11, p: [] },
  { n: "Kanoelehua Ave", r: 11, p: [] },
  { n: "KALANIANAOLE HWY", r: 72, p: [] },
];

const ctx = (items: Item[], plain: [string, Plain][], extra: Partial<AskCtx> = {}): AskCtx =>
  ({ items, plain: new Map(plain), roads: ROADS, ...extra });

test("ask: a road we know about gets a straight answer, and a real closure beats a detour mention", () => {
  // Wood Valley is closed and names Mamalahoa as the way around. Asking about Mamalahoa must not
  // return the Wood Valley closure just because Mamalahoa appears in its body.
  const wood = item({ key: "r1", type: "road_closure", title: "Wood Valley Road — Closed in Both Directions", body: "Use Mamalahoa Hwy." });
  const mam = item({ key: "r2", type: "road_closure", title: "Mamalahoa Highway — One Lane Open" });
  const plain: [string, Plain][] = [["r1", P("Wood Valley Road closed both ways")], ["r2", P("Mamalahoa Highway down to one lane")]];

  const a = ask("is mamalahoa closed", ctx([wood, mam], plain));
  assert.equal(a.items.length, 1);
  assert.equal(a.items[0].key, "r2");

  // A road in the pack with nothing against it is a confident all-clear, not a shrug.
  const b = ask("is saddle road open", ctx([wood, mam], plain));
  assert.equal(b.allClear, true);
  assert.equal(b.say, "No closure reported on Saddle Rd.");
  assert.equal(b.items.length, 0);

  // A route number covers every segment and is answered as the route.
  assert.equal(ask("is highway 11 open", ctx([wood], [plain[0]])).say, "No closure reported on Highway 11.");
  // Never shout a road name back at someone.
  assert.equal(ask("kalanianaole highway", ctx([], [])).say, "No closure reported on Kalanianaole Hwy.");
});

test("ask: an identity word beats a describing word, so 'is school closed' is about school", () => {
  const road = item({ key: "r1", type: "road_closure", title: "Wood Valley Road — Closed in Both Directions" });
  const school = item({ key: "s1", type: "school", title: "School closed: Naalehu Elementary School" });
  const plain: [string, Plain][] = [["r1", P("Wood Valley Road closed both ways")], ["s1", P("Naalehu Elementary School is closed")]];
  const a = ask("is school closed", ctx([road, school], plain));
  assert.equal(a.items[0].key, "s1");
  assert.equal(a.say, "Naalehu Elementary School is closed.");
});

test("ask: storms come from the storm file, and an unread file is never an all-clear", () => {
  // Storms are not snapshot items. Reading them from `items` answered "no storms near Hawaiʻi"
  // with two hurricanes in the basin.
  const storms = [{ name: "Lowell", short: "Lowell is moving away." }, { name: "Karina", short: "Karina is not expected to come near." }];
  const a = ask("hurricane", ctx([], [], { storms }));
  assert.equal(a.allClear, false);
  assert.match(a.say, /Lowell/);
  assert.match(a.say, /Karina/);
  // Naming one storm answers about that storm only.
  assert.equal(ask("wheres lowell", ctx([], [], { storms })).say, "Lowell is moving away.");
  // No storms in a file that did load is a real all-clear.
  assert.equal(ask("hurricane", ctx([], [], { storms: [] })).allClear, true);
  // A file that never loaded is not.
  const unknown = ask("hurricane", ctx([], [], {}));
  assert.equal(unknown.allClear, false);
  assert.match(unknown.say, /not loaded/);
});

test("ask: nonsense gets no answer rather than a wrong one", () => {
  const a = ask("qqqq zzzz", ctx([item({ key: "r1", type: "road_closure", title: "Wood Valley Road — Closed" })], [["r1", P("Wood Valley Road closed")]]));
  assert.equal(a.say, "");
  assert.equal(a.items.length, 0);
  assert.equal(a.allClear, false);
  assert.equal(ask("", ctx([], [])).say, "");
});

const TIDE = {
  station: "1617760", name: "Hilo Bay",
  t0: Date.UTC(2026, 8, 3, 19, 0),   // 9am HST
  h: [2.2, 2.3, 2.2, 2.0],
  hl: [
    { t: Date.UTC(2026, 8, 3, 20, 18), v: 2.348, hi: true },   // 10:18am HST
    { t: Date.UTC(2026, 8, 4, 13, 11), v: 0.276, hi: false },  // 3:11am HST next day
  ],
};

test("ask: the tide table answers, and does not get mistaken for surf", () => {
  const surf = item({ key: "s1", type: "advisory", title: "High Surf Advisory", body: "Surf 12 to 16 feet on east shores." });
  const plain: [string, Plain][] = [["s1", P("Big surf on the east shore", 2)]];
  const c = ctx([surf], plain, { tide: TIDE, now });

  for (const q of ["when is high tide", "tides", "what time is low tide", "tide today"]) {
    const a = ask(q, c);
    assert.equal(a.topic?.key, "tides", `"${q}" should be a tide question`);
    assert.match(a.say, /tide is 2\.3 ft at 10:18 AM|tide is 2\.3 ft at 10:18 AM/, `"${q}" -> ${a.say}`);
    assert.match(a.say, /Hilo Bay/);
    assert.match(a.say, /Then low 0\.3 ft/, "the turn after it comes too");
    assert.equal(a.href, "/weather/");
  }

  // "high surf" is still weather's question, not the tide table's — the surf item must win.
  const s = ask("how big is the surf", c);
  assert.equal(s.topic?.key, "weather");
  assert.equal(s.items[0]?.key, "s1");
});

test("ask: a tide table that has not loaded says so, and never claims an all-clear", () => {
  const a = ask("when is high tide", ctx([], [], { now }));
  assert.equal(a.topic?.key, "tides");
  assert.equal(a.allClear, false, "there is always a next tide — silence here is not an all-clear");
  assert.match(a.say, /not loaded/);
});

test("ask: a tide table whose turns are all in the past says so rather than naming a stale time", () => {
  const a = ask("high tide", ctx([], [], { tide: TIDE, now: Date.UTC(2026, 8, 6, 0, 0) }));
  assert.match(a.say, /run out/);
  assert.doesNotMatch(a.say, /10:18/, "a turn two days gone must not be offered as the next one");
});

const fill = (v: number) => Array<number>(24).fill(v);
const WX: Weather = {
  upd: now, island: "hawaii", buoys: [],
  towns: [{ id: "hilo", name: "Hilo", fc: [], hourly: { t0: now, t: fill(78), p: fill(70), w: fill(8), wd: fill(2), c: fill(5), n: fill(0), rh: fill(70) } }],
  surf: parseSrf(readFileSync(new URL("../fixtures/srf-hfo.txt", import.meta.url), "utf8")),
  air: [{ name: "Hilo", pm25: 42, cat: "Good", at: now }, { name: "Kona", pm25: 112, cat: "Unhealthy for Sensitive Groups", at: now }],
};

test("ask: rain, surf, vog and sunset are answered from the weather file, not with 'no weather warning'", () => {
  const c = ctx([], [], { wx: WX, now });
  assert.equal(ask("is it going to rain today", c).say, "Hilo: Showers likely throughout the day.");
  assert.match(ask("surf", c).say, /^Surf is \d+ to \d+ feet on (north|east|south|west)-facing shores/);
  // The number is the index, never micrograms, and the worst monitor is the one named.
  assert.equal(ask("vog today", c).say, "The air quality index is 112 in Kona: unhealthy for sensitive groups.");
  assert.match(ask("when is sunset", c).say, /^Sunrise is at \d:\d\d AM and sunset at \d:\d\d PM in Hilo\.$/);
  assert.match(ask("is it windy", c).say, /^Wind in Hilo is 8 mph/);
  for (const q of ["is it going to rain today", "surf", "vog today", "when is sunset"]) {
    const a = ask(q, c);
    assert.equal(a.topic?.key, "weather", q);
    assert.equal(a.allClear, false, q);
  }
  // A weather file that has not loaded is not a quiet sky.
  const cold = ask("is it going to rain today", ctx([], []));
  assert.match(cold.say, /not loaded/);
  assert.equal(cold.allClear, false);
});

test("ask: power is never an all-clear, because no power company gives Kilo a feed", () => {
  const police = item({ key: "p1", type: "notice", source: "hpd", districts: ["Puna"], title: "Missing person in Puna", body: "Police ask for help. Power outage in Puna is not part of this." });
  const boil = item({ key: "w1", type: "outage", source: "hidws", title: "Boil water notice for Puna", body: "Water outage." });
  const plain: [string, Plain][] = [["p1", P("Police are looking for a missing person")], ["w1", P("Boil your water in Puna", 3)]];

  const a = ask("power outage in Puna", ctx([police, boil], plain));
  assert.match(a.say, /no feed from Hawaiian Electric/);
  assert.equal(a.allClear, false);
  assert.equal(a.items.length, 0, "neither a police notice nor a water notice answers a power question");
  assert.match(a.link!.url, /hawaiianelectric\.com/);
  assert.match(ask("is the power out", ctx([], [], { island: "kauai" })).link!.url, /kiuc\.coop/);
  // "outage" alone could be either, so the water notice rides along under the power line.
  assert.equal(ask("any outages", ctx([police, boil], plain)).items[0]?.key, "w1");

  // Water has a feed on Hawaiʻi Island only.
  assert.equal(ask("boil water", ctx([police, boil], plain)).say, "Boil your water in Puna.");
  const quiet = ask("is the water safe", ctx([police], [plain[0]]));
  assert.equal(quiet.allClear, true);
  assert.match(quiet.say, /No water notices/);
  const oahu = ask("is the water safe", ctx([], [], { island: "oahu" }));
  assert.equal(oahu.allClear, false);
  assert.match(oahu.say, /no feed/);
  // Schools and shelters likewise come from one county.
  assert.equal(ask("is school closed", ctx([], [])).allClear, true);
  assert.equal(ask("is school closed", ctx([], [], { island: "maui" })).allClear, false);
  assert.match(ask("are shelters open", ctx([], [], { island: "maui" })).say, /no feed/);
});

test("ask: a topic is a filter, so a question about one thing never returns another", () => {
  const road = item({ key: "r1", type: "road_closure", districts: ["Puna"], title: "School Road closed in Puna", body: "School traffic affected. Closed." });
  const a = ask("is school closed in Puna", ctx([road], [["r1", P("School Road closed")]]));
  assert.equal(a.items.length, 0);
  assert.equal(a.say, NOTHING.school);
  // And everything of the topic's kind answers, whether or not it repeats the question's words.
  const quake = item({ key: "q1", type: "quake", title: "M 4.2 - 5 km S of Volcano" });
  assert.equal(ask("any earthquakes", ctx([quake], [["q1", P("A 4.2 near Volcano")]])).say, "A 4.2 near Volcano.");
});

test("ask: every suggested question gets a real answer on its island", () => {
  for (const island of ["hawaii", "maui", "oahu", "kauai"] as const) {
    const roads = JSON.parse(readFileSync(new URL(`../public/${island}-roads.json`, import.meta.url), "utf8")).lines;
    const qs = examples(island);
    assert.ok(qs.length >= 4 && qs.length <= 6);
    for (const q of qs) {
      const a = ask(q, { items: [], plain: new Map(), storms: [], roads, island, wx: { ...WX, island }, tide: TIDE, now });
      assert.ok(a.say, `${island}: "${q}" got no answer`);
      assert.ok(!Object.values(NOTHING).includes(a.say), `${island}: "${q}" -> ${a.say}`);
      assert.doesNotMatch(a.say, /not loaded|run out|has no/, `${island}: "${q}" -> ${a.say}`);
      if (/open\?$/.test(q)) assert.match(a.say, /^No closure reported on \w+ (Rd|Hwy|Highway)/, `${island}: "${q}" -> ${a.say}`);
    }
  }
});
