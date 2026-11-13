import { test } from "node:test";
import assert from "node:assert/strict";
import { DEDUPE_MS, MIN_GAP_MS, decide, escalated, reached, worstHeld, type LogRow } from "../lib/pushRules.ts";

const MIN = 60_000;
const sentRow = (o: Partial<LogRow>): LogRow => ({ at: 0, trigger: "k", sent: 5, ...o });

test("two different warnings 4 minutes apart both reach the user: the second waits, then sends", () => {
  const log = [sentRow({ at: 0, trigger: "nws:flood", kind: "flood", level: 3 })];
  const wait = decide(4 * MIN, 3, "shelter", log);
  assert.equal(wait, 6 * MIN, "held until the gap ends, not dropped");
  assert.equal(decide(10 * MIN, 3, "shelter", log, true), "send");
  assert.equal(decide(4 * MIN, 3, "shelter", log, true), "send", "a held warning whose turn came is not held twice");
});

test("a reissue of the same warning is silent for 6 hours, then speaks again", () => {
  const log = [sentRow({ at: 0, kind: "flood", level: 3 })];
  assert.equal(decide(30 * MIN, 3, "flood", log), "skip");
  assert.equal(decide(30 * MIN, 3, "flood", log, true), "skip");
  assert.equal(decide(DEDUPE_MS, 3, "flood", log), "send");
  assert.equal(decide(30 * MIN, 3, "wind", log), "send", "another kind is news");
});

test("a level increase always sends; level 4 is never held and never deduped", () => {
  assert.equal(decide(1 * MIN, 4, "volcano", [sentRow({ at: 0, kind: "volcano", level: 3 })]), "send");
  assert.equal(decide(1 * MIN, 4, "volcano", [sentRow({ at: 0, kind: "volcano", level: 4 })]), "send");
  assert.equal(decide(30 * MIN, 3, "volcano", [sentRow({ at: 0, kind: "volcano", level: 2 })]), "send");
  assert.equal(decide(30 * MIN, 3, "volcano", [sentRow({ at: 0, kind: "volcano", level: 4 })]), "skip", "a step down is not a buzz");
});

test("pings, moderator notes and sends that reached nobody neither hold nor silence a warning", () => {
  const noise = [
    sentRow({ at: 0, trigger: "ping" }),
    sentRow({ at: 0, trigger: "report held" }),
    sentRow({ at: 0, sent: 0, kind: "flood", level: 3 }),
    sentRow({ at: 0, sent: 0, kind: "flood", level: 3, held: true }),
  ];
  assert.deepEqual(noise.map(reached), [false, false, false, false]);
  assert.equal(decide(1 * MIN, 3, "flood", noise), "send");
});

test("rows written before kind and level existed still hold the gap but never dedupe", () => {
  const old = [sentRow({ at: 0, trigger: "nws:flood" })];
  assert.equal(decide(MIN_GAP_MS - 1, 3, "flood", old), 1);
  assert.equal(decide(MIN_GAP_MS, 3, "flood", old), "send");
});

test("when the gap ends, one push: the worst held warning still active", () => {
  const held = [
    sentRow({ at: 4 * MIN, trigger: "shelter", sent: 0, level: 3, held: true }),
    sentRow({ at: 6 * MIN, trigger: "evac", sent: 0, level: 3, held: true }),
    sentRow({ at: 7 * MIN, trigger: "gone", sent: 0, level: 3, held: true }),
  ];
  const now: Record<string, number> = { shelter: 3, evac: 4, gone: 0 };
  assert.deepEqual(worstHeld(held, (r) => now[r.trigger]), { trigger: "evac", level: 4, at: 6 * MIN });
  assert.equal(worstHeld(held, (r) => (r.trigger === "gone" ? 0 : 3))?.trigger, "shelter", "the first of equals");
  assert.equal(worstHeld(held, () => 0), undefined, "nothing left to say");
});

test("an item that climbs into warning territory in place is news; a change at the same level is not", () => {
  assert.equal(escalated(2, 3), true);
  assert.equal(escalated(3, 4), true);
  assert.equal(escalated(3, 3), false);
  assert.equal(escalated(1, 2), false);
  assert.equal(escalated(4, 3), false);
});

test("a new warning of the same kind after the first one expired is news; before it expired it is a reissue", () => {
  const sentAt = 0, until = 3_600_000;
  const log = [{ at: sentAt, trigger: "a", sent: 5, kind: "k", level: 3, until }];
  assert.equal(decide(until - 60_000, 3, "k", log), "skip");
  assert.equal(decide(until + 3 * 3_600_000, 3, "k", log), "send");
});
