"use client";
import { useState } from "react";
import { CircleCheck, ExternalLink, LocateFixed, Siren, Waves } from "lucide-react";
import PageShell, { H2 } from "@/components/PageShell";
import Hero from "@/components/Hero";
import type { Tsunami, TsunamiLevel } from "@/lib/pages";
import { useJson } from "@/lib/data";
import { distanceNm, nmToMi } from "@/lib/storm";
import { fmtDateTime } from "@/lib/brand";

const LEVEL: Record<TsunamiLevel, { label: string; cls: string; action: string }> = {
  none: { label: "No tsunami threat", cls: "bg-surface border-line", action: "" },
  info: { label: "Tsunami information statement", cls: "bg-surface border-line", action: "An earthquake happened. No action suggested at this time." },
  watch: { label: "TSUNAMI WATCH", cls: "bg-sev2-bg border-sev2", action: "A tsunami may later affect Hawaiʻi. Stay tuned and be ready to act." },
  advisory: { label: "TSUNAMI ADVISORY", cls: "bg-sev3-bg border-sev3", action: "Strong currents and dangerous waves. Stay out of the water and off beaches and harbours." },
  warning: { label: "TSUNAMI WARNING", cls: "bg-sev4-bg border-sev4", action: "Move out of the evacuation zone to high ground or inland now. Don't wait for a siren." },
};
const ZONE_URL = "https://geodata.hawaii.gov/arcgis/rest/services/Hazards/MapServer/11/query";
type Zone = { code: number; type: string; desc: string } | "none";

export default function TsunamiPage() {
  const t = useJson<Tsunami>("v1/tsunami.json");
  const d = t?.data;
  const [zone, setZone] = useState<Zone | null>(null);
  const [zoneMsg, setZoneMsg] = useState<string | null>(null);
  const [pos, setPos] = useState<{ lat: number; lon: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const lvl = LEVEL[d?.status.level ?? "none"];

  const lookup = () => {
    if (!("geolocation" in navigator)) { setZoneMsg("This browser can't share your location."); return; }
    setBusy(true); setZoneMsg(null);
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      const p = { lat: coords.latitude, lon: coords.longitude }; setPos(p);
      try {
        const q = new URLSearchParams({ geometry: `${p.lon},${p.lat}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: "zone_type,zone_desc,zone_code", returnGeometry: "false", f: "json" });
        const res = await fetch(`${ZONE_URL}?${q}`, { signal: AbortSignal.timeout(20_000) });
        const js = (await res.json()) as { features?: { attributes: { zone_type: string; zone_desc: string; zone_code: number } }[] };
        const a = js.features?.[0]?.attributes;
        setZone(a ? { code: a.zone_code, type: a.zone_type, desc: a.zone_desc } : "none");
      } catch { setZoneMsg("Couldn't reach the state map server. If you feel strong shaking near the coast, move inland anyway."); }
      finally { setBusy(false); }
    }, () => { setBusy(false); setZoneMsg("Location permission was denied. You can check your zone on the county's map instead."); }, { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 });
  };

  const nearBad = pos && d ? d.sirens.bad.map((s) => ({ ...s, mi: nmToMi(distanceNm(pos.lat, pos.lon, s.ll[0], s.ll[1])) })).filter((s) => s.mi <= 5).sort((a, b) => a.mi - b.mi) : [];

  return (
    <PageShell title="Tsunami" blurb={d ? (d.status.level === "none" ? "No tsunami threat to Hawaiʻi right now." : lvl.label) : undefined} fetchedAt={t?.fetchedAt} gen={d?.upd} offline={t?.offline} source="PTWC">
      <Hero
        tone={d?.status.level === "warning" ? "var(--sev4)" : d?.status.level === "advisory" ? "var(--sev3)" : d?.status.level === "watch" ? "var(--sev2)" : "var(--cond-windy)"}
        eyebrow={d?.status.issued ? `PTWC · ${fmtDateTime(d.status.issued)} HST` : "Pacific Tsunami Warning Center"}
        icon={d?.status.level === "none" || !d ? <CircleCheck className="size-11 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} /> : <Waves className="size-11 text-ink" strokeWidth={1.75} />}
        value={<span className="text-display">{lvl.label}</span>}
        label={d?.status.level !== "none" && d?.status.headline ? d.status.headline : undefined}
        sentence={lvl.action || (d ? `Nothing in effect for Hawaiʻi. Last bulletin was ${d.status.headline?.toLowerCase() ?? "an information statement"}.` : undefined)}
        meta={<>{d?.status.expires && d.status.level !== "none" && <span>Until {fmtDateTime(d.status.expires)}</span>}<a className="text-brand underline underline-offset-4" href="https://www.tsunami.gov/" target="_blank" rel="noreferrer">tsunami.gov</a></>}
      />

      <H2>Am I in an evacuation zone?</H2>
      <div className="mt-3 card">
        {zone === null ? (
          <>
            <p className="text-body text-ink-2">Checks your current location against the state&apos;s tsunami evacuation map. Needs a connection; your location is not stored.</p>
            <button onClick={lookup} disabled={busy} className="btn btn-primary mt-s3 disabled:opacity-50"><LocateFixed className="size-4" /> {busy ? "Checking…" : "Check my location"}</button>
          </>
        ) : zone === "none" ? (
          <p className="text-body"><strong className="text-emerald-700 dark:text-emerald-400">Not in a mapped evacuation zone.</strong> <span className="text-ink-2">If you feel strong or long shaking near the coast, move inland anyway — maps assume a distant tsunami.</span></p>
        ) : (
          <p className="text-body">
            <strong className={zone.code === 1 ? "text-sev4" : zone.code === 2 ? "text-sev3" : "text-emerald-700 dark:text-emerald-400"}>{zone.type}.</strong>{" "}
            <span className="text-ink-2">{zone.desc}{zone.code === 2 ? " (Extreme zone: evacuate only when officials say to.)" : ""}</span>
          </p>
        )}
        {zoneMsg && <p className="mt-2 text-micro text-sev4">{zoneMsg}</p>}
        <p className="mt-3 text-micro text-muted">Zones: counties &amp; Hawaiʻi Statewide GIS. In a reinforced building of 10+ storeys, the 4th floor and up is considered safe. Official maps: <a className="underline underline-offset-4" href="https://www.hawaiicounty.gov/departments/civil-defense/tsunami-evacuation-zones" target="_blank" rel="noreferrer">Hawaiʻi County</a>, <a className="underline underline-offset-4" href="https://dod.hawaii.gov/hiema/tsunami/" target="_blank" rel="noreferrer">HI-EMA</a>.</p>
      </div>

      <H2>What to do</H2>
      <ul className="mt-3 space-y-3 text-body leading-relaxed">
        <li className="flex gap-3"><span className="mt-1 inline-block size-2.5 shrink-0 rounded-full bg-sev4" /><span><strong>Strong shaking near the shore, the ocean pulling back or roaring:</strong> that is the warning. A local tsunami can arrive in minutes. Go inland or uphill on foot now.</span></li>
        <li className="flex gap-3"><span className="mt-1 inline-block size-2.5 shrink-0 rounded-full bg-sev3" /><span><strong>Sirens (outside the first-business-day test):</strong> check phone, radio or TV for instructions. A Warning means leave the evacuation zone; an Advisory means stay out of the water.</span></li>
        <li className="flex gap-3"><span className="mt-1 inline-block size-2.5 shrink-0 rounded-full bg-sev2" /><span><strong>Distant tsunami (Alaska, Chile, Japan):</strong> you&apos;ll have hours. Watches and warnings appear here and on the Now page; evacuation orders come from the county.</span></li>
        <li className="flex gap-3"><span className="mt-1 inline-block size-2.5 shrink-0 rounded-full bg-sev1" /><span><strong>Stay out until officials say it&apos;s over.</strong> The first wave is often not the largest, and waves can keep coming for hours.</span></li>
      </ul>

      {d && (
        <>
          <H2 right={`${d.sirens.total} sirens statewide · HI-EMA`}>Sirens</H2>
          <p className="mt-3 flex items-start gap-2 text-label text-ink-2"><Siren className="mt-0.5 size-4 shrink-0 text-muted" /> Tested at 11:45 AM on the first business day of each month. {d.sirens.bad.length} sirens are currently listed as needing maintenance statewide{pos ? nearBad.length ? `, ${nearBad.length} within 5 miles of you:` : " — none within 5 miles of you." : "."}</p>
          {nearBad.length > 0 && <ul className="mt-2 space-y-1 text-micro text-ink-2">{nearBad.map((s) => <li key={s.id}>{s.loc} — {s.st} · {s.mi} mi</li>)}</ul>}
          {!pos && <p className="mt-1 text-micro text-muted">Use &ldquo;Check my location&rdquo; above to see sirens near you.</p>}
          <a className="mt-2 inline-flex items-center gap-1 text-micro font-medium text-brand" href="https://dod.hawaii.gov/hiema/all-hazard-statewide-outdoor-warning-siren-system/" target="_blank" rel="noreferrer"><ExternalLink className="size-3" /> Siren map &amp; status</a>
        </>
      )}
      <p className="mt-8 text-micro leading-relaxed text-muted">Bulletins: NWS Pacific Tsunami Warning Center. Evacuation decisions come from your county Civil Defense / Emergency Management; this page is information, not an order.</p>
    </PageShell>
  );
}
