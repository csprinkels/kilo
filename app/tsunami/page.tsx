"use client";
import { useState } from "react";
import { ChevronRight, Siren } from "lucide-react";
import PageShell, { H2 } from "@/components/PageShell";
import EmptyState from "@/components/EmptyState";
import OfficialWording from "@/components/OfficialWording";
import type { Tsunami, TsunamiLevel } from "@/lib/pages";
import { useJson, useStoredIsland } from "@/lib/data";
import { useStatic } from "@/components/RoadMap";
import { zoneAt, type ZoneCollection } from "@/lib/geo";
import { distanceNm, nmToMi } from "@/lib/storm";
import { SOURCE_NAME, fmtUntil } from "@/lib/plain";
import { APP_NAME, fmtClock } from "@/lib/brand";

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
      {d && warning && (
        <section role="alert" aria-label="Tsunami warning" className="mt-s4 rounded-card border-l-4 border-danger bg-danger-bg px-s4 py-s4">
          <p className="flex items-center gap-s2 font-display text-title font-bold text-danger"><Siren className="size-6" aria-hidden /> Act now</p>
          <h2 className="mt-s2 font-display text-display font-bold leading-tight text-ink">Tsunami warning</h2>
          <p className="mt-s2 text-body font-semibold text-ink">{WARNING_ACTION}</p>
          <p className="mt-s2 text-small text-ink-2 num">{until ? `In effect ${until}. ` : ""}From {SOURCE}{d.status.issued ? `, ${fmtClock(d.status.issued, now)}` : ""}.</p>
        </section>
      )}
      {t && !d && (
        <>
          <EmptyState kind="error" title="Can't load right now.">Try again when you have signal. In an emergency call 911.</EmptyState>
          <button type="button" onClick={() => location.reload()} className="btn mt-s3">Try again</button>
        </>
      )}

      <H2 sentence={`Tap to check your spot on the state evacuation map. ${APP_NAME} does not save your location.`}>Am I in an evacuation zone?</H2>
      <button type="button" onClick={lookup} disabled={busy} className="btn btn-primary btn-big mt-s3 disabled:opacity-50">{busy ? "Checking…" : "Check where I am"}</button>
      {result && (
        <p className="mt-s3 text-body text-ink" role="status">
          {"error" in result ? result.error : (result.zone != null && ZONE_TEXT[result.zone]) || SAFE_TEXT}{!("error" in result) && result.edge ? " You are right at the edge of the zone, so treat it as inside." : ""}
        </p>
      )}
      {sirenLine && <p className="mt-s2 text-body font-semibold text-ink">{sirenLine}</p>}
      <a className="mt-s2 inline-flex min-h-11 items-center gap-1 text-body font-semibold text-brand" href={map.url} target="_blank" rel="noreferrer">{map.label} <ChevronRight className="size-5" aria-hidden /></a>

      <H2>What to do</H2>
      <ul className="mt-s2 divide-y divide-line">
        {WHAT_TO_DO.map((s) => <li key={s} className="py-s3 text-body text-ink">{s}</li>)}
      </ul>
      <p className="mt-s3 text-small text-ink-2">Evacuation orders come from Civil Defense. {APP_NAME} only shows information.</p>

      {d && (
        <OfficialWording title={d.status.event || "No tsunami message in effect"} body={[d.status.headline, d.status.issued ? `Issued ${fmtClock(d.status.issued, now)}` : ""].filter(Boolean).join("\n")}>
          <a className="mt-s2 inline-flex min-h-11 items-center gap-1 font-semibold text-brand" href={d.status.url || "https://www.tsunami.gov/"} target="_blank" rel="noreferrer">Read it at tsunami.gov <ChevronRight className="size-4" aria-hidden /></a>
        </OfficialWording>
      )}
    </PageShell>
  );
}
