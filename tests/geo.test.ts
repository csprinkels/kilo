import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { zoneAt, type ZoneCollection } from "../lib/geo.ts";

const zones = JSON.parse(readFileSync(new URL("../public/zones/hawaii.json", import.meta.url), "utf8")) as ZoneCollection;

// Expected codes were checked against the live state layer (Hazards/MapServer/11) on 2026-08-20.
test("offline tsunami zones agree with the state layer: downtown Hilo evacuates, Volcano does not, open water is unmapped", () => {
  assert.equal(zoneAt(19.7216, -155.0844, zones).code, 1, "downtown Hilo");
  assert.equal(zoneAt(19.43, -155.23, zones).code, null, "Volcano village");
  assert.equal(zoneAt(19.7284, -155.0855, zones).code, null, "a point in Hilo Bay");
  assert.ok(zoneAt(19.7284, -155.0855, zones).edgeM < 400, "…but within a few hundred metres of the zone edge");
  assert.ok(zoneAt(19.43, -155.23, zones).edgeM > 10_000);
});
