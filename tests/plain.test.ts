import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseNws } from "../convex/parsers/nws.ts";
import { parseHccda } from "../convex/parsers/hccda.ts";
import { parseHdot, parseHvo, parsePtwc, parseUsgs } from "../convex/parsers/feeds.ts";
import { BANNED, LEVEL_WORD, SOURCE_NAME, fmtUntil, plainAlert, rankStorms } from "../lib/plain.ts";
import { ISLAND_POINTS } from "../lib/storm.ts";
import { ISLAND_LABEL, TYPE_LABEL } from "../lib/brand.ts";
import type { Item } from "../lib/types.ts";

const fx = (f: string) => JSON.parse(readFileSync(new URL(`../fixtures/${f}`, import.meta.url), "utf8"));
const txt = (f: string) => readFileSync(new URL(`../fixtures/${f}`, import.meta.url), "utf8");
const NOW = Date.parse("2026-08-19T21:00:00-10:00");
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const sentences = (s: string) => s.split(/(?<=[.!?])\s+/).filter(Boolean);
const banned = (s: string) => BANNED.find((re) => re.test(s));

const ITEMS: Item[] = [
  ...parseNws(fx("nws-alerts-lala.json"), NOW),
  ...parseHccda("shelters", fx("hccda-emergency_shelters.json"), NOW),
  ...parseHccda("roads", fx("hccda-road_closures.json"), NOW),
  ...parseHccda("schools", fx("hccda-school_closures.json"), NOW),
  ...parseUsgs(fx("usgs-hi.json"), NOW),
  ...parseHvo(fx("hvo-elevated.json"), NOW),
  ...parseHdot(fx("hdot-current.json"), NOW),
  ...parsePtwc(txt("ptwc.atom"), Date.parse("2026-08-12T04:00:00Z")),
];

test("plain: every fixture item gets a headline with no agency jargon, ≤ 20 words, sentences ≤ 20 words", () => {
  assert.ok(ITEMS.length > 80, `only ${ITEMS.length} items`);
  for (const i of ITEMS) {
    const p = plainAlert(i, NOW);
    assert.ok(p.headline.length > 0, `empty headline for ${i.key}`);
    assert.ok(words(p.headline) <= 20, `headline too long (${words(p.headline)}): "${p.headline}"`);
    assert.equal(banned(p.headline), undefined, `banned word in headline "${p.headline}" (${i.key})`);
    assert.equal(banned(p.action), undefined, `banned word in action "${p.action}" (${i.key})`);
    for (const s of sentences(p.action)) assert.ok(words(s) <= 20, `action sentence too long: "${s}"`);
    assert.ok(p.level >= 0 && p.level <= 4);
    assert.ok(p.source.length > 0);
  }
});

test("plain: the words a person reads for the big ones", () => {
  const by = (f: (i: Item) => boolean) => plainAlert(ITEMS.find(f)!, NOW);
  const hu = by((i) => i.fields?.event === "Hurricane Warning");
  assert.match(hu.headline, /^Hurricane expected (in|on) /);
  assert.equal(hu.level, 4);
  assert.match(hu.action, /Civil Defense/);
  const fa = by((i) => i.fields?.event === "Flood Advisory");
  assert.match(fa.headline, /^Roads may flood (in|on) /);
  assert.equal(fa.level, 2);
  const ffw = by((i) => i.fields?.event === "Flash Flood Warning");
  assert.match(ffw.headline, /^Flooding now (in|on) /);
  assert.match(ffw.action, /^Do not drive through water/);
  const sh = by((i) => i.type === "shelter");
  assert.match(sh.headline, / is open$/);
  assert.doesNotMatch(sh.headline, /Shelter OPEN/);
  assert.match(sh.action, /medicine/);
  const rd = by((i) => i.type === "road_closure" && i.source.startsWith("hccda"));
  assert.match(rd.headline, /closed|one lane|open again/);
  assert.ok(/^Use .* instead\.$|^No way around listed yet\.$|^Detour: |^$/.test(rd.action), rd.action);
  const lane = by((i) => i.source === "hdot");
  assert.match(lane.headline, /^One lane on Highway \d+/);
  assert.equal(lane.level, 1);
  const q = by((i) => i.type === "quake");
  assert.match(q.headline, /^(Small quake|Weak shaking|Light shaking|Moderate shaking|Strong shaking|Very strong shaking) near /);
  assert.doesNotMatch(q.headline, /\bM\s?\d/);
  const ts = by((i) => i.type === "tsunami");
  assert.equal(ts.level, 0, "an information statement is never an alert");
  assert.match(ts.headline, /No tsunami danger/);
  const v = by((i) => i.type === "volcano");
  assert.match(v.headline, /^(Kīlauea|Mauna Loa) is (quiet|active)$|dangerous eruption/);
  const sc = by((i) => i.type === "school");
  assert.match(sc.headline, / is closed/);
  assert.equal(sc.action, "Keep kids home.");
});

test("plain: until is a clock time, never a duration", () => {
  const now = Date.parse("2026-08-19T09:00:00-10:00");
  assert.equal(fmtUntil(now + 3 * 3_600_000, now), "until 12 PM");
  assert.equal(fmtUntil(now + 26 * 3_600_000, now), "until tomorrow 11 AM");
  assert.equal(fmtUntil(now + 3 * 86_400_000, now), "until Saturday 9 AM");
  assert.equal(fmtUntil(now - 1, now), undefined);
  assert.equal(fmtUntil(undefined, now), undefined);
});

// Every event type NWS Honolulu issues for the islands and the surrounding marine zones. This list is the
// contract: an event that reaches a reader as the agency's own label is a bug, so a new one fails here first.
const HFO_EVENTS = [
  "Hurricane Warning", "Hurricane Watch", "Hurricane Local Statement", "Hurricane Force Wind Warning",
  "Tropical Storm Warning", "Tropical Storm Watch", "Tropical Cyclone Statement", "Tropical Cyclone Local Statement",
  "Tsunami Warning", "Tsunami Advisory", "Tsunami Watch",
  "Flash Flood Warning", "Flash Flood Watch", "Flash Flood Statement",
  "Flood Warning", "Flood Watch", "Flood Advisory", "Flood Statement", "Hydrologic Outlook",
  "Coastal Flood Warning", "Coastal Flood Advisory", "Coastal Flood Statement",
  "High Wind Warning", "High Wind Watch", "Wind Advisory", "Extreme Wind Warning",
  "High Surf Warning", "High Surf Advisory", "Beach Hazards Statement", "Rip Current Statement",
  "Red Flag Warning", "Fire Weather Watch",
  "Heat Advisory", "Excessive Heat Warning", "Extreme Heat Warning", "Extreme Heat Watch",
  "Air Quality Alert", "Ashfall Advisory", "Ashfall Warning", "Volcanic Ashfall Advisory", "Brown Water Advisory",
  "Dense Fog Advisory", "Frost Advisory",
  "Winter Weather Advisory", "Winter Storm Warning", "Blizzard Warning",
  "Small Craft Advisory", "Gale Warning", "Gale Watch", "Storm Warning", "Hazardous Seas Warning",
  "Special Marine Warning", "Marine Weather Statement", "Special Weather Statement",
  "Severe Thunderstorm Warning", "Tornado Warning",
];
const nwsItem = (event: string): Item => ({
  key: `nws:${event}`, source: "nws", type: /Tsunami/.test(event) ? "tsunami" : "advisory", tier: "official",
  sev: 2, islands: ["oahu"], districts: [], title: `${event}: Oahu North Shore`, body: "…", srcUrl: "",
  fields: { event, areaDesc: "Oahu North Shore" }, issuedAt: NOW, lastConfirmedAt: NOW, hash: "x",
});

test("plain: every NWS event has plain words, never the agency's label, and something to do when it matters", () => {
  for (const event of HFO_EVENTS) {
    const p = plainAlert(nwsItem(event), NOW);
    assert.equal(banned(p.headline), undefined, `banned word for "${event}": "${p.headline}"`);
    assert.equal(banned(p.action), undefined, `banned word in action for "${event}": "${p.action}"`);
    assert.ok(!p.headline.startsWith(event), `"${event}" falls through to the agency's own title`);
    assert.ok(words(p.headline) <= 20, `headline too long for "${event}": "${p.headline}"`);
    for (const s of sentences(p.action)) assert.ok(words(s) <= 20, `action sentence too long for "${event}": "${s}"`);
    if (p.level >= 2) assert.ok(p.action.length > 0, `"${event}" is level ${p.level} with nothing to do`);
  }
});

test("plain: an NWS event nobody has written words for is still safe to show", () => {
  // The fallback must strip the label, pick an urgency off the last word, and always leave an action.
  const dust = plainAlert(nwsItem("Dust Storm Warning"), NOW);
  assert.equal(dust.headline, "Dust Storm on Oahu North Shore");
  assert.equal(dust.level, 3);
  assert.ok(dust.action.length > 0);
  const watch = plainAlert(nwsItem("Dust Storm Watch"), NOW);
  assert.equal(watch.level, 2);
  // An event whose own name carries a word we never print falls back to a plain headline.
  const jargon = plainAlert(nwsItem("Tropical Cyclone Wind Advisory"), NOW);
  assert.equal(banned(jargon.headline), undefined, jargon.headline);
  assert.match(jargon.headline, /^Weather notice /);
});

test("plain: level words, source names and brand labels are jargon-free", () => {
  for (const s of [...Object.values(LEVEL_WORD), ...Object.values(SOURCE_NAME), ...Object.values(ISLAND_LABEL), ...Object.values(TYPE_LABEL)]) {
    assert.equal(banned(s), undefined, `banned word in "${s}"`);
  }
});

test("detours: the county's alternate-route wording matches roads in the offline pack, and never guesses", async () => {
  const { matchDetour } = await import("../lib/roads.ts");
  const pack = JSON.parse(readFileSync(new URL("../public/hawaii-roads.json", import.meta.url), "utf8")).lines;
  const names = (alt: string) => [...new Set(matchDetour(alt, pack).map((l: { n: string; r: number }) => `${l.n}|${l.r}`))];
  assert.ok(names("Highway 19").length > 0 && names("Highway 19").every((n) => n.endsWith("|19")));
  assert.ok(names("Hawaii Belt Road (Highway 11)").some((n) => n.endsWith("|11")));
  assert.ok(names("Hwy 190").every((n) => n.endsWith("|190")) && names("Hwy 190").length > 0);
  assert.ok(names("Old Mamalahoa Highway").length > 0 && names("Old Mamalahoa Highway").every((n) => /Old Mamalahoa/.test(n)));
  assert.ok(names("Saddle Road").some((n) => /Saddle/.test(n)));
  assert.ok(names("Akoni Pule Highway").some((n) => /Akoni Pule/.test(n)));
  assert.ok(names("Alii Drive or Highway 180").some((n) => n.endsWith("|180")));
  for (const none of ["", "None", "none", "Non reported at this time", "Kamehameha or Kapiolani"]) assert.deepEqual(names(none).filter((n) => !/Kamehameha/.test(n)), [], none);
});

test("the storm that comes near leads; one that stays 1,000 miles out is 'not expected to come near'", () => {
  // Real advisories from Aug 20 2026: Lala (hurricane, 1,148 mi NW, tracking north) and Two-C (depression, due to pass ~220 mi south on Sunday).
  const lines = rankStorms(fx("storms-lala-twoc.json").storms, ISLAND_POINTS.hawaii);
  assert.equal(lines[0].s.name, "Two-C");
  assert.ok(lines[0].approaching);
  assert.match(lines[0].short, /^Two-C: closest Sun.*about 2\d0 miles south\.$/);
  const lala = lines.find((l) => l.s.name === "Lala")!;
  assert.equal(lala.approaching, false);
  assert.equal(lala.short, "Lala is not expected to come near.");
  assert.match(lala.text, /not expected to come near Hawaiʻi Island/);
  for (const l of lines) { assert.equal(banned(l.text), undefined, l.text); assert.equal(banned(l.short), undefined, l.short); }
});
