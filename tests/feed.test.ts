import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFeed, foldRuns, pinned, RUN_LIMIT, type FeedRow } from "../lib/feed.ts";
import type { Plain } from "../lib/plain.ts";
import type { Item } from "../lib/types.ts";

const now = Date.UTC(2026, 8, 3, 22, 50);
const item = (o: Partial<Item> & { key: string; type: Item["type"] }): Item => ({
  source: "hccda:roads", tier: "official", sev: 2, islands: ["hawaii"], districts: [], title: "", body: "", srcUrl: "",
  issuedAt: now - 3_600_000, lastConfirmedAt: now, hash: "", ...o,
});
const P = (headline: string, level: Plain["level"], action = "", source = "Civil Defense") =>
  ({ headline, action, level, source }) as Plain;

test("the pin takes hazards that change today; a closed road is news, not a hazard", () => {
  // Level 2 alone is this app's default bucket, so pinning on level put 25 rows above the fold.
  const items = [
    item({ key: "a", type: "road_closure" }),      // level 2, but a road: feed
    item({ key: "b", type: "tsunami" }),           // level 4: pin
    item({ key: "c", type: "school" }),            // level 2 hazard: pin
    item({ key: "d", type: "notice" }),            // level 2, a notice: feed
  ];
  const plain = new Map([
    ["a", P("Wood Valley Road closed", 2)],
    ["b", P("Tsunami warning", 4, "Leave the evacuation zone now.")],
    ["c", P("Naalehu Elementary School is closed", 2, "Keep kids home.")],
    ["d", P("A proclamation", 2)],
  ]);
  assert.deepEqual(pinned(items, plain).map((i) => i.key), ["b", "c"], "worst first, level >= 2 only");

  const bands = buildFeed({ items, plain, now, island: "hawaii" });
  const keys = bands.flatMap((b) => b.rows.map((r) => r.key));
  assert.deepEqual(keys.sort(), ["a", "d"], "the feed is the exact complement of the pin");
  assert.deepEqual(bands.map((b) => b.label), ["Also happening today"]);
});

test("a run longer than the limit folds, and says how many it folded", () => {
  const rows: FeedRow[] = Array.from({ length: 16 }, (_, i) => ({
    key: `r${i}`, topic: "roads", at: now - i * 60_000, headline: `Road ${i} closed.`, sub: "", source: "Civil Defense",
    when: "8:04 AM", level: 1 as const, href: "/traffic/",
  }));
  rows.push({ key: "q1", topic: "quakes", at: now, headline: "A 3.2 near Pāhala.", sub: "", source: "USGS", when: "12:39 PM", level: 1, href: "/quakes/" });
  const { rows: kept, folded } = foldRuns(rows);
  assert.equal(kept.filter((r) => r.topic === "roads").length, RUN_LIMIT);
  assert.equal(folded.roads, 16 - RUN_LIMIT, "the count is what was dropped, not what was shown");
  assert.equal(kept.filter((r) => r.topic === "quakes").length, 1, "a short run is never folded");
  assert.equal(folded.quakes, undefined);
});

test("a row gets a picture only when the thing has a real position", () => {
  const items = [
    item({ key: "road", type: "road_closure", path: [[19.5, -155.5], [19.6, -155.4]] }),
    item({ key: "quake", type: "quake", lat: 19.2, lon: -155.48 }),
    item({ key: "notice", type: "notice" }),
  ];
  const plain = new Map([
    ["road", P("Road closed", 2)], ["quake", P("A 3.2 near Pāhala", 1)], ["notice", P("A proclamation", 0)],
  ]);
  const rows = buildFeed({ items, plain, now, island: "hawaii" }).flatMap((b) => b.rows);
  const by = Object.fromEntries(rows.map((r) => [r.key, r]));
  assert.equal(by.road.mark?.kind, "path");
  assert.equal(by.quake.mark?.kind, "dot");
  assert.equal(by.notice.mark, undefined, "a notice has no position, so it gets no map");
});

test("a storm that is not coming here is a feed row; one that is belongs to the pin", () => {
  const storm = (id: string, level: 0 | 1 | 2 | 3 | 4, short: string) =>
    ({ s: { id, name: id, lat: 13.5, lon: -157.2, issuedAt: now - 7_200_000 }, short, text: short, level, approaching: level >= 2, closestMi: 400 }) as never;
  const bands = buildFeed({
    items: [], plain: new Map(), now, island: "hawaii",
    storms: [storm("lowell", 0, "Lowell is moving away."), storm("coming", 3, "Coming: strong winds.")],
  });
  const rows = bands.flatMap((b) => b.rows);
  assert.deepEqual(rows.map((r) => r.key), ["storm:lowell"], "only the one that is not coming");
  assert.equal(rows[0].mark?.kind, "dot", "a storm is placed by its own position");
  assert.equal(rows[0].source, "the Hurricane Center");
});
