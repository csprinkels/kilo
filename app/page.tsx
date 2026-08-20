"use client";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import ItemRow from "@/components/ItemRow";
import AlertBlock from "@/components/AlertBlock";
import AlertsCard from "@/components/AlertsCard";
import Freshness from "@/components/Freshness";
import SectionNav from "@/components/SectionNav";
import TopBar from "@/components/TopBar";
import StormMap from "@/components/StormMap";
import ConditionIcon, { TopicIcon, type Topic } from "@/components/ConditionIcon";
import type { DigestItem, Island, Item } from "@/lib/types";
import { ISLANDS, hashOf } from "@/lib/types";
import type { StormsSnapshot } from "@/lib/storm";
import { ISLAND_POINTS } from "@/lib/storm";
import type { Weather } from "@/lib/pages";
import { useFeed, useIslandChosen, useJson, useStoredIsland } from "@/lib/data";
import { condWord, feelsLike, summarize as weatherSentence, sunTimes } from "@/lib/summary";
import { TOWNS } from "@/lib/towns";
import { plainAlert, shakingVerb, stormLine, type Plain } from "@/lib/plain";
import { APP_NAME, fmtClock, fmtTime, islandName } from "@/lib/brand";

/** A pushed digest item rendered like any other row when the phone has no newer snapshot. */
const fromDigest = (d: DigestItem, at: number): Item => ({
  ...d, source: "digest", tier: "official", islands: [], lastConfirmedAt: at, hash: "",
});
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export default function Home() {
  const [island, setIsland] = useStoredIsland();
  const chosen = useIslandChosen();
  // Deep link from a notification: /?island=hawaii&item=<key> (read once; static export has no server-side params)
  const focusKey = useSyncExternalStore(() => () => {}, () => new URLSearchParams(window.location.search).get("item"), () => null);
  const linkedIsland = useSyncExternalStore(() => () => {}, () => new URLSearchParams(window.location.search).get("island"), () => null);
  useEffect(() => {
    if (linkedIsland && ISLANDS.includes(linkedIsland as never) && linkedIsland !== island) queueMicrotask(() => setIsland(linkedIsland as Island));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!chosen && !linkedIsland) return <FirstRun onPick={setIsland} />;
  return <Now island={island === "state" ? "hawaii" : island} setIsland={setIsland} focusKey={focusKey} />;
}

/** One screen for someone who arrived from a neighbor's link: what this is, which island, done. */
function FirstRun({ onPick }: { onPick: (i: Island) => void }) {
  return (
    <main className="relative z-[1] mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5 pb-s7 pt-s7">
      <h1 className="h-display">{APP_NAME}</h1>
      <p className="mt-s3 max-w-[36rem] text-body text-ink-2">{APP_NAME} shows what is happening on your island: weather, roads, storms, earthquakes, the volcano, tsunami, and what neighbors report.</p>
      <h2 className="h-title mt-s7">Which island are you on?</h2>
      <div className="mt-s3 flex flex-col gap-s2">
        {ISLANDS.map((i) => (
          <button key={i} onClick={() => onPick(i)} className="btn btn-big justify-start px-s5 text-left">{islandName(i, true)}</button>
        ))}
      </div>
      <p className="mt-s4 text-small text-ink-2">You can change this any time at the top of the screen.</p>
    </main>
  );
}

function Now({ island, setIsland, focusKey }: { island: Exclude<Island, "state">; setIsland: (i: Island) => void; focusKey: string | null }) {
  const { ess, snap, digest, mode } = useFeed(island);
  const stormsSnap = useJson<StormsSnapshot>("v1/storms.json");
  const now = ess?.fetchedAt || snap?.fetchedAt || 0;
  const gen = Math.max(ess?.data?.gen ?? 0, snap?.data?.gen ?? 0);
  const offline = !!ess?.offline && !!snap?.offline;
  const loaded = !!(snap?.data || ess?.data);
  const [showAll, setShowAll] = useState(false);

  const items = useMemo(() => {
    const base = snap?.data?.items ?? [];
    // A push digest newer than the stored snapshot fills in what the snapshot can't (the phone never got it).
    if (digest && digest.island === island && digest.gen > (snap?.data?.gen ?? 0)) {
      const have = new Set(base.map((i) => i.key));
      return [...digest.top.filter((d) => !have.has(d.key)).map((d) => fromDigest(d, digest.gen)), ...base].sort((a, b) => b.sev - a.sev || b.issuedAt - a.issuedAt);
    }
    return base;
  }, [snap, digest, island]);
  // Headlines the essentials file knows about but the snapshot doesn't yet: titles now, details when the link allows.
  const headlinesOnly = useMemo(() => (ess?.data && ess.data.gen > (snap?.data?.gen ?? 0) ? ess.data.alerts.filter((a) => !items.some((i) => i.key && hashOf(i.key) === a.h)) : []), [ess, snap, items]);

  const plain = useMemo(() => new Map(items.map((i) => [i.key, plainAlert(i, now, island)] as [string, Plain])), [items, now, island]);
  const official = items.filter((i) => i.tier !== "community");
  const warnings = official.filter((i) => plain.get(i.key)!.level >= 3).sort((a, b) => plain.get(b.key)!.level - plain.get(a.key)!.level || b.issuedAt - a.issuedAt);
  // A shelter is news, not a warning: it leads only when nothing else is shouting, and then as plain rows.
  const leadIdx = warnings.findIndex((i) => i.type !== "shelter");
  const lead = leadIdx >= 0 ? warnings[leadIdx] : undefined;
  const rest = warnings.filter((i) => i !== lead);
  // A deep link from a notification must never land behind "All warnings".
  const alsoRows = showAll || (focusKey && rest.some((i) => i.key === focusKey)) ? rest : rest.slice(0, 3);
  const headsUp = official.filter((i) => (i.type === "advisory" || i.type === "storm") && plain.get(i.key)!.level === 2);

  const storms = stormsSnap?.data?.storms ?? [];
  const place = ISLAND_POINTS[island];
  const stormLines = storms.map((s) => ({ s, ...stormLine(s, place) })).sort((a, b) => Number(b.approaching) - Number(a.approaching) || b.level - a.level);
  const mainStorm = stormLines.find((x) => x.approaching);

  const rows = topicRows(items, plain, island, now, stormLines.map((x) => x.short), !!(lead && lead.type === "tsunami"));

  return (
    <main className="relative z-[1] mx-auto w-full max-w-2xl px-5 pb-32 md:pb-20">
      <TopBar island={island} onIsland={setIsland} />
      <SectionNav />
      <Freshness gen={gen} checkedAt={now} offline={offline} weak={mode === "low" && !offline} />

      {/* Warnings: the only coloured block, only when there is one */}
      {lead && (
        <AlertBlock item={lead} now={now}>
          {(alsoRows.length > 0 || headlinesOnly.length > 0) && (
            <div className="mt-s4">
              <p className="text-small font-bold text-ink">Also in effect</p>
              <ul className="divide-y divide-line">
                {headlinesOnly.map((a) => <li key={a.h} className="py-s3 text-body font-semibold">{a.title}<span className="block text-small font-normal text-ink-2">Details load when the signal is better.</span></li>)}
                {alsoRows.map((i) => <ItemRow key={i.key} item={i} now={now} focus={i.key === focusKey} />)}
              </ul>
              {rest.length > 3 && !showAll && <button className="btn mt-s2" onClick={() => setShowAll(true)}>All warnings ({rest.length}) <ChevronRight className="size-4" aria-hidden /></button>}
            </div>
          )}
        </AlertBlock>
      )}
      {!lead && (headlinesOnly.length > 0 || rest.length > 0) && (
        <ul className="mt-s4 divide-y divide-line">
          {headlinesOnly.map((a) => <li key={a.h} className="py-s3 text-body font-semibold">{a.title}<span className="block text-small font-normal text-ink-2">Details load when the signal is better.</span></li>)}
          {rest.map((i) => <ItemRow key={i.key} item={i} now={now} focus={i.key === focusKey} />)}
        </ul>
      )}

      {/* Right now: the weather, like a weather app */}
      <h1 className="h-title mt-s6">Right now</h1>
      {mode === "low" || offline ? <p className="mt-s2 text-body text-ink-2">Weather loads when the signal is better.</p> : <WeatherNow island={island} />}
      {headsUp.map((i) => <p key={i.key} className="mt-s2 text-body text-ink"><span className="font-bold">Heads up:</span> {plain.get(i.key)!.headline}. <span className="text-ink-2">{plain.get(i.key)!.action}</span></p>)}

      {/* Around the island: one row per topic, always the same order */}
      {loaded && (
        <section className="mt-s7" aria-label={`Around ${islandName(island)}`}>
          <h2 className="h-title">Around {islandName(island)}</h2>
          <ul className="mt-s2 divide-y divide-line">
            {rows.map((r) => (
              <li key={r.key}>
                <Link href={r.href} className="row">
                  <TopicIcon topic={r.icon} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-body font-semibold text-ink">{r.label}</span>
                    <span className="block text-body leading-snug text-ink-2">{r.text}</span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-ink-2" aria-hidden />
                </Link>
                {r.key === "storms" && mainStorm && (
                  <Link href="/storms/" className="picture mb-s3 block"><StormMap storm={mainStorm.s} place={place} compact /></Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {!loaded && !offline && <p className="mt-s7 text-body text-ink-2">Loading what is happening around {islandName(island)}…</p>}

      <AlertsCard island={island} compact />

      <footer className="mt-s7 text-small leading-relaxed text-ink-2">
        Free. No ads. No account. Not an emergency service — call 911. <Link className="font-semibold text-brand" href="/sources/">How {APP_NAME} works</Link>
      </footer>
    </main>
  );
}

type Row = { key: string; label: string; icon: Topic; text: string; href: string };
function topicRows(items: Item[], plain: Map<string, Plain>, island: Exclude<Island, "state">, now: number, stormTexts: string[], tsunamiAbove: boolean): Row[] {
  const of = (f: (i: Item) => boolean) => items.filter((i) => i.tier !== "community" && f(i));
  const roads = of((i) => i.type === "road_closure" && i.source !== "hdot");
  const traffic = of((i) => i.type === "traffic");
  const roadwork = of((i) => i.source === "hdot").length;
  const community = items.filter((i) => i.tier === "community");
  const quakes = of((i) => i.type === "quake");
  const volcano = of((i) => i.type === "volcano");
  const tsunami = of((i) => i.type === "tsunami");

  let roadsText = "No crashes or closures reported.";
  if (roads.length || traffic.length) {
    const first = plain.get((roads[0] ?? traffic[0]).key)!.headline;
    const more = roads.length + traffic.length - 1;
    roadsText = `${first}.${more ? ` ${more} more.` : ""}`;
  } else if (roadwork) roadsText = `No crashes or closures reported. ${plural(roadwork, "roadwork site")} today.`;

  let quakeText = "Nothing big enough to feel this week.";
  const biggest = quakes.reduce<Item | undefined>((a, b) => (!a || Number(b.fields?.mag) > Number(a.fields?.mag) ? b : a), undefined);
  const mag = Number(biggest?.fields?.mag) || 0;
  if (biggest && mag >= 3) {
    const where = /\bof\s+([^,]+)/.exec(biggest.title)?.[1]?.trim() ?? "here";
    quakeText = `A ${mag.toFixed(1)} near ${where} ${shakingVerb(mag)} ${fmtClock(biggest.issuedAt, now)}. No tsunami.`;
  } else if (quakes.length >= 5) quakeText = `Nothing big enough to feel this week. ${quakes.length} small ones, which is normal for Kīlauea.`;

  const volcanoText = volcano.length ? volcano.map((v) => plain.get(v.key)!.headline).join(". ") + "." : "Kīlauea is quiet.";
  const tsunamiText = tsunamiAbove ? "See the warning above." : tsunami.some((t) => plain.get(t.key)!.level >= 3) ? plain.get(tsunami[0].key)!.headline : "No danger.";
  const neighborsText = community.length ? `${plural(community.length, "report")} today. Latest: ${plain.get(community[0].key)!.headline}.` : "Nothing reported today.";

  const rows: Row[] = [
    { key: "roads", label: "Roads", icon: "road", text: roadsText, href: "/traffic/" },
    { key: "storms", label: "Storms", icon: "storm", text: stormTexts.length ? stormTexts.join(" ") : "None near Hawaiʻi.", href: "/storms/" },
    { key: "quakes", label: "Earthquakes", icon: "quake", text: quakeText, href: "/quakes/" },
    { key: "volcano", label: "Volcano", icon: "volcano", text: volcanoText, href: "/volcano/" },
    { key: "tsunami", label: "Tsunami", icon: "tsunami", text: tsunamiText, href: "/tsunami/" },
  ];
  if (island === "hawaii") rows.push({ key: "neighbors", label: "Neighbors", icon: "neighbors", text: neighborsText, href: "/report/" });
  return rows;
}

/** The weather picture: big icon, temperature, feels like, high/low, one sentence. Whole thing opens Weather. */
function WeatherNow({ island }: { island: Exclude<Island, "state"> }) {
  const w = useJson<Weather>(`v1/${island}/weather.json`);
  const townId = useSyncExternalStore(() => () => {}, () => localStorage.getItem("town"), () => null);
  const town = w?.data?.towns.find((t) => t.id === townId) ?? w?.data?.towns[0];
  const meta = TOWNS.find((t) => t.id === town?.id);
  if (!w) return <p className="mt-s2 text-body text-ink-2">Loading the weather…</p>;
  if (!town?.hourly) return <p className="mt-s2 text-body text-ink-2">Weather is not available right now.</p>;
  const h = town.hourly;
  const obsFresh = town.obs && w.fetchedAt - town.obs.at < 2 * 3_600_000;
  const code = h.c[0], night = !!h.n[0];
  const temp = (obsFresh ? town.obs?.f : undefined) ?? h.t[0];
  const fl = obsFresh && town.obs?.f != null && town.obs.rh != null ? feelsLike(town.obs.f, town.obs.rh) : undefined;
  const hi = town.fc.find((p) => p.day)?.t, lo = town.fc.find((p) => !p.day)?.t;
  const d0 = Math.floor((w.fetchedAt - 10 * 3_600_000) / 86_400_000) * 86_400_000 + 10 * 3_600_000; // HST midnight
  const sun = meta ? sunTimes(d0, meta.lat, meta.lon) : undefined;
  const nextSun = sun ? (sun.rise > w.fetchedAt ? { k: "Sunrise", at: sun.rise } : sun.set > w.fetchedAt ? { k: "Sunset", at: sun.set } : undefined) : undefined;
  return (
    <Link href="/weather/" className="mt-s3 block">
      <div className="flex items-center gap-s4">
        <ConditionIcon code={code} night={night} size={88} />
        <div className="min-w-0">
          <p className="text-number font-semibold text-ink num">{temp != null ? `${temp}°` : "—"}</p>
          <p className="text-body text-ink-2 num">{fl != null && Math.abs(fl - (temp ?? fl)) >= 3 ? `Feels like ${fl}°. ` : ""}{hi != null && lo != null ? `High ${hi}°, low ${lo}°.` : ""}</p>
          <p className="text-body font-semibold text-ink">{town.name} · {condWord(code)}</p>
        </div>
      </div>
      <p className="mt-s3 max-w-[36rem] text-body text-ink-2">{weatherSentence(h)}{nextSun ? ` ${nextSun.k} at ${fmtTime(nextSun.at)}.` : ""}</p>
    </Link>
  );
}
