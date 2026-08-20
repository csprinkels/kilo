"use client";
import { useState } from "react";
import { Camera, ChevronDown, ExternalLink, Wind } from "lucide-react";
import PageShell, { H2 } from "@/components/PageShell";
import type { Volcano, VolcanoStatus } from "@/lib/pages";
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
    <PageShell title="Volcano" blurb="USGS Hawaiian Volcano Observatory, Hawaiʻi DOH air monitors" fetchedAt={v?.fetchedAt} offline={v?.offline}>
      {!d && <p className="py-10 text-center text-muted">{v === null ? "Loading…" : "No volcano data saved yet."}</p>}
      {d && (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[d.kilauea, d.maunaloa].filter(Boolean).map((s) => <StatusTile key={s!.vnum} s={s!} now={now} />)}
          </div>

          {d.kilauea && (
            <>
              <H2 right={`HVO daily update · ${fmtDateTime(d.kilauea.noticeAt)}`}>Kīlauea today</H2>
              <p className="mt-3 text-[16px] leading-relaxed">{d.kilauea.sms}</p>
              <div className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface">
                {Object.entries(d.kilauea.sections).filter(([k]) => !/Resources|Overview/i.test(k)).map(([k, body]) => (
                  <details key={k} className="group px-4 py-3">
                    <summary className="flex cursor-pointer list-none items-center justify-between text-[15px] font-semibold [&::-webkit-details-marker]:hidden">{k} <ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" /></summary>
                    <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{body}</p>
                  </details>
                ))}
              </div>
              <a className="mt-2 inline-flex items-center gap-1 text-[14px] font-medium text-brand" href={d.kilauea.noticeUrl} target="_blank" rel="noreferrer"><ExternalLink className="size-3.5" /> Full HVO notice</a>
            </>
          )}

          <H2 right="DOH monitors · 15-min SO₂, hourly PM2.5">Vog &amp; air</H2>
          {d.air.length ? (
            <ul className="mt-3 divide-y divide-line">
              {d.air.map((a) => (
                <li key={a.name} className="flex items-center justify-between gap-3 py-2 text-[14px]">
                  <span className="font-medium">{a.name}{a.stale && <span className="ml-2 rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">stale</span>}</span>
                  <span className="flex gap-4 tabular-nums text-ink-2">
                    <span>SO₂ {a.so2 != null ? `${a.so2} ppm` : "—"}</span>
                    <span>PM2.5 {a.pm25 ?? "—"}</span>
                    <span className={`w-28 text-right font-medium ${aqiClass(a.aqi)}`}>{a.aqi != null ? `AQI ${a.aqi} ${aqiLabel(a.aqi)}` : ""}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-[14px] text-muted">No monitor data right now.</p>}
          <p className="mt-3 flex items-start gap-2 text-[13px] leading-relaxed text-ink-2"><Wind className="mt-0.5 size-4 shrink-0 text-muted" /> Trade winds push vog toward Kaʻū and Kona; light or southerly (kona) winds bring it over Hilo and up the chain. If you have asthma, COPD or heart disease, are pregnant, young or elderly: stay indoors, close windows, run AC or a HEPA purifier, keep medication handy. Dust masks don&apos;t stop SO₂.</p>
          <a className="mt-1 inline-flex items-center gap-1 text-[13px] font-medium text-brand" href="https://vog.ivhhn.org/" target="_blank" rel="noreferrer"><ExternalLink className="size-3" /> Vog dashboard &amp; health guidance</a>

          <H2 right="USGS, public domain">Webcams</H2>
          <p className="mt-2 text-[13px] text-muted">Tap to load a still (6–250 KB each). Nothing loads on its own.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {d.cams.map((c) => (
              <button key={c.id} onClick={() => setCam(c.id)} aria-pressed={cam === c.id} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium ${cam === c.id ? "border-ink bg-surface" : "border-line bg-surface text-ink-2"}`}><Camera className="size-3.5" /> {c.name}</button>
            ))}
          </div>
          {cam && (
            <figure className="mt-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`https://volcanoes.usgs.gov/cams/${cam}/images/M.jpg?ts=${Math.floor(now / 600_000)}`} alt={d.cams.find((c) => c.id === cam)?.name ?? "HVO webcam"} className="w-full rounded-xl border border-line" loading="lazy" />
              <figcaption className="mt-1 text-xs text-muted">{d.cams.find((c) => c.id === cam)?.name} · USGS HVO · updates every few minutes</figcaption>
            </figure>
          )}

          <section className="mt-6 divide-y divide-line rounded-2xl border border-line bg-surface">
            {Object.entries(LEVEL_COPY).map(([lvl, copy]) => (
              <div key={lvl} className="flex items-start gap-3 px-4 py-3 text-[14px]">
                <span className="mt-0.5 inline-block size-3 shrink-0 rounded-full" style={{ background: COLOR[{ NORMAL: "GREEN", ADVISORY: "YELLOW", WATCH: "ORANGE", WARNING: "RED" }[lvl]!] }} />
                <span><strong>{lvl}</strong> · {copy}</span>
              </div>
            ))}
          </section>
          <p className="mt-4 text-xs leading-relaxed text-muted">The colour is the aviation code (ash), the word is the ground-hazard level. Park closures: <a className="underline underline-offset-4" href="https://www.nps.gov/havo/planyourvisit/conditions.htm" target="_blank" rel="noreferrer">nps.gov/havo</a>. Data: volcanoes.usgs.gov, hiso2index.info.</p>
        </>
      )}
    </PageShell>
  );
}

function StatusTile({ s, now }: { s: VolcanoStatus; now: number }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between">
        <p className="display text-[22px] font-medium">{s.name}</p>
        <span className="rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-wide text-white" style={{ background: COLOR[s.color] ?? "#7c8796" }}>{s.level}</span>
      </div>
      <p className="mt-2 text-[15px] font-semibold">{s.erupting ? `Erupting · ${s.where}` : s.vnum === "332010" ? "Not erupting · summit eruption paused" : "Not erupting"}</p>
      <p className="mt-1 text-[13px] text-muted">
        {s.levelSince ? `${s.level} since ${fmtDateTime(s.levelSince)}${s.prevLevel ? ` (was ${s.prevLevel})` : ""} · ` : ""}updated {ago(s.noticeAt, now)}
      </p>
    </div>
  );
}
