"use client";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import PageShell, { Section } from "@/components/PageShell";
import DotMap from "@/components/DotMap";
import EmptyState from "@/components/EmptyState";
import type { Quake, Quakes } from "@/lib/pages";
import { useJson } from "@/lib/data";
import { fmtClock, fmtDateTime } from "@/lib/brand";
import { feltWord, heroQuake, quakePlace, quakeSentence } from "@/lib/plain";

const DAY = 86_400_000;
const USGS = "https://earthquake.usgs.gov/earthquakes";

/** Clock time; weekday once it is more than a day old; date once the weekday would be ambiguous. */
const when = (ms: number, now: number) => (now - ms > 6 * DAY ? fmtDateTime(ms) : fmtClock(ms, now));
const people = (n: number) => (n === 1 ? "1 person felt it" : `${n} people felt it`);
/** Dot radius in map units: size is the only cue, so it grows fast with magnitude. */
const radius = (m: number) => 5 * 1.7 ** (m - 2);

export default function QuakesPage() {
  // "Try again" remounts the loader, which refetches.
  const [tries, setTries] = useState(0);
  return <QuakesBody key={tries} retry={() => setTries((n) => n + 1)} />;
}

function QuakesBody({ retry }: { retry: () => void }) {
  const q = useJson<Quakes>("v1/quakes.json");
  const d = q?.data;
  const now = q?.fetchedAt ?? 0;

  // Biggest quake people could feel this week (ties → most recent).
  const hero = d ? heroQuake(d) : undefined;
  // This week's list plus the month's notable ones, once each.
  const month = new Map<string, Quake>();
  for (const e of [...(d?.q ?? []), ...(d?.notable ?? [])]) month.set(e.i, e);
  const all = [...month.values()];
  // Ones people felt: the five biggest M ≥ 3 of the last 30 days, shown newest first.
  const felt = all.filter((e) => e.m >= 3 && now - e.t * 1000 <= 30 * DAY).sort((a, b) => b.m - a.m).slice(0, 5).sort((a, b) => b.t - a.t);
  // The map: big ones drawn last so they sit on top; lighter = older.
  const dots = all.sort((a, b) => a.m - b.m).map((e) => ({ id: e.i, lat: e.ll[0], lon: e.ll[1], r: radius(e.m), opacity: Math.max(0.2, 1 - (now - e.t * 1000) / (30 * DAY)) }));
  const tell = hero ?? d?.q[0];

  return (
    <PageShell title="Earthquakes" sentence={d ? quakeSentence(d, now) : q ? undefined : "Checking for earthquakes…"} fetchedAt={d ? q?.fetchedAt : undefined} gen={d?.upd} offline={q?.offline} source="the USGS">
      {q && !d && (
        <>
          <EmptyState kind="error" title="Can't load right now.">Try again when you have signal. In an emergency call 911.</EmptyState>
          <button className="btn mt-s3" onClick={retry}>Try again</button>
        </>
      )}
      {d && (
        <>
          <DotMap className="picture mt-s4" dots={dots} label="Map of the Hawaiian Islands with a dot for each earthquake this month" caption="Bigger dot, bigger quake. Lighter dot, older quake." />

          <Section title="Ones people felt" sentence={felt.length ? undefined : "None this month."}>
            {felt.length > 0 && (
              <ul className="list mt-s3">
                {felt.map((e) => (
                  <li key={e.i} className="py-s3">
                    <span className="block text-body font-semibold text-ink">{feltWord(e)} shaking near {quakePlace(e.p)}</span>
                    <span className="block text-body text-ink-2 num">{when(e.t * 1000, now)} · {e.m.toFixed(1)}{e.f ? ` · ${people(e.f)}` : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <p className="mt-s7 max-w-[36rem] border-l-4 border-warn pl-s4 text-body text-ink">If the ground shakes hard near the coast, go uphill right away. Do not wait for a siren.</p>

          <ul className="list mt-s6">
            {tell && (
              <li><a className="row font-semibold text-brand" href={`${USGS}/eventpage/${tell.i}/tellus`} target="_blank" rel="noreferrer">Tell the USGS you felt it <ChevronRight className="size-5 shrink-0" aria-hidden /></a></li>
            )}
            <li><a className="row font-semibold text-brand" href={`${USGS}/map/?extent=18.5,-161&extent=22.8,-154.3`} target="_blank" rel="noreferrer">All quakes on the USGS map <ChevronRight className="size-5 shrink-0" aria-hidden /></a></li>
          </ul>
        </>
      )}
    </PageShell>
  );
}
