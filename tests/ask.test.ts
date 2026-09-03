import { test } from "node:test";
import assert from "node:assert/strict";
import { ask, type AskCtx } from "../lib/ask.ts";
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
