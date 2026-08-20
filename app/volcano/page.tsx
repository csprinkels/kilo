"use client";
import { useState } from "react";
import { Camera, ChevronDown, ExternalLink, Wind } from "lucide-react";
import PageShell, { H2 } from "@/components/PageShell";
import Hero from "@/components/Hero";
import EmptyState from "@/components/EmptyState";
import type { Volcano } from "@/lib/pages";
import { useJson } from "@/lib/data";
import { ago, fmtDateTime } from "@/lib/brand";

const COLOR: Record<string, string> = { GREEN: "#2e7d32", YELLOW: "#d9a400", ORANGE: "#e4632a", RED: "#b3261e" };
const LEVEL_COPY: Record<string, string> = {
  NORMAL: "Background activity. Nothing unusual.",
  ADVISORY: "Elevated unrest, or activity has wound down. For Kīlauea this is the pause between fountaining episodes.",
  WATCH: "Eruption underway with limited hazards, or escalating unrest. Kīlauea sits here during fountaining.",
  WARNING: "Hazardous eruption imminent or underway.",
};
const aqiClass = (aqi?: number) => (aqi == null ? "text-muted" : aqi <= 50 ? "text-emerald-700 dark:text-emerald-400" : aqi <= 100 ? "text-sev2" : aqi <= 150 ? "text-sev3" : "text-sev4");
const aqiLabel = (aqi?: number) => (aqi == null ? "" : aqi <= 50 ? "Good" : aqi <= 100 ? "Moderate" : aqi <= 150 ? "Unhealthy for sensitive groups" : aqi <= 200 ? "Unhealthy" : "Very unhealthy");

export default function VolcanoPage() {
  const v = useJson<Volcano>("v1/volcano.json");
  const d = v?.data;
  const [cam, setCam] = useState<string | null>(null);
  const now = v?.fetchedAt ?? 0;

  return (
    <PageShell title="Volcano" blurb={d?.kilauea ? `Kīlauea is ${d.kilauea.erupting ? "erupting" : "not erupting"} · ${d.kilauea.level.toLowerCase()}${d.maunaloa ? ` · Mauna Loa ${d.maunaloa.level.toLowerCase()}` : ""}.` : undefined} fetchedAt={v?.fetchedAt} gen={d?.upd} offline={v?.offline} source="USGS HVO">
      {!d && <EmptyState kind="loading" title="" />}
      {d && (
        <>
          {d.kilauea && (
            <Hero
              tone={COLOR[d.kilauea.color] ?? "var(--cond-cloud)"}
              eyebrow={`Kīlauea · HVO ${ago(d.kilauea.noticeAt, now)}`}
              value={<span className="text-display">{d.kilauea.erupting ? "Erupting" : "Not erupting"}</span>}
              right={<span className="inline-flex rounded-full px-3 py-1 text-label font-bold uppercase tracking-wide text-white" style={{ background: COLOR[d.kilauea.color] ?? "#7c8796" }}>{d.kilauea.level}</span>}
              label={d.kilauea.erupting ? `Activity at the ${d.kilauea.where}` : d.kilauea.vnum === "332010" ? "Summit eruption paused between episodes" : undefined}
              sentence={d.kilauea.sms}
              meta={<>{d.kilauea.levelSince && <span>{d.kilauea.level} since {fmtDateTime(d.kilauea.levelSince)}{d.kilauea.prevLevel ? ` (was ${d.kilauea.prevLevel})` : ""}</span>}{d.maunaloa && <span>Mauna Loa {d.maunaloa.level}</span>}</>}
            />
          )}

          {d.kilauea && (
            <>
              <H2 right={`HVO daily update · ${fmtDateTime(d.kilauea.noticeAt)}`}>Today&apos;s update</H2>
              <div className="mt-s3 divide-y divide-line rounded-card border border-line bg-surface">
                {Object.entries(d.kilauea.sections).filter(([k]) => !/Resources|Overview/i.test(k)).map(([k, body]) => (
                  <details key={k} className="group px-4 py-3">
                    <summary className="flex cursor-pointer list-none items-center justify-between text-body font-semibold [&::-webkit-details-marker]:hidden">{k} <ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" /></summary>
                    <p className="mt-2 text-label leading-relaxed text-ink-2">{body}</p>
                  </details>
                ))}
              </div>
              <a className="mt-2 inline-flex items-center gap-1 text-label font-medium text-brand" href={d.kilauea.noticeUrl} target="_blank" rel="noreferrer"><ExternalLink className="size-3.5" /> Full HVO notice</a>
            </>
          )}

          <H2 right="DOH monitors · 15-min SO₂, hourly PM2.5">Vog &amp; air</H2>
          {d.air.length ? (
            <ul className="mt-s3 divide-y divide-line">
              {d.air.map((a) => (
                <li key={a.name} className="flex min-h-12 items-center justify-between gap-s3 py-s2 text-body num">
                  <span className="font-medium">{a.name}{a.stale && <span className="ml-2 rounded bg-surface-2 px-1.5 py-0.5 text-micro text-muted">stale</span>}</span>
                  <span className="flex gap-s4 text-label text-ink-2">
                    <span>SO₂ {a.so2 != null ? `${a.so2} ppm` : "—"}</span>
                    <span>PM2.5 {a.pm25 ?? "—"}</span>
                    <span className={`w-28 text-right font-medium ${aqiClass(a.aqi)}`}>{a.aqi != null ? `AQI ${a.aqi} ${aqiLabel(a.aqi)}` : ""}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-label text-muted">No monitor data right now.</p>}
          <p className="mt-3 flex items-start gap-2 text-micro leading-relaxed text-ink-2"><Wind className="mt-0.5 size-4 shrink-0 text-muted" /> Trade winds push vog toward Kaʻū and Kona; light or southerly (kona) winds bring it over Hilo and up the chain. If you have asthma, COPD or heart disease, are pregnant, young or elderly: stay indoors, close windows, run AC or a HEPA purifier, keep medication handy. Dust masks don&apos;t stop SO₂.</p>
          <a className="mt-1 inline-flex items-center gap-1 text-micro font-medium text-brand" href="https://vog.ivhhn.org/" target="_blank" rel="noreferrer"><ExternalLink className="size-3" /> Vog dashboard &amp; health guidance</a>

          <H2 right="USGS, public domain">Webcams</H2>
          <p className="mt-2 text-micro text-muted">Tap to load a still (6–250 KB each). Nothing loads on its own.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {d.cams.map((c) => (
              <button key={c.id} onClick={() => setCam(c.id)} aria-pressed={cam === c.id} className={`btn ${cam === c.id ? "chip-active" : ""}`}><Camera className="size-4" /> {c.name}</button>
            ))}
          </div>
          {cam && (
            <figure className="mt-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`https://volcanoes.usgs.gov/cams/${cam}/images/M.jpg?ts=${Math.floor(now / 600_000)}`} alt={d.cams.find((c) => c.id === cam)?.name ?? "HVO webcam"} className="w-full rounded-card border border-line" loading="lazy" />
              <figcaption className="mt-1 text-micro text-muted">{d.cams.find((c) => c.id === cam)?.name} · USGS HVO · updates every few minutes</figcaption>
            </figure>
          )}

          <section className="mt-6 divide-y divide-line rounded-card border border-line bg-surface">
            {Object.entries(LEVEL_COPY).map(([lvl, copy]) => (
              <div key={lvl} className="flex items-start gap-3 px-4 py-3 text-label">
                <span className="mt-0.5 inline-block size-3 shrink-0 rounded-full" style={{ background: COLOR[{ NORMAL: "GREEN", ADVISORY: "YELLOW", WATCH: "ORANGE", WARNING: "RED" }[lvl]!] }} />
                <span><strong>{lvl}</strong> · {copy}</span>
              </div>
            ))}
          </section>
          <p className="mt-4 text-micro leading-relaxed text-muted">The colour is the aviation code (ash), the word is the ground-hazard level. Park closures: <a className="underline underline-offset-4" href="https://www.nps.gov/havo/planyourvisit/conditions.htm" target="_blank" rel="noreferrer">nps.gov/havo</a>. Data: volcanoes.usgs.gov, hiso2index.info.</p>
        </>
      )}
    </PageShell>
  );
}
