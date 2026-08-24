"use client";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Icon, { type IconName } from "@/components/Icon";
import ItemRow from "@/components/ItemRow";
import AlertsCard from "@/components/AlertsCard";
import Freshness from "@/components/Freshness";
import SectionNav from "@/components/SectionNav";
import TopBar from "@/components/TopBar";
import StormMap from "@/components/StormMap";
import ConditionIcon from "@/components/ConditionIcon";
import Onboarding from "@/components/Onboarding";
import type { DigestItem, Island, Item } from "@/lib/types";
import { ISLANDS, hashOf } from "@/lib/types";
import type { StormsSnapshot } from "@/lib/storm";
import { ISLAND_POINTS } from "@/lib/storm";
import type { Quakes, Weather } from "@/lib/pages";
import { useFeed, useIslandChosen, useJson, useStoredIsland } from "@/lib/data";
import { condWord, conditionCode, feelsLike, nowAndLater, sunTimes } from "@/lib/summary";
import { TOWNS } from "@/lib/towns";
import { LEVEL_WORD, plainAlert, quakeSentence, rankStorms, staleLine, stormName, type Plain, type StormLine } from "@/lib/plain";
import { fmtClock, fmtTime, islandName } from "@/lib/brand";

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

/** First run, for someone who arrived from a neighbor's link: a few screens, one idea each, then Now. */
function FirstRun({ onPick }: { onPick: (i: Island) => void }) {
  return <Onboarding onDone={onPick} />;
}

function Now({ island, setIsland, focusKey }: { island: Exclude<Island, "state">; setIsland: (i: Island) => void; focusKey: string | null }) {
  const { ess, snap, digest, mode } = useFeed(island);
  const stormsSnap = useJson<StormsSnapshot>("v1/storms.json");
  const quakesFile = useJson<Quakes>("v1/quakes.json");
  const now = ess?.fetchedAt || snap?.fetchedAt || 0;
  const gen = Math.max(ess?.data?.gen ?? 0, snap?.data?.gen ?? 0);
  const offline = !!ess?.offline && !!snap?.offline;
  const loaded = !!(snap?.data || ess?.data);
  const [showAll, setShowAll] = useState(false);

  const items = useMemo(() => {
    const base = snap?.data?.items ?? [];
    if (digest && digest.island === island && digest.gen > (snap?.data?.gen ?? 0)) {
      const have = new Set(base.map((i) => i.key));
      return [...digest.top.filter((d) => !have.has(d.key)).map((d) => fromDigest(d, digest.gen)), ...base].sort((a, b) => b.sev - a.sev || b.issuedAt - a.issuedAt);
    }
    return base;
  }, [snap, digest, island]);
  const headlinesOnly = useMemo(() => (ess?.data && ess.data.gen > (snap?.data?.gen ?? 0) ? ess.data.alerts.filter((a) => !items.some((i) => i.key && hashOf(i.key) === a.h)) : []), [ess, snap, items]);

  const plain = useMemo(() => new Map(items.map((i) => [i.key, plainAlert(i, now, island)] as [string, Plain])), [items, now, island]);
  const official = items.filter((i) => i.tier !== "community");
  const warnings = official.filter((i) => plain.get(i.key)!.level >= 3).sort((a, b) => plain.get(b.key)!.level - plain.get(a.key)!.level || b.issuedAt - a.issuedAt);
  const lead = warnings.find((i) => i.type !== "shelter");
  const shelters = official.filter((i) => i.type === "shelter" && plain.get(i.key)!.level >= 2);
  const rest = warnings.filter((i) => i !== lead && i.type !== "shelter");
  const extraWarnings = showAll || (focusKey && rest.some((i) => i.key === focusKey)) ? rest : rest.slice(0, 2);
  const headsUp = official.filter((i) => (i.type === "advisory" || i.type === "storm" || i.type === "outage") && plain.get(i.key)!.level === 2);

  const storms = stormsSnap?.data?.storms ?? [];
  const place = ISLAND_POINTS[island];
  const stormLines = rankStorms(storms, place);
  const coming = stormLines.filter((x) => x.approaching);
  const mainStorm = coming[0];
  const approaching = !!mainStorm;
  const stormCovered = approaching && lead && (lead.type === "storm" || lead.type === "advisory");

  const rows = topicRows(items, plain, island, now, (coming.length ? coming : stormLines).map((x) => x.short), !!(lead && lead.type === "tsunami"), approaching, quakesFile?.data ? quakeSentence(quakesFile.data, now) : undefined);
  const roads = rows.find((r) => r.key === "roads")!;
  const alsoToday = rows.filter((r) => r.quiet);
  const story = nowStory({ storm: mainStorm, roads, shelterPlain: shelters[0] ? plain.get(shelters[0].key) : undefined, leadPlain: lead && !stormCovered ? plain.get(lead.key) : undefined, island: islandName(island) });

  return (
    <main className="now-island relative z-[1] min-h-dvh w-full">
      <div className="mx-auto w-full max-w-2xl px-5 pb-32 md:pb-20">
        <TopBar island={island} onIsland={setIsland} quiet />
        <SectionNav />
        <Freshness gen={gen} checkedAt={now} offline={offline} weak={mode === "low" && !offline} />

        {loaded && (
          <>
            <h1 className="isl-story">{story.title}</h1>
            {story.sub && <p className="isl-sub">{story.sub}</p>}
          </>
        )}

        <div className="isl-stack">
          {lead && !(approaching && (lead.type === "storm" || lead.type === "advisory")) && (
            <ItemCard tone="hot" icon={lead.type === "tsunami" ? "waves" : lead.type === "shelter" ? "tent" : lead.type === "outage" ? (lead.fields?.kind ? "drop" : "lightning-slash") : "wind"} kicker={plain.get(lead.key)!.word ?? LEVEL_WORD[plain.get(lead.key)!.level] ?? "Get ready"} title={plain.get(lead.key)!.headline} item={lead} now={now} focus={lead.key === focusKey}>
              {plain.get(lead.key)!.action && <p className="isl-p">{plain.get(lead.key)!.action}</p>}
              {staleLine(lead, now) && <p className="isl-note">{staleLine(lead, now)}</p>}
              {(extraWarnings.length > 0 || headlinesOnly.length > 0) && (
                <ul className="mt-s3 divide-y divide-line">
                  {headlinesOnly.map((a) => <li key={a.h} className="py-s3 text-body font-semibold">{a.title}<span className="block text-small font-normal text-ink-2">Details load when the signal is better.</span></li>)}
                  {extraWarnings.map((i) => <ItemRow key={i.key} item={i} now={now} focus={i.key === focusKey} />)}
                </ul>
              )}
              {rest.length > 2 && !showAll && <button className="btn mt-s3" onClick={() => setShowAll(true)}>All warnings ({rest.length}) <Icon name="caret-right" className="size-4" aria-hidden /></button>}
            </ItemCard>
          )}

          {approaching && mainStorm && (
            <Link href="/storms/" className="isl-card isl-storm" aria-label={mainStorm.text}>
              <p className="isl-kicker"><span className="isl-bubble"><Icon name="wind" aria-hidden /></span>{/Saturday|Sunday/i.test(mainStorm.text) ? "Storm this weekend" : "Storm"}</p>
              <h2 className="isl-h">{stormName(mainStorm.s).replace(/-/g, "\u2011")}</h2>{/* non-breaking hyphen: never "Two-" / "C" */}
              <p className="isl-p">{mainStorm.text}</p>
              {mainStorm.level >= 3 && <p className="isl-note" style={{ color: "var(--now-sky)", borderColor: "color-mix(in srgb, var(--now-sky) 25%, transparent)" }}>Finish getting ready. Follow Civil Defense.</p>}
              <div className="isl-map"><StormMap storm={mainStorm.s} place={place} compact /></div>
            </Link>
          )}

          {(!lead || (approaching && (lead.type === "storm" || lead.type === "advisory"))) && (headlinesOnly.length > 0 || extraWarnings.length > 0) && (
            <article className="isl-card">
              <p className="isl-kicker" style={{ color: "var(--ink-2)" }}>Also in effect</p>
              <ul className="mt-s2 divide-y divide-line">
                {headlinesOnly.map((a) => <li key={a.h} className="py-s3 text-body font-semibold">{a.title}<span className="block text-small font-normal text-ink-2">Details load when the signal is better.</span></li>)}
                {extraWarnings.map((i) => <ItemRow key={i.key} item={i} now={now} focus={i.key === focusKey} />)}
              </ul>
              {rest.length > 2 && !showAll && <button className="btn mt-s3" onClick={() => setShowAll(true)}>All warnings ({rest.length}) <Icon name="caret-right" className="size-4" aria-hidden /></button>}
            </article>
          )}

          {shelters.map((i) => {
            const p = plain.get(i.key)!;
            return (
              <ItemCard key={i.key} tone="hot" icon="tent" kicker={p.word ?? "Shelter open"} title={p.headline} item={i} now={now} focus={i.key === focusKey}>
                {p.action && <p className="isl-p">{p.action}</p>}
                {staleLine(i, now) && <p className="isl-note">{staleLine(i, now)}</p>}
              </ItemCard>
            );
          })}

          {!roads.quiet && (
            <Link href="/traffic/" className="isl-card isl-road">
              <p className="isl-kicker"><span className="isl-bubble"><Icon name="traffic-cone" aria-hidden /></span> Roads</p>
              <h2 className="isl-h">{roads.text.replace(/\s+\d+ more\.$/, "")}</h2>
              <p className="isl-p">Tap for the map and detours.</p>
              {/\d+ more/.test(roads.text) && <p className="isl-more">{roads.text.match(/(\d+ more)\.?$/)?.[1]}</p>}
            </Link>
          )}

          {mode === "low" || offline
            ? <p className="isl-card text-ink-2">Weather loads when the signal is better.</p>
            : <WeatherNow island={island} />}

          {headsUp.map((i) => {
            const p = plain.get(i.key)!;
            return <p key={i.key} className="isl-p px-1"><span className="font-semibold">Heads up:</span> {p.headline}. <span className="text-ink-2">{p.action}</span></p>;
          })}

          {loaded && alsoToday.length > 0 && (
            <section className="isl-card" aria-label="Also today">
              <p className="isl-kicker" style={{ color: "var(--ink-2)" }}>Also today</p>
              <div className="isl-grid">
                {alsoToday.map((r) => {
                  const glyph = MINI_ICON[r.key] ?? "cloud-sun";
                  return (
                    <Link key={r.key} href={r.href} className="isl-mini">
                      <span className="isl-bubble"><Icon name={`${glyph}-fill`} size={20} /></span>
                      <h3>{r.label}</h3>
                      <p>{r.text}</p>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {!loaded && !offline && <p className="text-body text-ink-2">Loading what is happening around {islandName(island)}…</p>}

          <AlertsCard island={island} compact />
        </div>

        <Link href="/sources/" className="row mt-s5 border-t border-line text-small font-semibold text-ink-2">
          <Icon name="gear" size={18} /> <span className="flex-1">Settings and about</span> <Icon name="caret-right" size={16} />
        </Link>
        <footer className="mt-s4 pb-s4 text-small leading-relaxed text-ink-2">
          Free. No ads. No account. Not an emergency service — call 911.
        </footer>
      </div>
    </main>
  );
}

const MINI_ICON: Record<string, IconName> = {
  storms: "wind", quakes: "pulse", volcano: "mountains", tsunami: "waves", neighbors: "users-three", roads: "traffic-cone",
};

type Row = { key: string; label: string; text: string; href: string; quiet: boolean };

function ItemCard({ tone, icon, kicker, title, children, item, focus }: {
  tone: "hot" | "storm" | "road" | "wx";
  icon: IconName;
  kicker: string;
  title: string;
  children?: React.ReactNode;
  item?: Item;
  now?: number;
  focus?: boolean;
}) {
  const extra = item ? officialExtra(item, title) : undefined;
  useEffect(() => { if (focus && item) document.getElementById(`item-${hashOf(item.key)}`)?.scrollIntoView({ block: "center" }); }, [focus, item]);
  return (
    <article id={item ? `item-${hashOf(item.key)}` : undefined} className={`isl-card isl-${tone}`} aria-label={title}>
      <p className="isl-kicker"><span className="isl-bubble"><Icon name={`${icon}-fill`} size={20} /></span> {kicker}</p>
      <h2 className="isl-h">{title}</h2>
      {children}
      {extra && <p className="isl-p text-ink-2">{extra}</p>}
    </article>
  );
}

function nowStory({ storm, roads, shelterPlain, leadPlain, island }: {
  storm?: StormLine;
  roads: Row;
  shelterPlain?: Plain;
  leadPlain?: Plain;
  island: string;
}): { title: string; sub: string } {
  const extra = [
    !roads.quiet ? roads.text.replace(/\s+\d+ more\.$/, "") : "",
    shelterPlain?.headline ?? "",
  ].filter(Boolean).join(" ");
  if (storm) {
    const weekend = /Saturday|Sunday/i.test(storm.text);
    return { title: weekend ? "A storm is coming this weekend." : `${storm.s.name} is headed this way.`, sub: extra || storm.text };
  }
  if (leadPlain) return { title: leadPlain.headline + (leadPlain.headline.endsWith(".") ? "" : "."), sub: extra || leadPlain.action };
  if (shelterPlain) return { title: shelterPlain.headline + (shelterPlain.headline.endsWith(".") ? "" : "."), sub: extra && extra !== shelterPlain.headline ? extra : (shelterPlain.action || "") };
  if (!roads.quiet) return { title: roads.text.replace(/\s+\d+ more\.$/, ""), sub: "The rest of the island looks ordinary." };
  return { title: `Here's what's on ${island} today.`, sub: "Nothing urgent. Roads and weather are below." };
}

function officialExtra(item: Item, headline: string): string | undefined {
  const body = item.body?.trim();
  if (body && !headline.includes(body.slice(0, 40))) return body;
  const title = item.title?.trim();
  if (title && title !== headline && !headline.includes(title) && !title.includes(headline.slice(0, 24))) return title;
  return undefined;
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

  const volcanoQuiet = volcano.length === 0;
  const volcanoText = volcanoQuiet ? "Kīlauea is taking a rest." : volcano.map((v) => plain.get(v.key)!.headline).join(". ") + ".";
  const tsunamiHot = tsunami.some((t) => plain.get(t.key)!.level >= 3);
  const tsunamiText = tsunamiAbove ? "See the warning above." : tsunamiHot ? plain.get(tsunami[0].key)!.headline : "The ocean is fine.";
  const neighborsText = community.length ? `${plural(community.length, "report")} today. Latest: ${plain.get(community[0].key)!.headline}.` : "Nobody posted today.";

  const quakeQuiet = quakeText.startsWith("Nothing big") || (!/\b\d\.\d\b/.test(quakeText) && !/shook|felt/i.test(quakeText));

  const rows: Row[] = [
    { key: "roads", label: "Roads", text: roadsText, href: "/traffic/", quiet: !(roads.length || traffic.length) },
    { key: "storms", label: "Storms", text: stormTexts.length ? stormTexts.join(" ") : "None near Hawaiʻi.", href: "/storms/", quiet: !approachingStorm },
    { key: "quakes", label: "Earthquakes", text: quakeText, href: "/quakes/", quiet: quakeQuiet },
    { key: "volcano", label: "Volcano", text: volcanoText, href: "/volcano/", quiet: volcanoQuiet },
    { key: "tsunami", label: "Tsunami", text: tsunamiText, href: "/tsunami/", quiet: !tsunamiHot && !tsunamiAbove },
  ];
  if (island === "hawaii") {
    rows.push({ key: "neighbors", label: "Reports", text: neighborsText, href: "/report/", quiet: community.length === 0 });
  }
  return rows;
}

/** Weather as an ordinary sand card — never the page hero, never a tinted wash. */
function WeatherNow({ island }: { island: Exclude<Island, "state"> }) {
  const w = useJson<Weather>(`v1/${island}/weather.json`);
  const townId = useSyncExternalStore(() => () => {}, () => localStorage.getItem("town"), () => null);
  const town = w?.data?.towns.find((t) => t.id === townId) ?? w?.data?.towns[0];
  const meta = TOWNS.find((t) => t.id === town?.id);
  if (!w) return <p className="isl-card text-ink-2">Loading the weather…</p>;
  if (!town?.hourly) return <p className="isl-card text-ink-2">Weather is not available right now.</p>;
  const h = town.hourly;
  const obsFresh = town.obs && w.fetchedAt - town.obs.at < 2 * 3_600_000;
  const code = obsFresh && town.obs?.sky ? conditionCode("", town.obs.sky) : h.c[0], night = !!h.n[0];
  const temp = (obsFresh ? town.obs?.f : undefined) ?? h.t[0];
  const fl = obsFresh && town.obs?.f != null && town.obs.rh != null ? feelsLike(town.obs.f, town.obs.rh) : undefined;
  const hi = town.fc.find((p) => p.day)?.t, lo = town.fc.find((p) => !p.day)?.t;
  const d0 = Math.floor((w.fetchedAt - 10 * 3_600_000) / 86_400_000) * 86_400_000 + 10 * 3_600_000;
  const sun = meta ? sunTimes(d0, meta.lat, meta.lon) : undefined;
  const nextSun = sun ? (sun.rise > w.fetchedAt ? { k: "Sunrise", at: sun.rise } : sun.set > w.fetchedAt ? { k: "Sunset", at: sun.set } : undefined) : undefined;
  const tempLabel = temp != null ? `${temp}°` : "—";
  return (
    <Link href="/weather/" className="isl-card isl-wx" aria-label={`${tempLabel} · ${condWord(code)} in ${town.name}`}>
      <p className="isl-kicker">Weather in {town.name}</p>
      <div className="isl-wx-row">
        <ConditionIcon code={code} night={night} size={72} />
        <div className="min-w-0">
          <p className="isl-deg">{tempLabel}</p>
          <p className="isl-p" style={{ marginTop: "0.15rem" }}>
            {condWord(code)}
            {fl != null && Math.abs(fl - (temp ?? fl)) >= 3 ? `. Feels like ${fl}°` : ""}
            {hi != null && lo != null ? `. High ${hi}°, low ${lo}°` : ""}.
          </p>
        </div>
      </div>
      <p className="isl-p text-ink-2">
        {nowAndLater(obsFresh ? code : undefined, h)}
        {nextSun ? ` ${nextSun.k} at ${fmtTime(nextSun.at)}.` : ""}
      </p>
    </Link>
  );
}
