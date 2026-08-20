"use client";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import PageShell, { Section } from "@/components/PageShell";
import DotMap from "@/components/DotMap";
import EmptyState from "@/components/EmptyState";
import type { Quake, Quakes } from "@/lib/pages";
import { useJson } from "@/lib/data";
import { fmtClock, fmtDateTime, fmtTime } from "@/lib/brand";
import { shakingVerb, shakingWord } from "@/lib/plain";

const DAY = 86_400_000;
const USGS = "https://earthquake.usgs.gov/earthquakes";

/** "16 km SSE of Honaunau-Napoopoo" → "Honaunau-Napoopoo". The page never prints km or compass letters. */
const placeOf = (p: string) => /\bof\s+(.+)$/.exec(p)?.[1]?.trim() || p;
/** How it felt: the USGS felt-intensity word when people reported it, else by size. */
const MMI_WORD = ["", "", "Weak", "Weak", "Light", "Moderate", "Strong", "Very strong"];
const VERB: Record<string, string> = { Weak: "was barely felt", Light: "shook lightly", Moderate: "shook", Strong: "shook hard", "Very strong": "shook very hard" };
const feltWord = (e: Quake) => (e.mmi ? MMI_WORD[Math.min(7, Math.max(2, Math.round(e.mmi)))] : shakingWord(e.m));
const feltVerb = (e: Quake) => (e.mmi ? VERB[feltWord(e)] : shakingVerb(e.m));
const weekday = (ms: number) => new Intl.DateTimeFormat("en-US", { timeZone: "Pacific/Honolulu", weekday: "long" }).format(ms);
/** Clock time; weekday once it is more than a day old; date once the weekday would be ambiguous. */
const when = (ms: number, now: number) => (now - ms > 6 * DAY ? fmtDateTime(ms) : fmtClock(ms, now));
const people = (n: number) => (n === 1 ? "1 person felt it" : `${n} people felt it`);
/** Dot radius in map units: size is the only cue, so it grows fast with magnitude. */
const radius = (m: number) => 5 * 1.7 ** (m - 2);

function sentence(d: Quakes, hero: Quake | undefined, now: number): string {
  if (!hero) {
    const n = d.q.length;
    if (!n) return "No earthquakes big enough to register this week.";
    return `Nothing big enough to feel this week. ${d.more ? "More than " : ""}${n} small quake${n === 1 ? "" : "s"}, which is normal for Kīlauea.`;
  }
  const at = hero.t * 1000, age = now - at;
  const head = `A ${hero.m.toFixed(1)} near ${placeOf(hero.p)}`;
  const tail = hero.m >= 6 ? "If it was hard to stand near the coast, go uphill now." : age < 3_600_000 ? "No tsunami expected." : "No tsunami.";
  if (age < 3_600_000 && hero.m >= 4) return `${head} just shook, ${fmtTime(at)}. ${tail}`;
  return `${head} ${feltVerb(hero)} ${age > DAY ? `on ${weekday(at)} at ${fmtTime(at)}` : `at ${fmtTime(at)}`}. ${tail}`;
}

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
  const hero = d?.q.filter((e) => e.m >= 3).sort((a, b) => b.m - a.m || b.t - a.t)[0];
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
    <PageShell title="Earthquakes" sentence={d ? sentence(d, hero, now) : q ? undefined : "Checking for earthquakes…"} fetchedAt={d ? q?.fetchedAt : undefined} gen={d?.upd} offline={q?.offline} source="the USGS">
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
              <ul className="mt-s2 divide-y divide-line">
                {felt.map((e) => (
                  <li key={e.i} className="py-s3">
                    <span className="block text-body font-semibold text-ink">{feltWord(e)} shaking near {placeOf(e.p)}</span>
                    <span className="block text-body text-ink-2 num">{when(e.t * 1000, now)} · {e.m.toFixed(1)}{e.f ? ` · ${people(e.f)}` : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <p className="mt-s7 max-w-[36rem] border-l-4 border-warn pl-s4 text-body text-ink">If the ground shakes hard near the coast, go uphill right away. Do not wait for a siren.</p>

          <ul className="mt-s6 divide-y divide-line">
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
