"use client";
import { useState } from "react";
import Icon from "@/components/Icon";
import PageShell from "@/components/PageShell";
import EmptyState from "@/components/EmptyState";
import OfficialWording from "@/components/OfficialWording";
import type { Tsunami, TsunamiLevel } from "@/lib/pages";
import { useJson, useStoredIsland } from "@/lib/data";
import { useStatic } from "@/components/RoadMap";
import ZoneMap from "@/components/ZoneMap";
import { zoneAt, type ZoneCollection } from "@/lib/geo";
import { distanceNm, nmToMi } from "@/lib/storm";
import { SOURCE_NAME, fmtUntil } from "@/lib/plain";
import { APP_NAME, fmtClock, islandName } from "@/lib/brand";

// The title is the level in plain words; an information statement is shown exactly like "none".
const TITLE: Record<TsunamiLevel, string> = {
  none: "No tsunami danger", info: "No tsunami danger", watch: "Tsunami possible — get ready",
  advisory: "Stay out of the water", warning: "Tsunami warning — leave the coast now",
};
const WARNING_ACTION = "Leave the evacuation zone now. Go inland or to the 4th floor or higher.";
const WHAT_TO_DO = [
  "Strong shaking near the shore, or the ocean pulling back: go uphill on foot right away.",
  "Sirens on a day that is not the monthly test: check your phone or radio. A warning means leave the coast.",
  "Stay away until Civil Defense says it is over. The first wave is often not the biggest.",
];
const MAP: Record<string, { label: string; url: string }> = {
  hawaii: { label: "County evacuation map", url: "https://www.hawaiicounty.gov/departments/civil-defense/tsunami-evacuation-zones" },
  other: { label: "State evacuation map", url: "https://dod.hawaii.gov/hiema/tsunami/" },
};
const ZONE_URL = "https://geodata.hawaii.gov/arcgis/rest/services/Hazards/MapServer/11/query";
type IslandId = "hawaii" | "maui" | "oahu" | "kauai";
/** [south, north, west, east] — which island a position is on (Maui County incl. Molokaʻi and Lānaʻi; Kauaʻi incl. Niʻihau). */
const ISLAND_BOX: Record<IslandId, number[]> = { hawaii: [18.85, 20.33, -156.15, -154.73], maui: [20.45, 21.3, -157.4, -155.9], oahu: [21.2, 21.77, -158.35, -157.58], kauai: [21.8, 22.3, -160.3, -159.22] };
// State GIS zone_code: 1 = evacuation zone, 2 = extreme zone, 3 = safe zone; no feature = not mapped (treated as safe).
const ZONE_TEXT: Record<number, string> = {
  1: "Your spot is in the evacuation zone. If a warning comes, leave.",
  2: "Your spot is in the extreme zone. Leave only if Civil Defense says to.",
};
const SAFE_TEXT = "Your spot is not in an evacuation zone. If the ground shakes hard near the coast, go uphill anyway.";
const SOURCE = SOURCE_NAME.ptwc;

function sentenceFor(level: TsunamiLevel, expires: number | undefined, now: number) {
  const until = fmtUntil(expires, now);
  if (level === "info") return "An earthquake happened far away. No tsunami danger for Hawaiʻi.";
  if (level === "watch") return `${until ? `We will know more ${until.replace(/^until /, "by ")}. ` : ""}Get ready to leave the coast. Keep your phone on.`;
  if (level === "advisory") return `Dangerous waves and currents at the shore${until ? ` ${until}` : ""}. Stay out of the water and off the beach.`;
  return "Nothing in effect for Hawaiʻi.";
}

type Result = { zone: number | null; edge?: boolean; offline?: boolean } | { error: string };

export default function TsunamiPage() {
  const t = useJson<Tsunami>("v1/tsunami.json");
  const d = t?.data ?? undefined;
  const now = t?.fetchedAt ?? 0;
  const [island] = useStoredIsland();
  const map = MAP[island] ?? MAP.other;
  const [result, setResult] = useState<Result | null>(null);
  const [pos, setPos] = useState<{ lat: number; lon: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const level = d?.status.level ?? "none";
  const warning = level === "warning";
  const until = fmtUntil(d?.status.expires, now);

  // The island's evacuation polygons (38–127 KB), fetched once while there is signal; the service worker keeps them, so the
  // check works with no signal later. Zones of the other islands load only if the reader turns out to be there.
  const zoneIsland = island === "state" ? "hawaii" : island;
  const zones = useStatic<ZoneCollection>(`/zones/${zoneIsland}.json`);

  const lookup = () => {
    if (!("geolocation" in navigator)) { setResult({ error: "This phone can't share its location. Check the map below instead." }); return; }
    setBusy(true); setResult(null);
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      const p = { lat: coords.latitude, lon: coords.longitude }; setPos(p);
      try {
        // 1. offline pack for the island they are on (by position, not by setting)
        const here = (Object.entries(ISLAND_BOX) as [IslandId, number[]][]).find(([, b]) => p.lat > b[0] && p.lat < b[1] && p.lon > b[2] && p.lon < b[3])?.[0];
        const pack = here === zoneIsland ? zones : here ? await fetch(`/zones/${here}.json`).then((r) => (r.ok ? (r.json() as Promise<ZoneCollection>) : null)).catch(() => null) : null;
        if (pack) {
          const z = zoneAt(p.lat, p.lon, pack);
          setResult({ zone: z.code, edge: z.edgeM < 150, offline: !navigator.onLine });
          return;
        }
        // 2. the live state layer
        const q = new URLSearchParams({ geometry: `${p.lon},${p.lat}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: "zone_code", returnGeometry: "false", f: "json" });
        const res = await fetch(`${ZONE_URL}?${q}`, { signal: AbortSignal.timeout(20_000) });
        const js = (await res.json()) as { features?: { attributes: { zone_code: number } }[] };
        const code = js.features?.[0]?.attributes.zone_code ?? null;
        setResult({ zone: code === 3 ? null : code });
      } catch { setResult({ error: "Could not reach the map right now. If you feel strong shaking near the coast, go uphill anyway." }); }
      finally { setBusy(false); }
    }, () => { setBusy(false); setResult({ error: "Your phone would not share its location. Check the map below instead." }); }, { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 });
  };

  // Broken sirens within 5 miles of the spot they just checked: say so, so nobody waits for one.
  const nearBad = pos && d ? d.sirens.bad.map((s) => ({ ...s, mi: nmToMi(distanceNm(pos.lat, pos.lon, s.ll[0], s.ll[1])) })).filter((s) => s.mi <= 5).sort((a, b) => a.mi - b.mi) : [];
  const sirenLine = nearBad.length === 0 ? null
    : nearBad.length === 1 ? `The siren at ${nearBad[0].loc} is not working. Do not wait for it.`
    : `The sirens at ${new Intl.ListFormat("en", { type: "conjunction" }).format(nearBad.map((s) => s.loc))} are not working. Do not wait for them.`;

  return (
    <PageShell
      title={d ? TITLE[level] : "Tsunami"}
      sentence={d && !warning ? sentenceFor(level, d.status.expires, now) : undefined}
      fetchedAt={d ? t?.fetchedAt : undefined} gen={d?.upd} offline={t?.offline} source={SOURCE}
    >
      <div className="mt-s6 flex flex-col gap-s3">
        {d && warning && (
          <section role="alert" aria-label="Tsunami warning" className="ts-alert">
            <div className="ts-alert-hd">
              <span className="cs-ictile cs-ictile--onbrick"><Icon name="siren-fill" size={21} /></span>
              <p className="ts-alert-kicker">Act now</p>
            </div>
            <h2 className="ts-shout">Tsunami warning</h2>
            <p className="ts-act">{WARNING_ACTION}</p>
            <div className="ts-alert-rule" />
            <p className="ts-alert-meta num">{until ? `In effect ${until}. ` : ""}From {SOURCE}{d.status.issued ? `, ${fmtClock(d.status.issued, now)}` : ""}.</p>
          </section>
        )}

        {t && !d && (
          <section className="cs-card ts-flush">
            <EmptyState kind="error" title="Can't load right now.">Try again when you have signal. In an emergency call 911.</EmptyState>
            <button type="button" onClick={() => window.dispatchEvent(new Event("online"))} className="cs-cta mt-s3">Try again</button>
          </section>
        )}

        <section className="cs-card t-tsunami">
          <div className="cs-heroline">
            <span className="cs-ictile"><Icon name="map-pin" size={21} /></span>
            <h2 className="cs-display cs-display--card">Am I in an evacuation zone?</h2>
          </div>
          <p className="cs-body">Tap to check your spot on the state evacuation map. {APP_NAME} does not save your location.</p>
          <button type="button" onClick={lookup} disabled={busy} className="cs-cta cs-wide cs-wide--big mt-s4">{busy ? "Checking…" : "Check where I am"}</button>
          {result && (
            <div role="status" className={`ts-answer${"error" in result || result.zone != null ? "" : " ts-answer--safe"}`}>
              <p className="ts-verdict">{"error" in result ? result.error : (result.zone != null && ZONE_TEXT[result.zone]) || SAFE_TEXT}</p>
              {!("error" in result) && result.edge && <p className="ts-caveat">You are right at the edge of the zone, so treat it as inside.</p>}
            </div>
          )}
          {sirenLine && (
            <p className="ts-siren"><Icon name="warning" size={17} /><span>{sirenLine}</span></p>
          )}

          {/* The written answer above is exact and needs no signal. This is the part it cannot do:
              show where the line falls two doors over. Zones and coastline are already on the phone,
              so it draws offline; only the streets need a network. */}
          {zones && (
            <>
              <div className="cs-rule" />
              {showMap ? (
                <ZoneMap island={zoneIsland} zones={zones} you={pos} label={`Evacuation zones on ${islandName(zoneIsland)}`} />
              ) : (
                <button type="button" className="cs-row ts-mapbtn" onClick={() => setShowMap(true)}>
                  <span className="cs-ictile"><Icon name="map-pin" size={21} className="cs-ic" /></span>
                  <span className="cs-rowmain">
                    <span className="cs-rowname">See the zones on a map</span>
                    <span className="cs-rowsub">Push in to find your street. Works with no signal.</span>
                  </span>
                  <Icon name="caret-right" size={16} className="cs-ic" />
                </button>
              )}
            </>
          )}

          <div className="cs-rule" />
          <a className="cs-link ts-link" href={map.url} target="_blank" rel="noreferrer">{map.label} <Icon name="caret-right" size={16} /></a>
        </section>

        <section className="cs-card t-tsunami">
          <div className="cs-heroline">
            <span className="cs-ictile"><Icon name="lightbulb-filament-fill" size={21} /></span>
            <h2 className="cs-display cs-display--card">What to do</h2>
          </div>
          <ol className="ts-steps">
            {WHAT_TO_DO.map((s, i) => (
              <li key={s} className="cs-row">
                <span className="cs-num" aria-hidden="true">{i + 1}</span>
                <p>{s}</p>
              </li>
            ))}
          </ol>
          <div className="cs-rule" />
          <p className="cs-meta">Evacuation orders come from Civil Defense. {APP_NAME} only shows information.</p>
        </section>

        {d && (
          <section className="cs-card ts-flush ts-official">
            <OfficialWording title={d.status.event || "No tsunami message in effect"} body={[d.status.headline, d.status.issued ? `Issued ${fmtClock(d.status.issued, now)}` : ""].filter(Boolean).join("\n")}>
              <a className="cs-link ts-link mt-s2" href={d.status.url || "https://www.tsunami.gov/"} target="_blank" rel="noreferrer">Read it at tsunami.gov <Icon name="caret-right" size={16} /></a>
            </OfficialWording>
          </section>
        )}
      </div>
    </PageShell>
  );
}
