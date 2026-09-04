"use client";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import AlertsCard from "@/components/AlertsCard";
import Freshness from "@/components/Freshness";
import SectionNav from "@/components/SectionNav";
import TopBar from "@/components/TopBar";
import StormMap from "@/components/StormMap";
import ConditionIcon from "@/components/ConditionIcon";
import Onboarding from "@/components/Onboarding";
import Ask from "@/components/Ask";
import type { DigestItem, Island, Item } from "@/lib/types";
import { ISLANDS, hashOf } from "@/lib/types";
import type { StormsSnapshot } from "@/lib/storm";
import { ISLAND_POINTS } from "@/lib/storm";
import type { Quakes, Weather } from "@/lib/pages";
import { useFeed, useIslandChosen, useJson, useStoredIsland } from "@/lib/data";
import { condWord, conditionCode, feelsLike, nowAndLater, sunTimes } from "@/lib/summary";
import { TOWNS } from "@/lib/towns";
import { plainAlert, quakeSentence, rankStorms, stormName, type Plain } from "@/lib/plain";
import { nowStory, topicRows } from "@/lib/now";
import { buildFeed, dropSuperseded, foldRuns, pinned, type FeedRow as FeedRowT } from "@/lib/feed";
import MiniMap from "@/components/MiniMap";
import { fmtTime, islandName } from "@/lib/brand";

/** A pushed digest item rendered like any other row when the phone has no newer snapshot. */
const fromDigest = (d: DigestItem, at: number): Item => ({
  ...d, source: "digest", tier: "official", islands: [], lastConfirmedAt: at, hash: "",
});

/** A notification deep link lands on a card: put it on screen. */
function useFocusScroll(key: string | undefined, focus?: boolean) {
  useEffect(() => { if (focus && key) document.getElementById(`item-${hashOf(key)}`)?.scrollIntoView({ block: "center" }); }, [focus, key]);
}

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

  const items = useMemo(() => {
    // The agencies reissue rather than edit, so the same warning arrives twice under a new id.
    // Drop what has been replaced before anything downstream — the pin, the feed and ʻIo all read this.
    const base = dropSuperseded(snap?.data?.items ?? []);
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
  /* Two homes, split by what you do with the thing, because everything below level 3 used to have
     neither. ACT_ON is a hazard that changes today: it gets a Heads up note and can raise the headline.
     Everything else official — agency notices, the Governor's storm proclamation, police releases — was
     parsed, given plain wording and then rendered on no screen in the app at all. It gets one card.
     Severity leads the sort: with a funnel this wide, recency alone lets a press release outrank a watch. */
  const ACT_ON: Item["type"][] = ["advisory", "storm", "outage", "tsunami", "hazard", "school"];
  const bySeverity = (a: Item, b: Item) => b.sev - a.sev || b.issuedAt - a.issuedAt;
  const headsUp = official.filter((i) => plain.get(i.key)!.level === 2 && ACT_ON.includes(i.type)).sort(bySeverity);

  const storms = stormsSnap?.data?.storms ?? [];
  const place = ISLAND_POINTS[island];
  const stormLines = rankStorms(storms, place);
  const coming = stormLines.filter((x) => x.approaching);
  const mainStorm = coming[0];
  const approaching = !!mainStorm;
  const mainStormItem = mainStorm ? official.find((i) => i.type === "storm") : undefined;
  /* The storm hero stands in for the lead warning only when it is at least as urgent. Keying this on
     `approaching` alone deleted the island's worst warning from the page outright — no card, no row, no
     hero — whenever any storm was in the basin, including level-1 ones the app itself calls too early to know. */
  const leadPlain = lead ? plain.get(lead.key)! : undefined;
  const stormCovered = !!(mainStorm && lead && leadPlain && (lead.type === "storm" || lead.type === "advisory") && mainStorm.level >= leadPlain.level);

  /* Every live storm is named, not just the one in the hero: the row used to drop every storm that was not
     approaching the moment one was, so a second hurricane in the basin appeared nowhere on the page. */
  const stormTexts = stormsSnap && !stormsSnap.data ? undefined : stormLines.map((x) => x.short);
  const rows = topicRows(items, plain, island, now, stormTexts, !!(lead && lead.type === "tsunami"), quakesFile?.data ? quakeSentence(quakesFile.data, now) : undefined);
  const roads = rows.find((r) => r.key === "roads")!;
  // No lead warning and no storm hero? The headline is still allowed to name the worst watch.
  const nextPlain = !lead && !mainStorm && headsUp[0] ? plain.get(headsUp[0].key) : undefined;
  /* ʻIo searches exactly what this page is rendering: same items, same wording, same storm lines. */
  const askCtx = { items, plain, storms: stormsSnap?.data ? stormLines.map((x) => ({ name: x.s.name, short: x.short })) : undefined };
  /* The feed: everything that is not pinned, banded by how much it should change what you do.
     A topic summary is not a row — Lowell and Karina are two rows, not one "Storms" card. */
  const pinAll = pinned(items, plain);
  const headlineItem = lead ?? (nextPlain ? headsUp[0] : undefined);
  const pinRows = pinAll.filter((i) => i !== headlineItem && i !== mainStormItem);
  const bands = buildFeed({ items, plain, now, storms: stormLines, island });
  const story = nowStory({ storm: mainStorm, roads, shelterPlain: shelters[0] ? plain.get(shelters[0].key) : undefined, leadPlain: stormCovered ? undefined : leadPlain, nextPlain, island: islandName(island) });


  return (
    <main className="hm relative z-[1] min-h-dvh w-full">
      <div className="mx-auto w-full max-w-2xl px-5 pb-32 md:pb-20">
        <TopBar island={island} onIsland={setIsland} />
        <SectionNav />
        <Freshness gen={gen} checkedAt={now} offline={offline} weak={mode === "low" && !offline} />

        <div className="hm-col">
          {loaded && (
            /* The page's one emphasised block: amber ground only when the day has something to act on. */
            <section className={`cs-card cs-hero ${lead || nextPlain || mainStorm ? "cs-hero--warn" : ""}`}>
              <h1 className="cs-display cs-display--hero">{story.title}</h1>
              {story.sub && <p className="cs-body cs-body--hero">{story.sub}</p>}
              {pinRows.length > 0 && (
                <div className="fd-pin-rows">
                  {pinRows.map((i) => {
                    const p = plain.get(i.key)!;
                    return (
                      <div key={i.key} id={`item-${hashOf(i.key)}`} className="fd-pin-row">
                        <p className="fd-pin-head">{p.headline}{p.headline.endsWith(".") ? "" : "."}</p>
                        {p.action && <p className="fd-pin-sub">{p.action}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {loaded && <Ask island={island} ctx={askCtx} now={now} />}

          {approaching && mainStorm && (
            <Link href="/storms/" className="cs-card cs-hero cs-hero--amber" aria-label={mainStorm.text}>
              <div className="cs-heroline">
                <span className="cs-ictile cs-ictile--amber"><Icon name="wind" size={21} className="cs-ic" /></span>
                <div className="hm-heromain">
                  <p className="cs-label">{/\b(Sat|Sun)\b/.test(mainStorm.text) ? "Storm this weekend" : "Storm"}</p>
                  {/* non-breaking hyphen: never "Two-" / "C" */}
                  <h2 className="cs-display cs-display--hero">{stormName(mainStorm.s).replace(/-/g, "\u2011")}</h2>
                </div>
              </div>
              <p className="cs-body cs-body--hero">{mainStorm.text}</p>
              {mainStorm.level >= 3 && <p className="cs-note"><Icon name="warning" size={18} />Finish getting ready. Follow Civil Defense.</p>}
              <div className="cs-figure hm-figure"><StormMap storm={mainStorm.s} place={place} compact /></div>
            </Link>
          )}

          {mode === "low" || offline
            ? <p className="cs-card cs-body hm-flat">Weather loads when the signal is better.</p>
            : <WeatherNow island={island} />}

          {/* Weak signal: the 1.5 KB essentials arrived but the 30 KB snapshot has not. Show the
              headlines we do have rather than an empty page — this is the path the app exists for. */}
          {headlinesOnly.length > 0 && (
            <section className="cs-card" aria-label="Just in">
              <p className="cs-label fd-band">Just in</p>
              {headlinesOnly.map((a) => (
                <div key={a.h} className="fd-row">
                  <span className="fd-main">
                    <span className="fd-head">{a.title}</span>
                    <span className="fd-sub">Details load when the signal is better.</span>
                  </span>
                </div>
              ))}
            </section>
          )}

          {bands.map((b) => {
            const { rows, folded } = foldRuns(b.rows);
            return (
              <section key={b.key} className="cs-card" aria-label={b.label}>
                <p className="cs-label fd-band">{b.label}</p>
                {rows.map((r) => <FeedRow key={r.key} row={r} island={island} focus={r.key === focusKey} />)}
                {Object.entries(folded).map(([topic, n]) => (
                  <Link key={topic} href={HREF[topic] ?? "/"} className={`fd-more t-${topic}`}>
                    <span>{n} more {MORE_WORD[topic] ?? "of these"}</span>
                    <Icon name="caret-right" size={15} className="cs-ic" />
                  </Link>
                ))}
              </section>
            );
          })}

          {!loaded && !offline && <p className="cs-body hm-flat">Loading what is happening around {islandName(island)}…</p>}

          <div className="cs-card"><AlertsCard island={island} compact /></div>
        </div>

        <Link href="/sources/" className="row mt-s5 border-t border-line text-small font-semibold text-ink-2">
          <Icon name="gear" size={18} /> <span className="flex-1">Settings and about</span> <Icon name="caret-right" size={16} />
        </Link>
        <footer className="cs-footer mt-s4">
          Free. No ads. No account. Not an emergency service — call 911.
        </footer>
      </div>
    </main>
  );
}

/** Where a folded run sends you, and what to call the things it folded. */
const HREF: Record<string, string> = {
  roads: "/traffic/", storms: "/storms/", quakes: "/quakes/",
  volcano: "/volcano/", tsunami: "/tsunami/", weather: "/weather/", reports: "/report/",
};
const MORE_WORD: Record<string, string> = {
  roads: "road closures", storms: "storms", quakes: "earthquakes",
  volcano: "volcano notices", tsunami: "ocean notices", weather: "weather notices", reports: "notices",
};

/**
 * One row of the feed: the sentence, then who said it and when, and a picture of where —
 * but only when the thing has a real position. A notice has no map, and inventing one
 * would say the app knows something it does not.
 */
function FeedRow({ row, island, focus }: { row: FeedRowT; island: Exclude<Island, "state">; focus?: boolean }) {
  useFocusScroll(row.key, focus);
  return (
    <Link href={row.href} id={`item-${hashOf(row.key)}`} className={`fd-row t-${row.topic}`}>
      <span className="fd-main">
        <span className="fd-head">{row.headline}</span>
        {row.sub && <span className="fd-sub">{row.sub}</span>}
        <span className="fd-meta"><span className="fd-dot" />{[row.source, row.when].filter(Boolean).join(" \u00b7 ")}</span>
      </span>
      {row.mark && <span className="fd-thumb"><MiniMap island={island} mark={row.mark} /></span>}
    </Link>
  );
}

/** Weather as an ordinary card — never the page hero, never a tinted wash. */
function WeatherNow({ island }: { island: Exclude<Island, "state"> }) {
  const w = useJson<Weather>(`v1/${island}/weather.json`);
  const townId = useSyncExternalStore(() => () => {}, () => localStorage.getItem("town"), () => null);
  const town = w?.data?.towns.find((t) => t.id === townId) ?? w?.data?.towns[0];
  const meta = TOWNS.find((t) => t.id === town?.id);
  if (!w) return <p className="cs-card cs-body hm-flat">Loading the weather…</p>;
  if (!town?.hourly) return <p className="cs-card cs-body hm-flat">Weather is not available right now.</p>;
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
    <Link href="/weather/" className="cs-card t-weather" aria-label={`${tempLabel} · ${condWord(code)} in ${town.name}`}>
      <p className="cs-label">Weather in {town.name}</p>
      <div className="cs-wx-row">
        <div className="min-w-0">
          <p className="cs-bignum cs-bignum--lg">{tempLabel}</p>
          <p className="cs-wx-now">
            {condWord(code)}
            {fl != null && Math.abs(fl - (temp ?? fl)) >= 3 ? `. Feels like ${fl}°` : ""}
            {hi != null && lo != null ? `. High ${hi}°, low ${lo}°` : ""}.
          </p>
        </div>
        <ConditionIcon code={code} night={night} size={72} className="cs-wx-ic" />
      </div>
      <p className="cs-wx-later">
        {nowAndLater(obsFresh ? code : undefined, h)}
        {nextSun ? ` ${nextSun.k} at ${fmtTime(nextSun.at)}.` : ""}
      </p>
    </Link>
  );
}
