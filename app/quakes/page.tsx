"use client";
import { useState } from "react";
import Icon from "@/components/Icon";
import { Notice } from "@/components/AlertBlock";
import PageShell from "@/components/PageShell";
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
          {/* qk-map — the month as a picture: the framed map, its caption, the way out to the full one. */}
          <section className="cs-card t-quakes mt-s5">
            <DotMap className="cs-figure qk-frame" dots={dots} label="Map of the Hawaiian Islands with a dot for each earthquake this month" caption="Bigger dot, bigger quake. Lighter dot, older quake." />
            <div className="cs-chiprow">
              <a className="cs-chip cs-chip--link qk-out" href={`${USGS}/map/?extent=18.5,-161&extent=22.8,-154.3`} target="_blank" rel="noreferrer">All quakes on the USGS map <Icon name="caret-right" size={14} /></a>
            </div>
          </section>

          {/* qk-felt — one card, one list: the quakes people actually noticed. */}
          <section className="cs-card t-quakes mt-s4">
            <h2 className="cs-label"><Icon name="pulse" size={15} /> Ones people felt</h2>
            {felt.length > 0 ? (
              <ul className="qk-list">
                {felt.map((e) => {
                  const dot = (8 + Math.min(Math.max(e.m - 3, 0), 3) * 6) / 16; // same idea as the map: bigger dot, bigger quake
                  return (
                    <li key={e.i} className="cs-row cs-row--mid">
                      <span className="qk-mark" aria-hidden><span className="qk-bullet" style={{ width: `${dot}rem`, height: `${dot}rem` }} /></span>
                      <span className="cs-rowmain">
                        <span className="cs-rowname">{feltWord(e)} shaking near {quakePlace(e.p)}</span>
                        <span className="cs-rowsub num">{when(e.t * 1000, now)}{e.f ? ` · ${people(e.f)}` : ""}</span>
                      </span>
                      <span className="cs-rowend qk-mag" aria-label={`magnitude ${e.m.toFixed(1)}`}>{e.m.toFixed(1)}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState title="None this month." />
            )}
            {tell && (
              <div className="cs-actions">
                <a className="cs-link qk-out" href={`${USGS}/eventpage/${tell.i}/tellus`} target="_blank" rel="noreferrer">Tell the USGS you felt it</a>
              </div>
            )}
          </section>

          {/* qk-safety — the standing rule, in the app's shared Notice (card + brick tile + title + line). */}
          <Notice title="If the ground shakes hard near the coast, go uphill right away." icon="waves">Do not wait for a siren.</Notice>
        </>
      )}
    </PageShell>
  );
}
