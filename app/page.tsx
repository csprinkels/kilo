"use client";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
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
import type { Quakes, Weather } from "@/lib/pages";
import { useFeed, useIslandChosen, useJson, useStoredIsland } from "@/lib/data";
import { condWord, conditionCode, feelsLike, nowAndLater, sunTimes } from "@/lib/summary";
import { TOWNS } from "@/lib/towns";
import { plainAlert, quakeSentence, rankStorms, type Plain } from "@/lib/plain";
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
  // The same 7-day quake file the Earthquakes page reads, so the row and the page never disagree (5.7 KB).
  const quakesFile = useJson<Quakes>("v1/quakes.json");
  const now = ess?.fetchedAt || snap?.fetchedAt || 0;
  const gen = Math.max(ess?.data?.gen ?? 0, snap?.data?.gen ?? 0);
  const offline = !!ess?.offline && !!snap?.offline;
  const loaded = !!(snap?.data || ess?.data);
  const [showAll, setShowAll] = useState(false);
  const [showQuiet, setShowQuiet] = useState(false);

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
  // True urgent lead only — shelters are news, not the page hero.
  const lead = warnings.find((i) => i.type !== "shelter");
  const shelters = official.filter((i) => i.type === "shelter" && plain.get(i.key)!.level >= 2);
  const rest = warnings.filter((i) => i !== lead);
  // A deep link from a notification must never land behind "All warnings".
  const alsoRows = showAll || (focusKey && rest.some((i) => i.key === focusKey)) ? rest : rest.slice(0, 3);
  const headsUp = official.filter((i) => (i.type === "advisory" || i.type === "storm") && plain.get(i.key)!.level === 2);

  const storms = stormsSnap?.data?.storms ?? [];
  const place = ISLAND_POINTS[island];
  const stormLines = rankStorms(storms, place);
  const coming = stormLines.filter((x) => x.approaching);
  const mainStorm = coming[0];
  const approaching = !!mainStorm;

  // A storm that is moving away or staying far out never shares the row with one that is coming.
  const rows = topicRows(items, plain, island, now, (coming.length ? coming : stormLines).map((x) => x.short), !!(lead && lead.type === "tsunami"), approaching, quakesFile?.data ? quakeSentence(quakesFile.data, now) : undefined);
  const needsLook = rows.filter((r) => !r.quiet);
  const quietRows = rows.filter((r) => r.quiet);
  // Soft notices (shelters, leftover warnings when there is no hero alert) sit in Needs a look.
  const softNotices = lead ? [] : [...shelters, ...rest.filter((i) => i.type !== "shelter")];
  const focusInSoft = !!(focusKey && softNotices.some((i) => i.key === focusKey));
  const softShown = showAll || focusInSoft ? softNotices : softNotices.slice(0, 3);
  const hasAttention = needsLook.length > 0 || softNotices.length > 0 || headlinesOnly.length > 0;
  const headsUpLines = headsUp.map((i) => (
    <p key={i.key} className="mt-s3 text-body text-ink">
      <span className="font-semibold">Heads up:</span> {plain.get(i.key)!.headline}. <span className="text-ink-2">{plain.get(i.key)!.action}</span>
    </p>
  ));
  // One tinted card per page: the first soft notice; the rest are rows in a plain card.
  const [softLead, ...softRows] = softShown;

  return (
    <main className="relative z-[1] min-h-dvh w-full">
      <div className="mx-auto w-full max-w-2xl px-5 pb-32 md:pb-20">
        <TopBar island={island} onIsland={setIsland} quiet />
        <SectionNav />
        <Freshness gen={gen} checkedAt={now} offline={offline} weak={mode === "low" && !offline} />

        {/* One hero: true urgent alert replaces weather; otherwise weather leads. */}
        {lead ? (
          <div className="mt-s4">
            <AlertBlock item={lead} now={now} className="mt-0">
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
            {mode === "low" || offline
              ? <p className="mt-s3 text-body text-ink-2">Weather loads when the signal is better.</p>
              : <WeatherNow island={island} variant="compact" />}
          </div>
        ) : (
          <div className="mt-s4">
            {mode === "low" || offline
              ? <p className="text-body text-ink-2">Weather loads when the signal is better.</p>
              : <WeatherNow island={island} variant="hero">{headsUpLines}</WeatherNow>}
          </div>
        )}
        {lead && headsUpLines}

        {loaded && (
          <section className="mt-s6" aria-label={`Around ${islandName(island)}`}>
            {hasAttention && (
              <>
                <h2 className="now-label">Needs a look</h2>
                {softLead && <AlertBlock item={softLead} now={now} compact className="mt-s2" focus={softLead.key === focusKey} />}
                {(softRows.length > 0 || headlinesOnly.length > 0) && (
                  <ul className="list mt-s3">
                    {headlinesOnly.map((a) => (
                      <li key={a.h} className="py-s3 text-body font-semibold">
                        {a.title}
                        <span className="block text-small font-normal text-ink-2">Details load when the signal is better.</span>
                      </li>
                    ))}
                    {softRows.map((i) => <ItemRow key={i.key} item={i} now={now} focus={i.key === focusKey} />)}
                  </ul>
                )}
                {softNotices.length > 3 && !showAll && !focusInSoft && (
                  <button className="btn mt-s3" onClick={() => setShowAll(true)}>All notices ({softNotices.length}) <ChevronRight className="size-4" aria-hidden /></button>
                )}
                {needsLook.map((r) => (
                  <TopicCard key={r.key} row={r}>
                    {r.key === "storms" && mainStorm && (
                      <div className="-mx-5 -mb-5 mt-s4 border-t border-line"><StormMap storm={mainStorm.s} place={place} compact /></div>
                    )}
                  </TopicCard>
                ))}
              </>
            )}

            {quietRows.length > 0 && (
              <div className={`card bg-surface-2 p-0 shadow-none ${hasAttention ? "mt-s3" : ""}`}>
                <button type="button" className="flex min-h-15 w-full items-center gap-s3 px-5 py-s3 text-left" aria-expanded={showQuiet} onClick={() => setShowQuiet((v) => !v)}>
                  <Check className="size-6 shrink-0 text-brand" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-body font-semibold text-ink">{hasAttention ? "Everything else is quiet" : "All quiet around your island"}</span>
                    <span className="block text-small text-ink-2">{quietRows.map((r, i) => (i ? r.label.toLowerCase() : r.label)).join(", ")}</span>
                  </span>
                  <ChevronDown className={`size-5 shrink-0 text-ink-2 transition-transform ${showQuiet ? "rotate-180" : ""}`} aria-hidden />
                </button>
                {showQuiet && (
                  <ul className="divide-y divide-line border-t border-line">
                    {quietRows.map((r) => (
                      <li key={r.key}>
                        <Link href={r.href} className="row px-5">
                          <TopicIcon topic={r.icon} size={32} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-body font-semibold text-ink">{r.label}</span>
                            <span className="block text-body leading-snug text-ink-2">{r.text}</span>
                          </span>
                          <ChevronRight className="size-5 shrink-0 text-ink-2" aria-hidden />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        )}
        {!loaded && !offline && <p className="mt-s7 text-body text-ink-2">Loading what is happening around {islandName(island)}…</p>}

        <AlertsCard island={island} compact />

        <footer className="mt-s6 px-1 pb-s4 text-small leading-relaxed text-ink-2">
          Free. No ads. No account. Not an emergency service — call 911. <Link className="font-semibold text-brand" href="/sources/">How {APP_NAME} works</Link>
        </footer>
      </div>
    </main>
  );
}

type Row = { key: string; label: string; icon: Topic; text: string; href: string; quiet: boolean };

/** One topic, one card: illustrated icon · serif label · the whole sentence · chevron. The card is the link; a picture may sit under the text. */
function TopicCard({ row, children }: { row: Row; children?: React.ReactNode }) {
  return (
    <Link href={row.href} className="card mt-s3 block pr-10 @container">
      <ChevronRight className="absolute right-4 top-5 size-6 text-ink-2" aria-hidden />
      {/* On a 320px phone at the largest text size the icon moves above the title so "Earthquakes" never meets the chevron. */}
      <span className="flex items-start gap-s3 @max-[13.5rem]:flex-col">
        <TopicIcon topic={row.icon} size={40} />
        <span className="min-w-0 flex-1">
          <span className="h-title block">{row.label}</span>
          <span className="mt-s1 block text-body leading-snug text-ink-2">{row.text}</span>
        </span>
      </span>
      {children}
    </Link>
  );
}

function topicRows(
  items: Item[],
  plain: Map<string, Plain>,
  island: Exclude<Island, "state">,
  now: number,
  stormTexts: string[],
  tsunamiAbove: boolean,
  approachingStorm: boolean,
  quakeText?: string,
): Row[] {
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

  // Fallback when the quake file has not loaded: the island snapshot only keeps 3 days, so say less rather than wrong.
  if (!quakeText) {
    const biggest = quakes.reduce<Item | undefined>((a, b) => (!a || Number(b.fields?.mag) > Number(a.fields?.mag) ? b : a), undefined);
    const mag = Number(biggest?.fields?.mag) || 0;
    quakeText = biggest && mag >= 3 ? `A ${mag.toFixed(1)} near ${/\bof\s+([^,]+)/.exec(biggest.title)?.[1]?.trim() ?? "here"} ${fmtClock(biggest.issuedAt, now)}. No tsunami.` : "Nothing big in the last few days.";
  }

  const volcanoText = volcano.length ? volcano.map((v) => plain.get(v.key)!.headline).join(". ") + "." : "Kīlauea is quiet.";
  const tsunamiHot = tsunami.some((t) => plain.get(t.key)!.level >= 3);
  const tsunamiText = tsunamiAbove ? "See the warning above." : tsunamiHot ? plain.get(tsunami[0].key)!.headline : "No danger.";
  const neighborsText = community.length ? `${plural(community.length, "report")} today. Latest: ${plain.get(community[0].key)!.headline}.` : "Nothing reported today.";

  const quakeQuiet = quakeText.startsWith("Nothing big") || (!/\b\d\.\d\b/.test(quakeText) && !/shook|felt/i.test(quakeText));

  const rows: Row[] = [
    { key: "roads", label: "Roads", icon: "road", text: roadsText, href: "/traffic/", quiet: !(roads.length || traffic.length) },
    { key: "storms", label: "Storms", icon: "storm", text: stormTexts.length ? stormTexts.join(" ") : "None near Hawaiʻi.", href: "/storms/", quiet: !approachingStorm },
    { key: "quakes", label: "Earthquakes", icon: "quake", text: quakeText, href: "/quakes/", quiet: quakeQuiet },
    { key: "volcano", label: "Volcano", icon: "volcano", text: volcanoText, href: "/volcano/", quiet: volcanoText === "Kīlauea is quiet." },
    { key: "tsunami", label: "Tsunami", icon: "tsunami", text: tsunamiText, href: "/tsunami/", quiet: !tsunamiHot && !tsunamiAbove },
  ];
  if (island === "hawaii") {
    rows.push({ key: "neighbors", label: "Neighbors", icon: "neighbors", text: neighborsText, href: "/report/", quiet: community.length === 0 });
  }
  return rows;
}

/** Weather as the Acme hero, or one compact line under an urgent alert. */
function WeatherNow({ island, variant, children }: { island: Exclude<Island, "state">; variant: "hero" | "compact"; children?: React.ReactNode }) {
  const w = useJson<Weather>(`v1/${island}/weather.json`);
  const townId = useSyncExternalStore(() => () => {}, () => localStorage.getItem("town"), () => null);
  const town = w?.data?.towns.find((t) => t.id === townId) ?? w?.data?.towns[0];
  const meta = TOWNS.find((t) => t.id === town?.id);
  if (!w) return <p className="text-body text-ink-2">Loading the weather…</p>;
  if (!town?.hourly) return <p className="text-body text-ink-2">Weather is not available right now.</p>;
  const h = town.hourly;
  const obsFresh = town.obs && w.fetchedAt - town.obs.at < 2 * 3_600_000;
  const code = obsFresh && town.obs?.sky ? conditionCode("", town.obs.sky) : h.c[0], night = !!h.n[0];
  const temp = (obsFresh ? town.obs?.f : undefined) ?? h.t[0];
  const fl = obsFresh && town.obs?.f != null && town.obs.rh != null ? feelsLike(town.obs.f, town.obs.rh) : undefined;
  const hi = town.fc.find((p) => p.day)?.t, lo = town.fc.find((p) => !p.day)?.t;
  const d0 = Math.floor((w.fetchedAt - 10 * 3_600_000) / 86_400_000) * 86_400_000 + 10 * 3_600_000; // HST midnight
  const sun = meta ? sunTimes(d0, meta.lat, meta.lon) : undefined;
  const nextSun = sun ? (sun.rise > w.fetchedAt ? { k: "Sunrise", at: sun.rise } : sun.set > w.fetchedAt ? { k: "Sunset", at: sun.set } : undefined) : undefined;
  const tempLabel = temp != null ? `${temp}°` : "—";
  const line = `${tempLabel} · ${condWord(code)} in ${town.name}`;

  if (variant === "compact") {
    return (
      <Link href="/weather/" className="mt-s3 block text-body text-ink-2">
        <span className="font-semibold text-ink num">{tempLabel}</span>
        {" · "}{condWord(code)} in {town.name}
      </Link>
    );
  }

  return (
    <section className="card" aria-label={line}>
      <p className="text-small font-semibold text-ink-2">{town.name}</p>
      <div className="mt-s2 flex items-start gap-s4">
        <ConditionIcon code={code} night={night} size={88} />
        <div className="min-w-0 pt-s1">
          <p className="text-number font-semibold tracking-tight text-ink num">{tempLabel}</p>
          <p className="h-title mt-s1">{condWord(code)}</p>
          <p className="mt-s1 text-body text-ink-2 num">
            {fl != null && Math.abs(fl - (temp ?? fl)) >= 3 ? `Feels like ${fl}°. ` : ""}
            {hi != null && lo != null ? `High ${hi}°, low ${lo}°.` : ""}
          </p>
        </div>
      </div>
      <p className="mt-s4 border-t border-line pt-s4 text-body text-ink-2">
        {nowAndLater(obsFresh ? code : undefined, h)}
        {nextSun ? ` ${nextSun.k} at ${fmtTime(nextSun.at)}.` : ""}
      </p>
      {children}
    </section>
  );
}
