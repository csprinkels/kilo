import { test } from "node:test";
import assert from "node:assert/strict";
import { nowStory, officialExtra, topicRows } from "../lib/now.ts";
import type { Plain } from "../lib/plain.ts";
import type { Item } from "../lib/types.ts";

const now = Date.UTC(2026, 7, 26, 23, 0); // 1 PM HST Wed Aug 26
const item = (o: Partial<Item> & { key: string; type: Item["type"] }): Item => ({
  source: "hccda:roads", tier: "official", sev: 2, islands: ["hawaii"], districts: [], title: "", body: "", srcUrl: "",
  issuedAt: now - 3_600_000, lastConfirmedAt: now, hash: "", ...o,
});
const P = (headline: string, level: Plain["level"] = 2, action = "") => ({ headline, action, level }) as Plain;

test("topicRows: a quiet island says so in the same six lines every time", () => {
  const rows = topicRows([], new Map(), "hawaii", now, [], false);
  assert.deepEqual(rows.map((r) => [r.key, r.quiet]), [["roads", true], ["storms", true], ["quakes", true], ["volcano", true], ["tsunami", true], ["neighbors", true]]);
  assert.equal(rows[0].text, "No crashes or closures reported.");
  assert.equal(rows[1].text, "None near Hawaiʻi.");
  assert.equal(rows[2].text, "Nothing big in the last few days.");
  assert.equal(rows[3].text, "Kīlauea is taking a rest.");
  assert.equal(rows[4].text, "The ocean is fine.");
  assert.equal(rows[5].text, "Nobody posted today.");
  // Reports is a Hawaiʻi Island thing for now
  assert.equal(topicRows([], new Map(), "maui", now, [], false).length, 5);
});

test("topicRows: closures lead with the first headline and count the rest; HDOT roadwork never counts as a closure", () => {
  const a = item({ key: "r1", type: "road_closure" }), b = item({ key: "r2", type: "road_closure" }), c = item({ key: "t1", type: "traffic" });
  const hdot = item({ key: "h1", type: "road_closure", source: "hdot" });
  const plain = new Map([["r1", P("Wood Valley Road closed both ways in Kaʻū")], ["r2", P("Highway 11 one lane near Volcano")], ["t1", P("Crash on Highway 19 near Hilo")]]);
  const loud = topicRows([a, b, c, hdot], plain, "hawaii", now, [], false)[0];
  assert.equal(loud.text, "Wood Valley Road closed both ways in Kaʻū. 2 more.");
  assert.equal(loud.quiet, false);
  const quiet = topicRows([hdot, hdot], new Map(), "hawaii", now, [], false)[0];
  assert.equal(quiet.text, "No crashes or closures reported. 2 roadwork sites today.");
  assert.equal(quiet.quiet, true);
});

test("topicRows: the quake fallback only speaks up at M3+, and community reports never pass as official", () => {
  const small = item({ key: "q1", type: "quake", title: "M 2.4 - 5 km S of Volcano, Hawaii", fields: { mag: "2.4" } });
  const big = item({ key: "q2", type: "quake", title: "M 3.6 - 10 km SE of Pāhala, Hawaii", fields: { mag: "3.6" } });
  assert.equal(topicRows([small], new Map(), "hawaii", now, [], false)[2].text, "Nothing big in the last few days.");
  const q = topicRows([small, big], new Map(), "hawaii", now, [], false)[2];
  assert.match(q.text, /^A 3\.6 near Pāhala .*\. No tsunami\.$/);
  assert.equal(q.quiet, false);
  // the quake file wins over the snapshot when it has loaded
  assert.equal(topicRows([big], new Map(), "hawaii", now, [], false, "Nothing big this week.")[2].quiet, true);

  const post = item({ key: "c1", type: "notice", tier: "community", source: "report" });
  const rows = topicRows([post], new Map([["c1", P("Flooded road by the park")]]), "hawaii", now, [], false);
  assert.equal(rows[0].quiet, true);
  assert.equal(rows[5].text, "1 report today. Latest: Flooded road by the park.");
});

test("nowStory: storm > warning > shelter > roads > ordinary day, and the sub line never repeats the title", () => {
  const roadsQuiet = { key: "roads", label: "Roads", text: "No crashes or closures reported.", href: "/traffic/", quiet: true };
  const roadsLoud = { ...roadsQuiet, text: "Wood Valley Road closed both ways in Kaʻū. 2 more.", quiet: false };
  const island = "Hawaiʻi Island";
  assert.deepEqual(nowStory({ roads: roadsQuiet, island }), { title: "Here's what's on Hawaiʻi Island today.", sub: "Nothing urgent. Roads and weather are below." });
  assert.deepEqual(nowStory({ roads: roadsLoud, island }), { title: "Wood Valley Road closed both ways in Kaʻū.", sub: "The rest of the island looks ordinary." });
  const shelter = P("Naalehu Elementary School is open", 2, "Bring medicine, ID, food and bedding.");
  assert.deepEqual(nowStory({ roads: roadsQuiet, shelterPlain: shelter, island }), { title: "Naalehu Elementary School is open.", sub: "Bring medicine, ID, food and bedding." });
  const lead = P("Boil your water in Kaʻū", 3, "Boil water one minute before you drink or cook with it.");
  assert.deepEqual(nowStory({ roads: roadsLoud, shelterPlain: shelter, leadPlain: lead, island }), { title: "Boil your water in Kaʻū.", sub: "Wood Valley Road closed both ways in Kaʻū. Naalehu Elementary School is open" });
  const storm = { s: { name: "Lala" }, text: "Lala passes south of the island Saturday night." } as Parameters<typeof nowStory>[0]["storm"];
  assert.equal(nowStory({ storm, roads: roadsQuiet, island }).title, "A storm is coming this weekend.");
  assert.equal(nowStory({ storm: { ...storm!, text: "Lala passes south tonight." }, roads: roadsQuiet, island }).title, "Lala is headed this way.");
});

test("officialExtra: shows the agency text only when the plain headline did not already say it", () => {
  const i = item({ key: "x", type: "advisory", title: "Flood Advisory", body: "Heavy rain over the Puna district until 9 PM." });
  assert.equal(officialExtra(i, "Roads may flood in Puna until 9 PM"), "Heavy rain over the Puna district until 9 PM.");
  assert.equal(officialExtra({ ...i, body: "" }, "Flood Advisory for Puna"), undefined);
  assert.equal(officialExtra({ ...i, body: "" }, "Roads may flood in Puna"), "Flood Advisory");
});

test("topicRows: a storm in the basin gets a card even when it is not coming here", () => {
  // The reported bug: two hurricanes live, neither 'approaching' this island, and Storms collapsed
  // into the tile grid at the foot of the page. A named storm is always worth its own card.
  const both = ["Lowell is moving away.", "Karina is not expected to come near."];
  const storms = topicRows([], new Map(), "hawaii", now, both, false)[1];
  assert.equal(storms.quiet, false);
  assert.equal(storms.text, "Lowell is moving away. Karina is not expected to come near.");
  assert.equal(storms.href, "/storms/");
  // Nothing in the basin is the only quiet case.
  assert.equal(topicRows([], new Map(), "hawaii", now, [], false)[1].quiet, true);
});

test("topicRows: a routine volcano status stays a tile; a watch earns a card", () => {
  const status = item({ key: "v1", type: "volcano" });
  const quiet = topicRows([status], new Map([["v1", P("Kīlauea is quiet", 0)]]), "hawaii", now, [], false)[3];
  assert.equal(quiet.quiet, true, "HVO publishes every day; 'quiet' is not news");
  assert.equal(quiet.text, "Kīlauea is taking a rest.");
  const watch = topicRows([status], new Map([["v1", P("Kīlauea is active", 1)]]), "hawaii", now, [], false)[3];
  assert.equal(watch.quiet, false);
  assert.equal(watch.text, "Kīlauea is active.");
});

test("topicRows: a tsunami watch never prints 'The ocean is fine.'", () => {
  // A watch is level 2. The row only went loud at level 3, so during a live watch the page printed
  // an affirmative all-clear about the exact hazard the user opened the app for.
  const watch = item({ key: "t1", type: "tsunami" });
  const row = topicRows([watch], new Map([["t1", P("A tsunami may be coming", 2, "Get ready to leave the coast.")]]), "hawaii", now, [], false)[4];
  assert.equal(row.quiet, false);
  assert.equal(row.text, "A tsunami may be coming");
  // The far-away-quake record is level 0 and stays an all-clear.
  const far = topicRows([watch], new Map([["t1", P("An earthquake happened far away. No tsunami danger for Hawaiʻi.", 0)]]), "hawaii", now, [], false)[4];
  assert.equal(far.quiet, true);
  assert.equal(far.text, "The ocean is fine.");
});

test("topicRows: an unread storms file is never reported as no storms", () => {
  const unknown = topicRows([], new Map(), "hawaii", now, undefined, false)[1];
  assert.equal(unknown.quiet, false, "not knowing is worth a card, on one bar during a storm");
  assert.match(unknown.text, /did not load/);
  assert.equal(topicRows([], new Map(), "hawaii", now, [], false)[1].text, "None near Hawaiʻi.");
});

test("nowStory: a level-2 watch outranks a closed road and never reads 'Nothing urgent'", () => {
  const roadsLoud = { key: "roads", label: "Roads", text: "Wood Valley Road closed both ways in Kaʻū.", href: "/traffic/", quiet: false };
  const roadsQuiet = { ...roadsLoud, text: "No crashes or closures reported.", quiet: true };
  const watch = P("A tsunami may be coming", 2, "Get ready to leave the coast. Keep your phone on.");
  const island = "Hawaiʻi Island";
  assert.deepEqual(nowStory({ roads: roadsQuiet, nextPlain: watch, island }),
    { title: "A tsunami may be coming.", sub: "Get ready to leave the coast. Keep your phone on." });
  // Still beats a road closure, which is what the page used to lead with.
  assert.equal(nowStory({ roads: roadsLoud, nextPlain: watch, island }).title, "A tsunami may be coming.");
  // A real level-3+ warning still outranks it.
  assert.equal(nowStory({ roads: roadsQuiet, leadPlain: P("Tsunami warning", 4, "Leave the evacuation zone now."), nextPlain: watch, island }).title, "Tsunami warning.");
});
