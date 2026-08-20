import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseNws } from "../convex/parsers/nws.ts";
import { parseHccda } from "../convex/parsers/hccda.ts";

const fx = (f: string) => JSON.parse(readFileSync(new URL(`../fixtures/${f}`, import.meta.url), "utf8"));
const NOW = Date.parse("2026-08-19T21:00:00-10:00");

test("NWS: Lala-week alerts map to islands, severities, and end times", () => {
  const items = parseNws(fx("nws-alerts-lala.json"), NOW);
  assert.ok(items.length > 50, `expected many items, got ${items.length}`);
  assert.ok(items.every((i) => i.key.startsWith("nws:") && i.title.length <= 120 && i.body.length <= 600));
  // Cancellations are dropped
  assert.ok(!items.some((i) => i.body.startsWith("The Flood Watch has been cancelled")));
  const hurricane = items.find((i) => i.fields?.event === "Hurricane Warning")!;
  assert.equal(hurricane.sev, 4);
  assert.equal(hurricane.type, "storm");
  assert.ok(hurricane.islands.every((x) => ["hawaii", "maui", "oahu", "kauai"].includes(x)));
  const ffw = items.find((i) => i.fields?.event === "Flash Flood Warning")!;
  assert.equal(ffw.sev, 4, "Flash Flood Warning is life-safety even though NWS says Severe");
  // expiresAt uses `ends` (event end), not `expires` (message staleness)
  const withEnds = fx("nws-alerts-lala.json").features.find(
    (f: { properties: { ends?: string; messageType: string; status: string } }) =>
      f.properties.ends && f.properties.messageType !== "Cancel" && f.properties.status === "Actual",
  );
  const match = items.find((i) => i.key === `nws:${withEnds.properties.id}`)!;
  assert.equal(match.expiresAt, Date.parse(withEnds.properties.ends));
});

test("NWS: empty active feed yields no items", () => {
  assert.deepEqual(parseNws(fx("nws-alerts.json"), NOW), []);
});

test("HCCDA: only open shelters and active closures survive; districts carried", () => {
  const shelters = parseHccda("shelters", fx("hccda-emergency_shelters.json"), NOW);
  assert.equal(shelters.length, 1);
  assert.match(shelters[0].title, /Shelter OPEN: Naalehu Elementary/);
  assert.deepEqual(shelters[0].districts, ["Kau"]);
  assert.ok(shelters[0].lat && shelters[0].lon);

  const roads = parseHccda("roads", fx("hccda-road_closures.json"), NOW);
  assert.equal(roads.length, 19, "20 active rows, one blank junk row skipped");
  assert.ok(roads.every((r) => r.type === "road_closure" && r.islands[0] === "hawaii" && r.districts.length === 1));
  assert.ok(roads.some((r) => r.status === "Closed in Both Directions" && r.sev === 2));
  assert.ok(roads.some((r) => r.status === "One Lane Open" && r.sev === 1));

  assert.equal(parseHccda("evacs", fx("hccda-evacuations.json"), NOW).length, 0, "both evacs are inactive");
  assert.equal(parseHccda("hazards", fx("hccda-hazards.json"), NOW).length, 0);
  assert.equal(parseHccda("schools", fx("hccda-school_closures.json"), NOW).length, 2);
});

test("HCCDA: malformed layer does not throw", () => {
  assert.deepEqual(parseHccda("roads", { features: [] }, NOW), []);
  assert.deepEqual(parseHccda("roads", {} as never, NOW), []);
});

test("new feeds: USGS, HVO, HDOT, HI-EMA, PTWC parse their fixtures", async () => {
  const { parseUsgs, parseHvo, parseHdot, parseHiema, parsePtwc } = await import("../convex/parsers/feeds.ts");
  const now = Date.parse("2026-08-19T21:00:00-10:00");
  const txt = (f: string) => readFileSync(new URL(`../fixtures/${f}`, import.meta.url), "utf8");

  const quakes = parseUsgs(fx("usgs-hi.json"), now);
  assert.ok(quakes.length >= 1 && quakes.length <= 20);
  assert.ok(quakes.every((q) => q.islands[0] === "hawaii" && q.type === "quake" && now - q.issuedAt < 3 * 86_400_000));
  assert.ok(quakes.some((q) => q.fields?.mag === "4.1" && q.sev === 2));

  const volcanoes = parseHvo(fx("hvo-elevated.json"), now);
  assert.equal(volcanoes.length, 1);
  assert.match(volcanoes[0].title, /Kīlauea: ADVISORY \/ YELLOW/);
  assert.equal(volcanoes[0].sev, 1, "chronic YELLOW is informational, not a warning");

  const lanes = parseHdot(fx("hdot-current.json"), now);
  assert.ok(lanes.length > 0 && lanes.length < 32, `expected dedupe by project, got ${lanes.length}`);
  assert.ok(lanes.every((l) => l.sev === 1 && ["oahu", "maui", "kauai", "hawaii"].includes(l.islands[0])));

  const notices = parseHiema(txt("hiema.rss"), now);
  assert.ok(notices.length >= 1);
  assert.match(notices[0].title, /Lala/);
  assert.ok(!/<|&#8230;/.test(notices[0].body), "HTML and entities stripped");
  assert.deepEqual(notices[0].islands, ["state"]);

  const tsunami = parsePtwc(txt("ptwc.atom"), now);
  assert.equal(tsunami.length, 0, "a week-old information statement has aged out");
  const fresh = parsePtwc(txt("ptwc.atom"), Date.parse("2026-08-12T04:00:00Z"));
  assert.equal(fresh.length, 1);
  assert.equal(fresh[0].sev, 1);
  assert.match(fresh[0].title, /TSUNAMI INFORMATION STATEMENT.*LOIHI/);
  assert.equal(fresh[0].srcUrl, "https://www.tsunami.gov/events/PHEB/2026/08/12/26224050/1/WEHW42/WEHW42.txt");
});


test("HCCDA items carry the per-layer source id", () => {
  const roads = parseHccda("roads", fx("hccda-road_closures.json"), NOW);
  assert.ok(roads.every((r) => r.source === "hccda:roads"));
});
