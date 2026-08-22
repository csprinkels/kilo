import { test } from "node:test";
import assert from "node:assert/strict";
import { ALERT_GAP_MS, fresh, snapshotStep, sourceStep } from "../lib/watchRules.ts";

const H = 3_600_000;

test("source: 3 fails alert once, a 4th within 6 h is quiet, recovery says back", () => {
  let s = fresh("hdot", 0);
  let r = sourceStep(s, false, "boom", 1 * H); s = r.next; assert.equal(r.alert, undefined);
  r = sourceStep(s, false, "boom", 2 * H); s = r.next; assert.equal(r.alert, undefined);
  r = sourceStep(s, false, "boom", 3 * H); s = r.next; assert.equal(r.alert, "hdot has failed 3 times in a row: boom");
  r = sourceStep(s, false, "boom", 4 * H); s = r.next; assert.equal(r.alert, undefined);
  r = sourceStep(s, true, undefined, 5 * H); s = r.next; assert.equal(r.alert, "hdot is back");
  assert.equal(s.failsInRow, 0);
  r = sourceStep(s, true, undefined, 6 * H); assert.equal(r.alert, undefined, "back is said once");
});

test("source: still broken after 6 h alerts again", () => {
  const s = { ...fresh("hvo", 0), failsInRow: 3, lastAlertAt: 1 };
  assert.equal(sourceStep(s, false, "x", ALERT_GAP_MS).alert, undefined);
  assert.equal(sourceStep(s, false, "x", ALERT_GAP_MS + 1).alert, "hvo has failed 4 times in a row: x");
});

test("source: an ok run with no earlier alert is silent", () => {
  assert.equal(sourceStep(fresh("nws", 0), true, undefined, H).alert, undefined);
});

test("snapshot: stale gen alerts once, fresh gen says it is back", () => {
  let s = fresh("__snapshot", 0);
  let r = snapshotStep(s, 0, 10 * 60_000); s = r.next; assert.equal(r.alert, undefined, "10 min is fine");
  r = snapshotStep(s, 0, 20 * 60_000); s = r.next; assert.equal(r.alert, "Kilo has not updated for 20 minutes");
  r = snapshotStep(s, 0, 30 * 60_000); s = r.next; assert.equal(r.alert, undefined, "no repeat within 6 h");
  r = snapshotStep(s, 40 * 60_000, 41 * 60_000); assert.equal(r.alert, "Kilo is updating again");
});
