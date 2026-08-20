"use client";
import { useState } from "react";
import { CircleCheck, ExternalLink, LocateFixed, Siren, Waves } from "lucide-react";
import PageShell, { H2 } from "@/components/PageShell";
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
    <PageShell title="Tsunami" blurb="Pacific Tsunami Warning Center, Hawaiʻi Statewide GIS, HI-EMA sirens" fetchedAt={t?.fetchedAt} offline={t?.offline}>
      <section className={`mt-5 rounded-2xl border p-4 ${lvl.cls}`} role="status">
        <div className="flex items-center gap-2">
          {d?.status.level === "none" || !d ? <CircleCheck className="size-5 text-emerald-600" /> : <Waves className="size-5" />}
          <p className="display text-[22px] font-medium">{lvl.label}</p>
        </div>
        {d?.status.headline && d.status.level !== "none" && <p className="mt-1 text-[15px] font-medium">{d.status.headline}</p>}
        {lvl.action && <p className="mt-2 text-[15px]">{lvl.action}</p>}
        <p className="mt-2 text-[13px] text-muted">
          {d?.status.level === "none" ? `Nothing in effect for Hawaiʻi. Last bulletin: ${d.status.headline?.toLowerCase() ?? "none"}${d.status.issued ? `, ${fmtDateTime(d.status.issued)} HST` : ""}.` : d?.status.issued ? `Issued ${fmtDateTime(d.status.issued)} HST${d.status.expires ? ` · until ${fmtDateTime(d.status.expires)}` : ""}` : ""}
          {" "}<a className="underline underline-offset-4" href="https://www.tsunami.gov/" target="_blank" rel="noreferrer">tsunami.gov</a>
        </p>
      </section>

      <H2>Am I in an evacuation zone?</H2>
      <div className="mt-3 rounded-2xl border border-line bg-surface p-4">
        {zone === null ? (
          <>
            <p className="text-[15px] text-ink-2">Checks your current location against the state&apos;s tsunami evacuation map. Needs a connection; your location is not stored.</p>
            <button onClick={lookup} disabled={busy} className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2 text-[14px] font-semibold text-brand-ink disabled:opacity-50"><LocateFixed className="size-4" /> {busy ? "Checking…" : "Check my location"}</button>
          </>
        ) : zone === "none" ? (
          <p className="text-[16px]"><strong className="text-emerald-700 dark:text-emerald-400">Not in a mapped evacuation zone.</strong> <span className="text-ink-2">If you feel strong or long shaking near the coast, move inland anyway — maps assume a distant tsunami.</span></p>
        ) : (
          <p className="text-[16px]">
            <strong className={zone.code === 1 ? "text-sev4" : zone.code === 2 ? "text-sev3" : "text-emerald-700 dark:text-emerald-400"}>{zone.type}.</strong>{" "}
            <span className="text-ink-2">{zone.desc}{zone.code === 2 ? " (Extreme zone: evacuate only when officials say to.)" : ""}</span>
          </p>
        )}
        {zoneMsg && <p className="mt-2 text-[13px] text-sev4">{zoneMsg}</p>}
        <p className="mt-3 text-[12px] text-muted">Zones: counties &amp; Hawaiʻi Statewide GIS. In a reinforced building of 10+ storeys, the 4th floor and up is considered safe. Official maps: <a className="underline underline-offset-4" href="https://www.hawaiicounty.gov/departments/civil-defense/tsunami-evacuation-zones" target="_blank" rel="noreferrer">Hawaiʻi County</a>, <a className="underline underline-offset-4" href="https://dod.hawaii.gov/hiema/tsunami/" target="_blank" rel="noreferrer">HI-EMA</a>.</p>
      </div>

      <H2>What to do</H2>
      <ul className="mt-3 space-y-3 text-[15px] leading-relaxed">
        <li className="flex gap-3"><span className="mt-1 inline-block size-2.5 shrink-0 rounded-full bg-sev4" /><span><strong>Strong shaking near the shore, the ocean pulling back or roaring:</strong> that is the warning. A local tsunami can arrive in minutes. Go inland or uphill on foot now.</span></li>
        <li className="flex gap-3"><span className="mt-1 inline-block size-2.5 shrink-0 rounded-full bg-sev3" /><span><strong>Sirens (outside the first-business-day test):</strong> check phone, radio or TV for instructions. A Warning means leave the evacuation zone; an Advisory means stay out of the water.</span></li>
        <li className="flex gap-3"><span className="mt-1 inline-block size-2.5 shrink-0 rounded-full bg-sev2" /><span><strong>Distant tsunami (Alaska, Chile, Japan):</strong> you&apos;ll have hours. Watches and warnings appear here and on the Now page; evacuation orders come from the county.</span></li>
        <li className="flex gap-3"><span className="mt-1 inline-block size-2.5 shrink-0 rounded-full bg-sev1" /><span><strong>Stay out until officials say it&apos;s over.</strong> The first wave is often not the largest, and waves can keep coming for hours.</span></li>
      </ul>

      {d && (
        <>
          <H2 right={`${d.sirens.total} sirens statewide · HI-EMA`}>Sirens</H2>
          <p className="mt-3 flex items-start gap-2 text-[14px] text-ink-2"><Siren className="mt-0.5 size-4 shrink-0 text-muted" /> Tested at 11:45 AM on the first business day of each month. {d.sirens.bad.length} sirens are currently listed as needing maintenance statewide{pos ? nearBad.length ? `, ${nearBad.length} within 5 miles of you:` : " — none within 5 miles of you." : "."}</p>
          {nearBad.length > 0 && <ul className="mt-2 space-y-1 text-[13px] text-ink-2">{nearBad.map((s) => <li key={s.id}>{s.loc} — {s.st} · {s.mi} mi</li>)}</ul>}
          {!pos && <p className="mt-1 text-[12px] text-muted">Use &ldquo;Check my location&rdquo; above to see sirens near you.</p>}
          <a className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-brand" href="https://dod.hawaii.gov/hiema/all-hazard-statewide-outdoor-warning-siren-system/" target="_blank" rel="noreferrer"><ExternalLink className="size-3" /> Siren map &amp; status</a>
        </>
      )}
      <p className="mt-8 text-xs leading-relaxed text-muted">Bulletins: NWS Pacific Tsunami Warning Center. Evacuation decisions come from your county Civil Defense / Emergency Management; this page is information, not an order.</p>
    </PageShell>
  );
}
