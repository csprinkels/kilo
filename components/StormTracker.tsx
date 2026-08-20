"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ExternalLink, Satellite } from "lucide-react";
import StormMap, { catColor } from "./StormMap";
import type { Island } from "@/lib/types";
import { ISLAND_POINTS, bearingDeg, categoryOf, compass, distanceNm, ktToMph, nmToMi, outlookFor, type Storm } from "@/lib/storm";
import { fmtDateTime, fmtDayTime, fmtTime, okina } from "@/lib/brand";

const fmtMi = (nm: number) => nmToMi(nm).toLocaleString("en-US");

export default function StormTracker({ storm, island }: { storm: Storm; island: Exclude<Island, "state"> }) {
  const place = ISLAND_POINTS[island];
  const [sel, setSel] = useState(0);
  const points = useMemo(() => [{ hour: 0, at: storm.issuedAt, lat: storm.lat, lon: storm.lon, windKt: storm.windKt, gustKt: storm.gustKt, outlook: false }, ...storm.forecast], [storm]);
  const outlook = useMemo(() => outlookFor(storm, place), [storm, place]);
  const cat = categoryOf(storm.windKt, storm.cls);
  const distNow = distanceNm(storm.lat, storm.lon, place.lat, place.lon);
  const dirNow = compass(bearingDeg(place.lat, place.lon, storm.lat, storm.lon));
  const closest = outlook.closest;
  const closestIsNow = closest.hour === 0;
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    timelineRef.current?.children[sel]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [sel]);

  return (
    <article className="mt-6">
      {/* Header */}
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full px-3 py-1 text-sm font-semibold text-white" style={{ background: catColor(storm.windKt, storm.cls) }}>{cat.label}</span>
          <span className="text-sm text-muted">Advisory {storm.advNum} · {fmtTime(storm.issuedAt)} HST{storm.nextAdvisoryAt ? ` · next ${fmtTime(storm.nextAdvisoryAt)}` : ""}</span>
        </div>
        <h2 className="display mt-2 text-[40px] font-medium leading-[1] tracking-[-0.02em] text-ink">{storm.cls === "HU" ? "Hurricane" : storm.cls === "TS" ? "Tropical Storm" : ""} {storm.name}</h2>
        {storm.headline && <p className="mt-2 text-[17px] leading-snug text-ink">{storm.headline}.</p>}
        <p className="mt-2 text-[15px] text-ink-2">
          Winds <strong className="text-ink">{ktToMph(storm.windKt)} mph</strong>, gusts {ktToMph(storm.gustKt)} mph
          {storm.moveDirDeg != null && storm.moveKt != null && <> · moving <strong className="text-ink">{compass(storm.moveDirDeg)}</strong> at {ktToMph(storm.moveKt)} mph</>}
          {storm.pressureMb && <> · {storm.pressureMb} mb</>}
        </p>
      </header>

      {/* What it means */}
      <section className="mt-5 rounded-2xl border border-line bg-surface p-4" aria-label={`What this means for ${place.label}`}>
        <h3 className="display text-[20px] font-medium">For {okina(place.label)}</h3>
        <p className="mt-2 text-[15px] leading-relaxed">
          The center is <strong>{fmtMi(distNow)} mi {dirNow}</strong> of {okina(place.label)} right now
          {outlook.movingAway ? <> and <strong className="text-emerald-700 dark:text-emerald-400">moving away</strong>.</> : <> and <strong className="text-sev3">getting closer</strong>.</>}
        </p>
        <ul className="mt-3 space-y-2 text-[15px] leading-relaxed">
          <li className="flex gap-2"><Dot color="var(--ink)" />
            <span>
              {closestIsNow
                ? <>Closest point has passed. The storm won&apos;t get nearer than it is now on the current forecast.</>
                : <><strong>Closest approach {fmtDayTime(closest.at)}</strong> ({fmtDateTime(closest.at)} HST), about <strong>{fmtMi(closest.distNm)} mi {compass(closest.bearingFromPlace)}</strong>, forecast as a {categoryOf(closest.windKt).label.toLowerCase()} ({ktToMph(closest.windKt)} mph).</>}
            </span>
          </li>
          <li className="flex gap-2"><Dot color={outlook.tsWindsFrom ? "var(--sev3)" : "var(--sev1)"} />
            <span>
              {outlook.tsWindsFrom
                ? <><strong className="text-sev3">Tropical-storm-force winds (39+ mph) could reach {okina(place.label)} from about {fmtDayTime(outlook.tsWindsFrom)}</strong>{outlook.tsWindsUntil && outlook.tsWindsUntil !== outlook.tsWindsFrom ? ` through ${fmtDayTime(outlook.tsWindsUntil)}` : ""}. Finish preparations before then — outdoor work becomes dangerous once winds arrive.</>
                : <>On the current forecast, tropical-storm-force winds are <strong>not expected</strong> on {okina(place.label)}. Surf, rain and flooding can still happen well away from the center.</>}
            </span>
          </li>
          {outlook.hurricaneWindsFrom && (
            <li className="flex gap-2"><Dot color="var(--sev4)" /><span><strong className="text-sev4">Hurricane-force winds (74+ mph) are possible from about {fmtDayTime(outlook.hurricaneWindsFrom)}.</strong> Follow evacuation orders for your zone.</span></li>
          )}
        </ul>
        {storm.warnings.length > 0 && (
          <div className="mt-4 border-t border-line pt-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Watches &amp; warnings in effect</p>
            <ul className="mt-1.5 space-y-1 text-[14px] leading-snug">
              {storm.warnings.map((w) => <li key={w} className={/Hurricane Warning/i.test(w) ? "font-semibold text-sev4" : /Warning/i.test(w) ? "font-semibold text-sev3" : "text-ink-2"}>{w}</li>)}
            </ul>
          </div>
        )}
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Computed from the official forecast track and wind field. Forecast position errors average ~{Math.round(nmToMi(78))} mi at day 3 and ~{nmToMi(138)} mi at day 5; weather arrives hours before the center does. Your county&apos;s watches and warnings are the call to act.
        </p>
      </section>

      {/* Map */}
      <section className="mt-5 overflow-hidden rounded-2xl border border-line">
        <StormMap storm={storm} place={place} selected={sel} onSelect={setSel} />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-surface px-3 py-2 text-[12px] text-muted">
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-5 rounded-sm border border-dashed border-brand bg-brand/15" /> Where the center will likely go</span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-0.5 w-5 border-t-2 border-dashed border-muted" /> Past track</span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-0.5 w-5 bg-ink" /> Forecast</span>
          {[-1, 0, 1, 2, 3, 4, 5].map((l) => <span key={l} className="inline-flex items-center gap-1"><span className="inline-block size-2.5 rounded-full" style={{ background: catColor(l < 0 ? 30 : l === 0 ? 40 : [64, 83, 96, 113, 137][l - 1]) }} />{l < 0 ? "TD" : l === 0 ? "TS" : `Cat ${l}`}</span>)}
        </div>
      </section>

      {/* Timeline */}
      <section className="mt-5" aria-label="Forecast timeline">
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Forecast timeline · tap a step</h3>
        <div ref={timelineRef} className="no-scrollbar -mx-5 mt-2 flex snap-x gap-2 overflow-x-auto px-5 pb-2">
          {points.map((p, i) => {
            const d = distanceNm(p.lat, p.lon, place.lat, place.lon);
            const c = categoryOf(p.windKt, i === 0 ? storm.cls : undefined);
            const on = i === sel;
            return (
              <button key={i} onClick={() => setSel(i)} aria-pressed={on}
                className={`w-[150px] shrink-0 snap-center rounded-2xl border p-3 text-left transition-colors ${on ? "border-ink bg-surface" : "border-line bg-surface/60"}`}>
                <div className="text-[13px] font-semibold text-ink">{i === 0 ? "Now" : fmtDayTime(p.at)}</div>
                <div className="mt-0.5 text-[11px] text-muted">{i === 0 ? fmtTime(p.at) + " HST" : fmtDateTime(p.at).replace(/^\w+ \d+, /, "")}{p.outlook ? " · outlook" : ""}</div>
                <div className="mt-2 flex items-center gap-1.5"><span className="inline-block size-3 rounded-full" style={{ background: catColor(p.windKt, i === 0 ? storm.cls : undefined) }} /><span className="text-[13px] font-medium">{c.level > 0 ? `Cat ${c.level}` : c.label}</span></div>
                <div className="text-[13px] text-ink-2">{ktToMph(p.windKt)} mph winds</div>
                <div className="mt-1 text-[12px] text-muted">{fmtMi(d)} mi {compass(bearingDeg(place.lat, place.lon, p.lat, p.lon))} of {okina(place.label.split(" ")[0])}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Explainers */}
      <section className="mt-6 divide-y divide-line rounded-2xl border border-line bg-surface">
        <Explain q="What does the cone mean?">
          The shaded cone is where the <em>center</em> of the storm will probably travel — about 2 times out of 3 it stays inside. It is <strong>not the size of the storm</strong>: damaging wind, rain, surf and flooding reach far outside the cone, and being just outside it is not safe.
        </Explain>
        <Explain q="What do the categories mean?">
          Categories 1–5 describe <em>wind</em> only (74, 96, 111, 130, 157+ mph). Most deaths in Hawaiʻi storms come from flooding rain, surf and landslides, which don&apos;t follow the category. A tropical storm can flood a district; a weakening hurricane can still drop a foot of rain.
        </Explain>
        <Explain q="Watch vs. warning?">
          <strong>Watch</strong>: conditions are <em>possible</em> within about 48 hours — get ready now (water, fuel, medications, plan). <strong>Warning</strong>: conditions are <em>expected</em> within about 36 hours — finish preparations; travel becomes unsafe once winds arrive.
        </Explain>
        <Explain q="Why do the times keep changing?">
          A new official forecast comes out every 6 hours (with a short update every 3). Each one uses newer data, so the track and timing shift. Plan for the earlier end of any range, not the later one.
        </Explain>
      </section>

      {/* Official + imagery */}
      <section className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[14px]">
        {storm.links.public && <a className="inline-flex items-center gap-1 font-medium text-brand" href={storm.links.public} target="_blank" rel="noreferrer"><ExternalLink className="size-3.5" /> Official advisory</a>}
        {storm.links.graphics && <a className="inline-flex items-center gap-1 font-medium text-brand" href={storm.links.graphics} target="_blank" rel="noreferrer"><ExternalLink className="size-3.5" /> Official graphics</a>}
        {storm.links.discussion && <a className="inline-flex items-center gap-1 font-medium text-brand" href={storm.links.discussion} target="_blank" rel="noreferrer"><ExternalLink className="size-3.5" /> Forecaster discussion</a>}
      </section>
      <Imagery id={storm.id} />
    </article>
  );
}

function Dot({ color }: { color: string }) {
  return <span className="mt-2 inline-block size-2 shrink-0 rounded-full" style={{ background: color }} />;
}

function Explain({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group px-4 py-3">
      <summary className="flex cursor-pointer list-none items-center justify-between text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
        {q} <ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" />
      </summary>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{children}</p>
    </details>
  );
}

/** Satellite imagery is ~200–300 KB each: only loaded on tap, never part of the offline payload. */
function Imagery({ id }: { id: string }) {
  const [stamp, setStamp] = useState<number | null>(null); // cache-buster chosen on tap, so render stays pure
  const floater = `https://cdn.star.nesdis.noaa.gov/FLOATER/data/${id.toUpperCase()}/GEOCOLOR/1000x1000.jpg`;
  const sector = "https://cdn.star.nesdis.noaa.gov/GOES18/ABI/SECTOR/hi/GEOCOLOR/1200x1200.jpg";
  return (
    <section className="mt-4">
      {stamp === null ? (
        <button onClick={() => setStamp(Math.floor(Date.now() / 600_000))} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-[14px] font-medium">
          <Satellite className="size-4" /> Show live satellite (uses data)
        </button>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <figure><img src={`${floater}?t=${stamp}`} alt="GOES-West satellite view centered on the storm" className="w-full rounded-xl border border-line" loading="lazy" /><figcaption className="mt-1 text-xs text-muted">Storm close-up · GOES-West, NOAA</figcaption></figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <figure><img src={`${sector}?t=${stamp}`} alt="GOES-West satellite view of the Hawaiian Islands" className="w-full rounded-xl border border-line" loading="lazy" /><figcaption className="mt-1 text-xs text-muted">Hawaiʻi sector · GOES-West, NOAA</figcaption></figure>
        </div>
      )}
    </section>
  );
}
