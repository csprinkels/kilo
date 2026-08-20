import { test } from "node:test";
import assert from "node:assert/strict";
import { REPORT_TYPES, afterVote, holdReason, reportToItem, validateReport } from "../lib/reportRules.ts";

test("holdReason: catches people-identifying content, leaves road talk alone", () => {
  const held: [string, string][] = [
    ["White truck HZA 123 hit the guardrail", "plate"], ["plate hza-123 fled", "plate"], ["motorcycle 123 XBC", "plate"],
    ["call me 808-555-1234", "phone"], ["(808) 555 1234 for info", "phone"],
    ["email me joe@example.com", "contact"], ["see www.foo.com", "contact"], ["@bigisland_joe stole it", "contact"],
    ["Thief John Smith took the bike", "accusation"],
    ["lives at 1234 Kilauea Ave apt 3", "address"],
    ["STOPLIGHT OUT AT PUAINAKO AND KILAUEA GO SLOW", "caps"],
  ];
  for (const [t, r] of held) assert.equal(holdReason(t), r, t);
  const fine = ["Hwy 130 at mile 12 blocked by a tree", "Rte 200 closed", "130 Hwy westbound slow", "3 cars in the ditch, one lane open", "Kilauea Ave and Mohouli light dark", "lost brown dog near Pāhoa 2 hrs ago, red collar", "Route 11 at 1:45 pm water across both lanes", "Power out on Kahoa St since 6am"];
  for (const t of fine) assert.equal(holdReason(t), undefined, t);
});

test("validateReport: limits and districts", () => {
  const ok = { type: "crash", text: "", locText: "Hwy 11 MM 12", island: "hawaii", district: "Puna" };
  assert.equal(validateReport(ok), null);
  assert.match(validateReport({ ...ok, district: "Nowhere" })!, /district/i);
  assert.match(validateReport({ ...ok, island: "maui" })!, /Hawaiʻi Island only/);
  assert.match(validateReport({ ...ok, locText: "Hi" })!, /Where/);
  assert.match(validateReport({ ...ok, text: "x".repeat(281) })!, /280/);
  assert.match(validateReport({ ...ok, type: "other", text: "short" })!, /more/);
  assert.equal(validateReport({ ...ok, type: "other", text: "Cattle loose on Saddle Road" }), null);
});

test("reportToItem: never above sev 2, community tier, one district, no coordinates, no link", () => {
  const base = { _id: "abc", type: "road_flooded" as const, text: "Water over both lanes", locText: "Hwy 130 at Kea‘au", island: "hawaii" as const, district: "Puna", status: "live", confirmCount: 0, goneCount: 0, flagCount: 0, createdAt: 1, lastConfirmedAt: 1, expiresAt: 2 };
  for (const confirms of [0, 3, 999]) {
    const it = reportToItem({ ...base, confirmCount: confirms });
    assert.ok(it.sev <= 2); assert.equal(it.tier, "community"); assert.deepEqual(it.districts, ["Puna"]);
    assert.equal(it.lat, undefined); assert.equal(it.srcUrl, ""); assert.equal(it.type, "road_closure");
    assert.ok(it.title.length <= 120 && it.body.length <= 600);
  }
  assert.equal(reportToItem({ ...base, confirmCount: 2 }).sev, 1);
  assert.equal(reportToItem({ ...base, confirmCount: 3 }).sev, 2);
});

test("afterVote: still-there extends up to 2x default; gone winds down within 30 min", () => {
  const t = REPORT_TYPES.crash; const created = 0;
  const ext = afterVote("still", { type: "crash", createdAt: created, expiresAt: t.ttlMs }, 90 * 60_000); // 1.5 h in: 1.5 h + 1 h = 2.5 h
  assert.ok(ext > t.ttlMs && ext <= 2 * t.ttlMs);
  assert.equal(afterVote("still", { type: "crash", createdAt: created, expiresAt: 2 * t.ttlMs }, 3 * 3_600_000), 2 * t.ttlMs, "capped");
  assert.equal(afterVote("gone", { type: "crash", createdAt: created, expiresAt: t.ttlMs }, 0), 30 * 60_000);
  assert.equal(afterVote("gone", { type: "crash", createdAt: created, expiresAt: 10 * 60_000 }, 0), 10 * 60_000, "never extends");
});
