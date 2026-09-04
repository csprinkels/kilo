import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * MapLibre resolves its web worker as a file sitting beside its own module. Bundled, its module is
 * a hashed chunk with no worker beside it: the fetch 404s, no worker ever starts, and every
 * GeoJSON source waits for ever — while raster tiles still draw, so the map looks alive and the
 * evacuation zones are simply absent. ZoneMap points config.WORKER_URL at the copy in /public.
 *
 * That copy is a build artefact of the installed version. Upgrading maplibre-gl without recopying
 * it would run last version's worker against this version's protocol, so this fails loudly instead:
 *   cp node_modules/maplibre-gl/dist/maplibre-gl-{worker,shared}.mjs public/maplibre/
 *
 * Both files: the worker is a module that imports maplibre-gl-shared.mjs from beside itself, and a
 * module worker whose import 404s fails with no error anyone can see — the map still draws its
 * raster tiles, so it looks fine and only the zones are missing.
 */
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  test(`public/maplibre/${f} matches the installed maplibre-gl`, () => {
    assert.equal(
      readFileSync(`public/maplibre/${f}`, "utf8"),
      readFileSync(`node_modules/maplibre-gl/dist/${f}`, "utf8"),
      `public/maplibre/${f} is stale — recopy it from node_modules/maplibre-gl/dist/`,
    );
  });
}
