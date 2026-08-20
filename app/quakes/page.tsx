"use client";
import { useMemo, useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import PageShell, { H2 } from "@/components/PageShell";
import DotMap from "@/components/DotMap";
import Hero from "@/components/Hero";
import EmptyState from "@/components/EmptyState";
import type { Quake, Quakes } from "@/lib/pages";
import { useJson } from "@/lib/data";
import { ago, fmtDateTime } from "@/lib/brand";

const magColor = (m: number) => (m >= 5 ? "#b3261e" : m >= 4 ? "#e4632a" : m >= 3 ? "#d9a400" : "#7c8796");
const magRadius = (m: number) => 3 + Math.max(0, m - 1.5) * 2.4;

export default function QuakesPage() {
  const q = useJson<Quakes>("v1/quakes.json");
  const d = q?.data;
  const [sel, setSel] = useState<string | null>(null);
  const now = q?.fetchedAt ?? 0;
  const dots = useMemo(() => (d?.q ?? []).slice().reverse().map((e) => ({
    id: e.i, lat: e.ll[0], lon: e.ll[1], r: magRadius(e.m), color: magColor(e.m),
    opacity: Math.max(0.25, 1 - (now / 1000 - e.t) / (7 * 86_400)),
    label: e.m >= 4 ? `M${e.m.toFixed(1)}` : undefined,
  })), [d, now]);
  const selected = d?.q.find((e) => e.i === sel);
  const biggest = d?.q.length ? d.q.reduce((a, b) => (b.m > a.m ? b : a)) : undefined;
  const felt = d?.q.filter((e) => e.m >= 3).length ?? 0;

  return (
    <PageShell title="Earthquakes" blurb={d ? `${d.q.length}${d.more ? "+" : ""} quakes of magnitude 2 or more in the last week${d.notable.length ? `, ${d.notable.length} notable this month` : ""}.` : undefined} fetchedAt={q?.fetchedAt} gen={d?.upd} offline={q?.offline} source="USGS">
      {!d && <EmptyState kind="loading" title="" />}
      {d && biggest && (
        <Hero
          tone={magColor(biggest.m)}
          eyebrow={`Largest this week · ${ago(biggest.t * 1000, now)}`}
          value={<>M{biggest.m.toFixed(1)}</>}
          label={biggest.p}
          sentence={felt ? `${felt} quake${felt > 1 ? "s" : ""} this week were big enough to feel (magnitude 3+)${d.notable.length ? `; ${d.notable.length} notable in the last month` : ""}.` : "Nothing big enough to feel this week — the usual background of small Kīlauea quakes."}
          meta={<><span>{biggest.d} km deep</span>{biggest.f ? <span>{biggest.f} felt reports</span> : null}<a className="text-brand underline underline-offset-4" href={`https://earthquake.usgs.gov/earthquakes/eventpage/${biggest.i}/tellus`} target="_blank" rel="noreferrer">Did you feel it?</a></>}
        />
      )}
      {d && !biggest && <EmptyState title="No earthquakes of magnitude 2 or more this week" />}
      {d && (
        <>
          {d.notable.length > 0 && (
            <>
              <H2 right="M3.5+ · last 30 days">Notable</H2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {d.notable.map((e) => <QuakeCard key={e.i} e={e} now={now} />)}
              </ul>
            </>
          )}

          <section className="mt-s4 overflow-hidden rounded-card border border-line">
            <DotMap dots={dots} selected={sel ?? undefined} onSelect={setSel} />
            <div className="flex flex-wrap items-center gap-x-s4 gap-y-1 border-t border-line bg-surface px-s3 py-s2 text-label text-muted num">
              {[["M2", "#7c8796"], ["M3", "#d9a400"], ["M4", "#e4632a"], ["M5+", "#b3261e"]].map(([l, c]) => <span key={l} className="inline-flex items-center gap-1"><span className="inline-block size-2.5 rounded-full" style={{ background: c }} />{l}</span>)}
              <span>· faded = older</span>
              {selected && <span className="ml-auto font-medium text-ink">M{selected.m.toFixed(1)} {selected.p} · {ago(selected.t * 1000, now)}</span>}
            </div>
          </section>

          <H2 right={`${d.q.length}${d.more ? "+" : ""} quakes`}>Last 7 days</H2>
          <ul className="divide-y divide-line">
            {d.q.map((e) => (
              <li key={e.i} id={`q-${e.i}`} className={`flex items-center gap-3 py-2.5 ${e.i === sel ? "-mx-2 rounded-lg bg-surface px-2" : ""}`} onClick={() => setSel(e.i)}>
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full text-label font-bold text-white num" style={{ background: magColor(e.m) }}>{e.m.toFixed(1)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-medium">{e.p}</span>
                  <span className="block text-micro text-muted">{fmtDateTime(e.t * 1000)} HST · {e.d} km deep{e.f ? ` · ${e.f} felt reports` : ""}{e.r ? " · reviewed" : ""}</span>
                </span>
                <a className="shrink-0 text-muted" href={`https://earthquake.usgs.gov/earthquakes/eventpage/${e.i}`} target="_blank" rel="noreferrer" aria-label="USGS event page"><ExternalLink className="size-4" /></a>
              </li>
            ))}
          </ul>
          <a className="mt-3 inline-flex items-center gap-1 text-label font-medium text-brand" href="https://earthquake.usgs.gov/earthquakes/eventpage/unknown/tellus" target="_blank" rel="noreferrer"><ExternalLink className="size-3.5" /> Felt one that isn&apos;t listed? Tell USGS</a>

          <section className="mt-s6 divide-y divide-line rounded-card border border-line bg-surface">
            <Explain q="What does the magnitude mean for me?">People usually start feeling earthquakes around magnitude 3. A quake has one magnitude (energy at the source) but many intensities — how hard it shook where you were depends on distance and depth. Kīlauea produces dozens of small quakes a week; the south side of Hawaiʻi Island has the highest hazard in the state.</Explain>
            <Explain q="Is there early warning here?">No. ShakeAlert covers only California, Oregon and Washington. When shaking starts: drop, cover, hold on. Some Android phones get a crowd-sourced alert for M4.5+; iPhones get none.</Explain>
            <Explain q="Earthquake near the coast?">Strong or long shaking near the shore is your tsunami warning — a local tsunami can arrive in minutes, before any siren. Move inland or uphill on foot right away; don&apos;t wait for an official message. See the Tsunami page for your evacuation zone.</Explain>
          </section>
          <p className="mt-4 text-micro text-muted">Magnitudes and locations can change after USGS review. Data: earthquake.usgs.gov.</p>
        </>
      )}
    </PageShell>
  );
}

function QuakeCard({ e, now }: { e: Quake; now: number }) {
  return (
    <li className="flex items-start gap-3 card">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full text-body font-bold text-white num" style={{ background: magColor(e.m) }}>{e.m.toFixed(1)}</span>
      <span className="min-w-0">
        <span className="block text-body font-semibold leading-snug">{e.p}</span>
        <span className="block text-micro text-muted">{ago(e.t * 1000, now)} · {e.d} km deep{e.f ? ` · ${e.f} felt it` : ""}{e.mmi ? ` · shaking ${e.mmi}` : ""}</span>
        <a className="mt-1 inline-flex items-center gap-1 text-micro font-medium text-brand" href={`https://earthquake.usgs.gov/earthquakes/eventpage/${e.i}/tellus`} target="_blank" rel="noreferrer"><ExternalLink className="size-3" /> Did you feel it?</a>
      </span>
    </li>
  );
}

function Explain({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group px-4 py-3">
      <summary className="flex cursor-pointer list-none items-center justify-between text-body font-semibold [&::-webkit-details-marker]:hidden">{q} <ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" /></summary>
      <p className="mt-2 text-label leading-relaxed text-ink-2">{children}</p>
    </details>
  );
}
