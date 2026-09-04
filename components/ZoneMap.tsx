"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ZoneCollection } from "@/lib/geo";
import type { Island } from "@/lib/types";
import { TILES, TILE_ATTRIBUTION } from "@/lib/tiles";
import "maplibre-gl/dist/maplibre-gl.css";

type IslandId = Exclude<Island, "state">;

/**
 * The evacuation zones, on a map you can push into until you find your own street.
 *
 * Why this one earns a map renderer when the rest of Kilo does not: the question is "is MY house
 * inside the line", and the zone edge runs down real streets. The page's written answer is exact
 * and works with no signal, but it cannot show you where the line falls two doors over.
 *
 * Offline is not a degraded mode here, it is the floor. Both the zones and the coastline are files
 * the phone already has, so with no signal you still get the island, the zones, and your position.
 * Streets are the only thing that needs a network, and they are added on top when there is one.
 */
const onlineStore = {
  subscribe: (cb: () => void) => { addEventListener("online", cb); addEventListener("offline", cb); return () => { removeEventListener("online", cb); removeEventListener("offline", cb); }; },
  get: () => navigator.onLine,
};

/** WebGL is 15 years old, but a refused context is a blank rectangle where a map should be. */
function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch { return false; }
}

const FRAME: Record<IslandId, [number, number, number, number]> = {
  hawaii: [18.85, 20.33, -156.15, -154.73], maui: [20.45, 21.3, -157.4, -155.9],
  oahu: [21.2, 21.77, -158.35, -157.58], kauai: [21.8, 22.3, -159.88, -159.22],
};

export default function ZoneMap({ island, zones, you, label }: {
  island: IslandId;
  zones: ZoneCollection;
  /** Where the reader checked, if they shared it. Never stored, never sent. */
  you?: { lat: number; lon: number } | null;
  label: string;
}) {
  const online = useSyncExternalStore(onlineStore.subscribe, onlineStore.get, () => true);
  const ref = useRef<HTMLDivElement>(null);
  const [webgl] = useState(() => (typeof document === "undefined" ? true : hasWebGL()));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !webgl) return;
    let cancelled = false;
    let map: import("maplibre-gl").Map | undefined;

    void (async () => {
      try {
        const [{ Map: MLMap, Marker, NavigationControl, config }, coast] = await Promise.all([
          import("maplibre-gl"),
          fetch("/hawaii-coast.json").then((r) => r.json()).catch(() => null),
        ]);
        if (cancelled || !el) return;
        // MapLibre loads its worker as a sibling of its own module URL — bundled, that is a hashed
        // chunk with no worker beside it, so the fetch 404s, no worker starts, and every GeoJSON
        // source hangs for ever while raster tiles still draw. Point it at the copy in /public.
        // The worker imports a sibling (maplibre-gl-shared.mjs), so both files ship together;
        // tests/maplibre.test.ts pins them to the installed version.
        config.WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";
        const streets = online && !!TILES;
        const css = getComputedStyle(document.documentElement);
        const tok = (n: string) => css.getPropertyValue(n).trim();

        // The style is built here rather than fetched, so the map has everything it needs to draw
        // before any network call. A remote style.json would make an offline map impossible.
        const style: import("maplibre-gl").StyleSpecification = {
          version: 8,
          // No glyphs: nothing here draws a label of its own, and a font URL would be one more
          // thing the map reaches for. The street names are painted into the raster tiles.
          sources: {
            ...(!streets && coast ? { coast: { type: "geojson", data: { type: "Feature", properties: {}, geometry: coast } } } : {}),
            zones: { type: "geojson", data: zones as unknown as GeoJSON.FeatureCollection },
            ...(streets
              ? { streets: { type: "raster", tiles: [TILES!.replace("{s}", "a")], tileSize: 256, maxzoom: 18, attribution: TILE_ATTRIBUTION } }
              : {}),
          },
          layers: [
            { id: "ground", type: "background", paint: { "background-color": tok("--map-water") } },
            // The drawn island is the FLOOR, not an overlay: it is the whole map with no signal, and
            // it steps aside the moment there are streets. Kilo's coastline is a simplified outline
            // built for a 100pt picture — drawn over real tiles it misses the shore by a mile,
            // literally, and an amber line out at sea reads as a zone that covers the ocean.
            ...(!streets && coast ? [
              { id: "land", type: "fill" as const, source: "coast", paint: { "fill-color": tok("--map-land") } },
              { id: "coastline", type: "line" as const, source: "coast", paint: { "line-color": tok("--map-coast"), "line-width": 1.2 } },
            ] : []),
            ...(streets ? [{ id: "streets", type: "raster" as const, source: "streets", paint: { "raster-opacity": 1 } }] : []),
            // c=1 is the evacuation zone, c=2 the extreme one. Brick is the app's word for "leave".
            {
              id: "zone-fill", type: "fill", source: "zones",
              paint: {
                "fill-color": ["case", ["==", ["get", "c"], 1], tok("--danger"), tok("--amber")],
                "fill-opacity": ["case", ["==", ["get", "c"], 1], 0.26, 0.15],
              },
            },
            {
              id: "zone-line", type: "line", source: "zones",
              paint: {
                "line-color": ["case", ["==", ["get", "c"], 1], tok("--danger"), tok("--warn")],
                // The edge does the work: it is the line your house is inside or outside of, and it
                // stays readable at island zoom where the strip itself is barely a hair wide.
                "line-width": ["interpolate", ["linear"], ["zoom"], 8, 1.6, 12, 2, 16, 3],
              },
            },
          ],
        };

        const [s, n, w, e] = FRAME[island];
        map = new MLMap({
          container: el, style, attributionControl: { compact: true },
          // Centre on the reader when there is one. This has to be set at construction: the style
          // has no remote assets to wait for, so "load" can fire before a listener could attach.
          ...(you ? { center: [you.lon, you.lat] as [number, number], zoom: 14 } : { bounds: [[w, s], [e, n]] as [[number, number], [number, number]], fitBoundsOptions: { padding: 16 } }),
          maxZoom: 17, dragRotate: false, pitchWithRotate: false, touchZoomRotate: true,
        });
        map.touchZoomRotate?.disableRotation();
        map.addControl(new NavigationControl({ showCompass: false }), "top-right");

        if (you) {
          const dot = document.createElement("div");
          dot.className = "zm-you";
          new Marker({ element: dot }).setLngLat([you.lon, you.lat]).addTo(map);
        }
        map.on("error", () => { /* a missing tile must never blank the zones */ });
      } catch { if (!cancelled) setFailed(true); }
    })();

    return () => { cancelled = true; map?.remove(); };
  }, [island, zones, you, online, webgl]);

  // No WebGL, or the renderer would not start: the page's written answer is still exact, so say
  // what is missing rather than showing an empty box.
  if (!webgl || failed) {
    return (
      <p className="cs-meta zm-none">
        The zone map needs a newer phone. The answer above is still exact, and the county map is linked below.
      </p>
    );
  }
  return (
    <div className="cs-figure zm-frame">
      <div ref={ref} className="zm-map" role="img" aria-label={label} />
      {!online && <p className="zm-offline">No signal, so there are no streets. The zones and your spot are right.</p>}
    </div>
  );
}
