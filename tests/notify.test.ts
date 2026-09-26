import { test } from "node:test";
import assert from "node:assert/strict";
import { pushText, townsOf } from "../lib/notify.ts";
import type { Item } from "../lib/types.ts";

const now = Date.UTC(2026, 8, 25, 15, 0);
const item = (o: Partial<Item> & { key: string; type: Item["type"] }): Item => ({
  source: "nws", tier: "official", sev: 3, islands: ["hawaii"], districts: [], title: "", body: "", srcUrl: "",
  issuedAt: now - 3_600_000, lastConfirmedAt: now, hash: "", ...o,
});
const watch = (zone: string, towns: string) => item({
  key: `w-${zone}`, type: "advisory", title: `Hurricane Watch: ${zone}`,
  fields: { event: "Hurricane Watch", areaDesc: zone },
  body: `Hurricane Watch issued September 25 at 4:59AM HST by NWS Honolulu HI * LOCATIONS AFFECTED - ${towns} * WIND - LATEST LOCAL FORECAST: Equivalent Tropical Storm force wind`,
});

test("the agency's LOCATIONS AFFECTED list becomes the towns", () => {
  assert.deepEqual(townsOf(watch("Big Island North", "Kamuela - Hawi - Honokaa")), ["Kamuela", "Hawi", "Honokaa"]);
});

test("a hurricane watch reads as an emoji, what is happening, the towns and what to do — never a forecast zone", () => {
  const w = watch("Big Island North", "Kamuela - Hawi - Honokaa");
  const t = pushText(w, [w], "hawaii", now);
  assert.equal(t.title, "🌀 Hurricane possible");
  assert.match(t.body, /^Kamuela, Hawi and Honokaa\. Get ready now\./);
  assert.doesNotMatch(t.title + t.body, /North|LOCATIONS|\*/);
});

test("the zones of one watch fold into one notification with every town", () => {
  const a = watch("Big Island North", "Kamuela - Hawi"), b = watch("Kona", "Kailua-Kona - Captain Cook");
  const t = pushText(a, [a, b], "hawaii", now);
  assert.match(t.body, /^Kamuela, Hawi, Kailua-Kona and Captain Cook\./);
  assert.equal(pushText(b, [a, b], "hawaii", now).kind, t.kind, "same kind, so the second replaces the first");
});

test("a shelter says where, in the town people know", () => {
  const s = item({ key: "s", type: "shelter", title: "Shelter OPEN: Puueo Community Center", status: "open", fields: { city: "Hilo", address: "145 Wainaku Street" } });
  const t = pushText(s, [s], "hawaii", now);
  assert.equal(t.title, "🏠 Shelter open in Hilo");
  assert.match(t.body, /^Puueo Community Center, 145 Wainaku Street\. Bring medicine/);
  assert.doesNotMatch(t.body, /\d+\/\d+\/\d+/, "the county's raw opening date is not repeated");
});
