import { test } from "node:test";
import assert from "node:assert/strict";
import { stormTimeline, windField, type Storm } from "../lib/storm.ts";

const H = 3_600_000, t0 = Date.UTC(2026, 8, 25, 9);
const storm = {
  id: "cp1", name: "Nolo", cls: "HU", advNum: 3, issuedAt: t0, lat: 15, lon: -150, windKt: 70, gustKt: 85, radii: { 34: [100, 80, 60, 90] },
  warnings: [], links: {},
  track: [
    { at: t0 - 12 * H, lat: 14, lon: -148, windKt: 40, adv: 1, cls: "TS" },
    { at: t0 - 6 * H, lat: 14.5, lon: -149, windKt: 55, adv: 2, cls: "TS" },
    { at: t0, lat: 15, lon: -150, windKt: 70, adv: 3, cls: "HU" },
  ],
  forecast: [
    { hour: 12, at: t0 + 12 * H, lat: 16, lon: -152, windKt: 80, gustKt: 95, radii: { 34: [120, 100, 80, 110] } },
    { hour: 96, at: t0 + 96 * H, lat: 20, lon: -158, windKt: 60, gustKt: 75, radii: { 34: [90, 70, 50, 80] }, outlook: true },
  ],
} as unknown as Storm;

test("the timeline walks hour by hour from the first advisory, through now, to the last forecast point", () => {
  const tl = stormTimeline(storm);
  assert.equal(tl[0].at, t0 - 12 * H);
  assert.equal(tl.at(-1)!.at, t0 + 96 * H);
  assert.equal(tl.length, 12 + 96 + 1, "one point per hour, no gaps or repeats");
  assert.ok(tl.every((p, i) => i === 0 || p.at - tl[i - 1].at === H));
  const now = tl.filter((p) => p.kind === "now");
  assert.equal(now.length, 1);
  assert.equal(now[0].at, t0);
  assert.ok(tl.filter((p) => p.kind === "past").every((p) => !p.r34), "the past track has no wind radii, so none are invented");
  assert.equal(tl.find((p) => p.at === t0 + 50 * H)?.outlook, true, "the stretch toward a day-4 point is marked less certain");
});

test("the wind field is a closed outline around the center, wider where the radii are", () => {
  const f = windField({ lat: 15, lon: -150 }, [100, 80, 60, 90]);
  assert.equal(f.length, 36);
  const ne = f[4], sw = f[22];
  assert.ok(Math.hypot(ne[0] + 150, ne[1] - 15) > Math.hypot(sw[0] + 150, sw[1] - 15));
});

test("the past is two days, not the storm's whole life far off the map", () => {
  const old = { ...storm, track: [{ at: t0 - 240 * H, lat: 12, lon: -120, windKt: 25, adv: 0, cls: "TD" }, ...storm.track] } as unknown as Storm;
  const tl = stormTimeline(old);
  assert.equal(tl[0].at, t0 - 48 * H, "starts 48 hours back, interpolated from the advisory before it");
  assert.equal(tl.filter((p) => p.kind === "past").length, 48);
});
