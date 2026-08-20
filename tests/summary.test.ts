import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { summarize, feelsLike, sunTimes, clock } from "../lib/summary.ts";
import { parseHourly } from "../convex/parsers/pages.ts";
import type { Hourly } from "../lib/pages.ts";

const t0 = Date.UTC(2026, 7, 20, 18, 0); // 8 AM HST Thu Aug 20
const mk = (over: Partial<Hourly>, n = 24): Hourly => ({
  t0, t: Array(n).fill(80), p: Array(n).fill(10), w: Array(n).fill(8), wd: Array(n).fill(2), c: Array(n).fill(2), n: Array(n).fill(0).map((_, i) => (i >= 11 && i < 22 ? 1 : 0)), rh: Array(n).fill(70), ...over,
});

test("summary: rain now, rain later, all day, breezy, fog, clear, night", () => {
  const nowRain = mk({ c: [5, 5, 5, 5, 2, 2, ...Array(18).fill(2)], p: [70, 70, 60, 60, 10, ...Array(19).fill(10)] });
  assert.equal(summarize(nowRain), "Showers likely until 12 PM, then clearing.");
  const later = mk({ c: [2, 2, 2, 2, 2, 2, 5, 5, 5, ...Array(15).fill(2)], p: [10, 10, 10, 10, 10, 10, 45, 50, 45, ...Array(15).fill(10)] });
  assert.equal(summarize(later), "Chance of showers this afternoon.");
  const soon = mk({ c: [2, 6, 6, 6, ...Array(20).fill(2)], p: [10, 85, 85, 80, ...Array(20).fill(10)] });
  assert.equal(summarize(soon), "Rain starting soon.");
  const allDay = mk({ c: Array(24).fill(5), p: Array(24).fill(65) });
  assert.equal(summarize(allDay), "Showers likely throughout the day.");
  const storm = mk({ c: [2, 2, 2, 7, 7, ...Array(19).fill(2)], p: [10, 10, 10, 70, 80, ...Array(19).fill(10)] });
  assert.equal(summarize(storm), "Thunderstorms starting around 11 AM.");
  const breezy = mk({ w: Array(24).fill(24) });
  assert.equal(summarize(breezy), "Breezy this morning, winds to 24 mph.");
  const fog = mk({ c: [8, 8, 8, 2, ...Array(20).fill(2)] });
  assert.equal(summarize(fog), "Fog this morning, clearing by 11 AM.");
  const clear = mk({ c: Array(24).fill(1), t: [74, 76, 79, 82, 84, 85, 85, 84, 82, 80, 78, 76, ...Array(12).fill(73)] });
  assert.equal(summarize(clear), "Mostly clear today, high 85°.");
  const night = mk({ n: Array(24).fill(1), c: Array(24).fill(0), t: Array(24).fill(71) });
  assert.equal(summarize(night), "Clear tonight, low 71°.");
  // Low-probability wet codes are ignored (NWS "isolated showers" at 20%)
  const iso = mk({ c: Array(24).fill(5), p: Array(24).fill(20) });
  assert.equal(summarize(iso), "Showers today, high 80°.");
});

test("summary on the real Hilo fixture is a single short sentence", () => {
  const h = parseHourly(JSON.parse(readFileSync(new URL("../fixtures/nws-hourly-hilo.json", import.meta.url), "utf8")), 36, Date.parse("2026-08-20T17:30:00Z"))!;
  const s = summarize(h);
  assert.ok(s.length > 10 && s.length <= 70 && /\.$/.test(s) && !/!/.test(s), s);
});

test("feels-like and sun times", () => {
  assert.equal(feelsLike(75, 80), 75, "below 80F: air temp");
  assert.ok(feelsLike(88, 75) >= 101 && feelsLike(88, 75) <= 105, `heat index ${feelsLike(88, 75)} (NOAA table: 103)`);
  const midnightHST = Date.UTC(2026, 7, 20, 10, 0);
  const { rise, set } = sunTimes(midnightHST, 19.7297, -155.09);
  assert.equal(clock(rise), "6 AM"); assert.equal(clock(set), "6 PM"); // Hilo, Aug 20: ~6:03 AM / 6:46 PM HST
  assert.ok(set - rise > 12 * 3_600_000 && set - rise < 13 * 3_600_000);
});
