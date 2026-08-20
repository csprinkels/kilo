import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseNws } from "../convex/parsers/nws.ts";
import { parseHccda } from "../convex/parsers/hccda.ts";
import { parseHdot, parseHvo, parsePtwc, parseUsgs } from "../convex/parsers/feeds.ts";
import { BANNED, LEVEL_WORD, SOURCE_NAME, fmtUntil, plainAlert } from "../lib/plain.ts";
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
  assert.ok(/^Use .* instead\.$|^No other route listed\.$|^$/.test(rd.action), rd.action);
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

test("plain: level words, source names and brand labels are jargon-free", () => {
  for (const s of [...Object.values(LEVEL_WORD), ...Object.values(SOURCE_NAME), ...Object.values(ISLAND_LABEL), ...Object.values(TYPE_LABEL)]) {
    assert.equal(banned(s), undefined, `banned word in "${s}"`);
  }
});
