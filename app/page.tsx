"use client";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import EmptyState from "@/components/EmptyState";
import Link from "next/link";
import Icon, { type IconName } from "@/components/Icon";
import AlertsCard, { useAlertsDismissed } from "@/components/AlertsCard";
import Freshness from "@/components/Freshness";
import SectionNav from "@/components/SectionNav";
import TopBar from "@/components/TopBar";
import StormMap from "@/components/StormMap";
import ConditionIcon from "@/components/ConditionIcon";
import Onboarding from "@/components/Onboarding";
import Ask from "@/components/Ask";
import { ICON } from "@/components/ItemRow";
import type { DigestItem, Island, Item } from "@/lib/types";
import { ISLANDS, hashOf } from "@/lib/types";
import type { StormsSnapshot } from "@/lib/storm";
import { ISLAND_POINTS, ktToMph, outlookFor } from "@/lib/storm";
import type { Quakes, Weather } from "@/lib/pages";
import { useFeed, useIslandChosen, useJson, useStoredIsland } from "@/lib/data";
import { usePageFilter } from "@/components/PageFilter";
import { condWord, conditionCode, nowAndLater, sunTimes } from "@/lib/summary";
import { TOWNS } from "@/lib/towns";
import { plainAlert, quakeSentence, rankStorms, stormName, type Plain } from "@/lib/plain";
import { nowStory, topicRows } from "@/lib/now";
import { buildFeed, dropSuperseded, foldPins, foldRuns, hrefOf, type FeedRow as FeedRowT } from "@/lib/feed";
import MiniMap from "@/components/MiniMap";
import { fmtDayTime, fmtTime, islandName } from "@/lib/brand";

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
  const offline = !!ess?.offline && (snap?.offline ?? true);  // no cache at all: snap is null, not offline
  const loaded = !!(snap?.data || ess?.data);
  const [alertsDismissed] = useAlertsDismissed();

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
  const askCtx = { items, plain, storms: stormsSnap?.data ? stormLines.map((x) => ({ name: x.s.name, short: x.short, s: x.s })) : undefined };
  /* The feed: everything that is not pinned, banded by how much it should change what you do.
     A topic summary is not a row — Lowell and Karina are two rows, not one "Storms" card. */
  const headlineItem = lead ?? (nextPlain ? headsUp[0] : undefined);
  // A kind said once: the hero already carries the headline item, so a group it led drops it.
  const pinRows = foldPins(items.filter((i) => i !== headlineItem && i !== mainStormItem), plain, island, now);
  const bands = buildFeed({ items, plain, now, storms: stormLines, island });
  const story = nowStory({ storm: mainStorm, roads, shelterPlain: shelters[0] ? plain.get(shelters[0].key) : undefined, leadPlain: stormCovered ? undefined : leadPlain, nextPlain, island: islandName(island) });
  // The hero's foot counts the pins by level: what is a warning, what is only a heads up.
  const pinWarnings = pinRows.filter((g) => g.level >= 3).length, pinHeadsUp = pinRows.filter((g) => g.level === 2).length;
  // The storm card's facts: when the wind arrives here, the watch word the zones carry, the latest advisory.
  const outlook = mainStorm ? outlookFor(mainStorm.s, place) : undefined;
  const windsFrom = outlook?.hurricaneWindsFrom ?? outlook?.tsWindsFrom;
  // The watch word is the highest watch or warning the zones carry — never a statement.
  const watch = official.filter((i) => i.type === "storm" && /\b(Watch|Warning)\b/.test(i.fields?.event ?? "")).sort((a, b) => plain.get(b.key)!.level - plain.get(a.key)!.level)[0]?.fields?.event;

  /*
   * Now is the longest page in the app, and on a busy day the thing you opened it for is somewhere
   * below thirty rows. The chips cut the feed to one topic. A fixed order, filtered to what is
   * actually here — chips that reshuffled themselves every refresh would be worse than scrolling.
   *
   * The pinned hero, ʻIo, an approaching storm and the alerts card are all rendered outside this:
   * a filter hides topics, never the warning that made you open the app.
   */
  const present = new Set(bands.flatMap((b) => b.rows.map((r) => r.topic)));
  const weatherCard = !(mode === "low" || offline);
  if (weatherCard) present.add("weather");
  const { bar: chips, show } = usePageFilter(CHIP_ORDER.filter((t) => present.has(t)).map((t) => ({ id: t, label: CHIP_LABEL[t] })), { label: "Filter the feed", clearOn: story.title });

  return (
    <main className="relative z-[1] min-h-dvh w-full">
      <div className="mx-auto w-full max-w-2xl px-4 pb-32 md:pb-20">
        <TopBar island={island} onIsland={setIsland} />
        <SectionNav />
        <Freshness gen={gen} checkedAt={now} offline={offline} weak={mode === "low" && !offline} />

        <div className="cs-stack">
          {loaded && (
            /* The page's one raised ground: the warm hero only when the day has something to act on. */
            <section className={`cs-card cs-hero ${lead || nextPlain || mainStorm ? "cs-hero--warn" : ""}`} aria-label="What matters now">
              <h1 className="cs-display cs-display--hero">{story.title}</h1>
              {story.sub && <p className="cs-body cs-body--hero">{story.sub}</p>}
              {pinRows.length > 0 && (
                <>
                  {/* Everything to act on today, as rows in one white block. */}
                  <div className="cs-pins">
                    {pinRows.map((g) => {
                      const lone = g.items.length === 1 ? g.items[0] : undefined;
                      const body = (
                        <>
                          <span className={`cs-ictile ${g.level >= 3 ? "cs-ictile--danger" : "cs-ictile--warn"}`}><Icon name={pinGlyph(g.items[0])} size={18} /></span>
                          <span className="cs-pin-main">
                            <span className="cs-pin-h">{g.headline}{lone && awayMark(lone)}</span>
                            {g.action && <span className="cs-pin-a">{g.action}</span>}
                            {!lone && <span className="cs-pin-more">See the list <Icon name="caret-down" size={13} /></span>}
                          </span>
                          {lone && <Icon name="caret-right" size={16} className="cs-pin-go" />}
                        </>
                      );
                      if (lone) return <PinLink key={g.key} item={lone} className="cs-pin">{body}</PinLink>;
                      // Several of one kind, said once. The names are behind a native disclosure: no script, works offline.
                      return (
                        <details key={g.key} className="cs-pin">
                          <summary>{body}</summary>
                          <ul className="cs-pin-list">
                            {g.items.map((i) => <li key={i.key}><PinLink item={i}>{plain.get(i.key)!.headline}{awayMark(i)}</PinLink></li>)}
                          </ul>
                        </details>
                      );
                    })}
                  </div>
                  {(pinWarnings > 0 || pinHeadsUp > 0) && (
                    <div className="cs-pills">
                      {pinWarnings > 0 && <span className="cs-pill cs-pill--danger"><Icon name="siren" size={13} />{pinWarnings} {pinWarnings === 1 ? "warning" : "warnings"}</span>}
                      {pinHeadsUp > 0 && <span className="cs-pill cs-pill--warn"><Icon name="warning" size={13} />{pinHeadsUp} heads up</span>}
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {loaded && <Ask island={island} ctx={askCtx} now={now} />}
          {loaded && chips}

          {approaching && mainStorm && (
            <section className="cs-card t-storms" aria-label={mainStorm.text}>
              <div className="cs-tophead">
                <span className="cs-ictile cs-ictile--lg"><Icon name="wind" size={20} /></span>
                <span className="cs-tophead-t">
                  <span className="cs-label">{/\b(Sat|Sun)\b/.test(mainStorm.text) ? "Storm this weekend" : "Storm"}</span>
                  {/* non-breaking hyphen: never "Two-" / "C" */}
                  <h2 className="cs-display cs-display--card">{stormName(mainStorm.s).replace(/-/g, "‑")}</h2>
                </span>
              </div>
              <p className="cs-body">{mainStorm.text}</p>
              <div className="cs-figure"><StormMap storm={mainStorm.s} place={place} compact /></div>
              <div className="cs-grid2">
                {windsFrom && <p><Icon name="warning" size={18} /><b>{fmtDayTime(windsFrom)}</b><span>{outlook?.hurricaneWindsFrom ? "damaging winds from" : "winds could start"}</span></p>}
                <p><Icon name="wind" size={18} /><b>{Math.round(ktToMph(mainStorm.s.windKt) / 5) * 5} mph</b><span>at storm center</span></p>
                {watch && <p><Icon name="siren" size={18} /><b>{watch}</b></p>}
                <p><Icon name="warning-fill" size={18} /><b>Advisory {mainStorm.s.advNum}</b><span>latest</span></p>
              </div>
              <div className="cs-foot">
                <span className="cs-foot-note">{stormName(mainStorm.s)}</span>
                <Link href="/storms/" className="cs-btn-ink">Storm page</Link>
              </div>
            </section>
          )}

          {!weatherCard
            ? <p className="cs-card cs-body cs-flat">Weather loads when the signal is better.</p>
            : show("weather") && <WeatherNow island={island} />}

          {/* Weak signal: the 1.5 KB essentials arrived but the 30 KB snapshot has not. Show the
              headlines we do have rather than an empty page — this is the path the app exists for. */}
          {headlinesOnly.length > 0 && (
            <section className="cs-card" aria-label="Just in">
              <p className="cs-label">Just in</p>
              {headlinesOnly.map((a) => (
                <div key={a.h} className="cs-row">
                  <span className="cs-rowmain">
                    <span className="cs-rowname">{a.title}</span>
                    <span className="cs-rowsub">Details load when the signal is better.</span>
                  </span>
                </div>
              ))}
            </section>
          )}

          {bands.map((b) => {
            const { rows, folded } = foldRuns(b.rows.filter((r) => show(r.topic)));
            if (!rows.length) return null;
            return (
              <section key={b.key} aria-label={b.label}>
                <div className="cs-feedhead">
                  <p className="cs-label">{b.label}</p>
                  <span className="cs-pill cs-pill--ink">{rows.length}</span>
                </div>
                <ol className="cs-feed">
                  {rows.map((r) => <li key={r.key}><FeedRow row={r} island={island} focus={r.key === focusKey} /></li>)}
                  {Object.entries(folded).map(([topic, n]) => (
                    <li key={topic} className="cs-feed-quiet">
                      <Link href={HREF[topic] ?? "/"} className="cs-more">
                        <span>{n} more {MORE_WORD[topic]?.[n === 1 ? 0 : 1] ?? "of these"}</span>
                        <Icon name="caret-right" size={14} />
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>
            );
          })}

          {!loaded && !offline && <p className="cs-body cs-flat">Loading what is happening around {islandName(island)}…</p>}
          {/* Home was the one data page with no offline state: with nothing cached it sat on "Loading…" for ever. */}
          {!loaded && offline && (
            <section className="cs-card"><EmptyState kind="error" title="Can't load right now." onRetry={() => window.dispatchEvent(new Event("online"))}>Try again when you have signal. In an emergency call 911.</EmptyState></section>
          )}

          {/* "Not now" hides the block on this phone; the card goes with it rather than staying as an empty white box. */}
          {!alertsDismissed && <div className="cs-card"><AlertsCard island={island} compact /></div>}

          <Link href="/sources/" className="cs-settings">
            <span className="cs-ictile cs-ictile--ink"><Icon name="gear" size={18} /></span>
            <span className="cs-settings-t">Settings and about</span>
            <Icon name="caret-right" size={16} className="cs-ic" />
          </Link>
          <footer className="cs-footer">Free. No ads. No account. Not an emergency service — call 911.</footer>
        </div>
      </div>
    </main>
  );
}

/** A pinned thing is a tap away from its own page, or the agency's post when the app has none. */
function PinLink({ item, className, children }: { item: Item; className?: string; children: React.ReactNode }) {
  const href = hrefOf(item), away = href.startsWith("http");
  return <Link href={href} {...(away ? { target: "_blank", rel: "noreferrer" } : {})} id={`item-${hashOf(item.key)}`} className={className}>{children}</Link>;
}
/** The off-app mark, on the end of the line it leaves from. */
const awayMark = (item: Item) => hrefOf(item).startsWith("http") ? <Icon name="arrow-square-out" size={13} className="cs-away" aria-hidden /> : null;
/** The pin's glyph: the row's own kind, a warning triangle for a watch, a drop for a water outage. */
const pinGlyph = (i: Item): IconName => i.type === "advisory" ? "warning" : i.type === "outage" && i.fields?.kind ? "drop" : ICON[i.type] ?? "warning";

/** Where a folded run sends you, and what to call the things it folded. */
const HREF: Record<string, string> = {
  roads: "/traffic/", storms: "/storms/", quakes: "/quakes/",
  volcano: "/volcano/", tsunami: "/tsunami/", weather: "/weather/", reports: "/report/",
};
/** Chip order is fixed so the row never reshuffles; only the ones with something behind them show. */
const CHIP_ORDER = ["weather", "roads", "storms", "quakes", "volcano", "tsunami", "reports"];
const CHIP_LABEL: Record<string, string> = {
  weather: "Weather", roads: "Roads", storms: "Storms", quakes: "Quakes",
  volcano: "Volcano", tsunami: "Ocean", reports: "Reports",
};
/** [one, many] for the folded "N more …" rows. */
const MORE_WORD: Record<string, [string, string]> = {
  roads: ["road closure", "road closures"], storms: ["storm", "storms"], quakes: ["earthquake", "earthquakes"],
  volcano: ["volcano notice", "volcano notices"], tsunami: ["ocean notice", "ocean notices"], weather: ["weather notice", "weather notices"], reports: ["notice", "notices"],
};
/** The feed entry's tile says the topic, the way the card's .t-* hue does. */
const TOPIC_ICON: Record<string, IconName> = {
  roads: "car", storms: "wind", quakes: "pulse", volcano: "mountains", tsunami: "waves", weather: "cloud-sun", reports: "megaphone",
};

/**
 * One entry of the feed: the tile, the sentence with its clock time on the same line, what to do,
 * who said it — and a picture of where, but only when the thing has a real position. A notice has
 * no map, and inventing one would say the app knows something it does not.
 */
function FeedRow({ row, island, focus }: { row: FeedRowT; island: Exclude<Island, "state">; focus?: boolean }) {
  useFocusScroll(row.key, focus);
  // An agency release has no page here, so its row is the agency's own post. Off-app links open in
  // a new tab — a full navigation inside the app would replace the app with the agency's website.
  const away = row.href.startsWith("http");
  return (
    <Link href={row.href} {...(away ? { target: "_blank", rel: "noreferrer" } : {})} id={`item-${hashOf(row.key)}`} className={`cs-entry t-${row.topic}`}>
      <span className="cs-ictile"><Icon name={TOPIC_ICON[row.topic] ?? "bell"} size={18} /></span>
      <span className="cs-entry-main">
        <span className="cs-entry-hl"><span className="cs-entry-h">{row.headline}</span><span className="cs-entry-when">{row.when}</span></span>
        {row.sub && <span className="cs-entry-sub">{row.sub}</span>}
        <span className="cs-entry-meta">{row.source}{away && <Icon name="arrow-square-out" size={12} className="cs-away" aria-hidden />}</span>
      </span>
      {row.mark && <span className="cs-entry-thumb"><MiniMap island={island} mark={row.mark} size={52} /></span>}
    </Link>
  );
}

/** Weather as an ordinary topic card: the reading in the inner well, the sentence, the stat grid, and a foot that leads to the page. */
function WeatherNow({ island }: { island: Exclude<Island, "state"> }) {
  const w = useJson<Weather>(`v1/${island}/weather.json`);
  const townId = useSyncExternalStore(() => () => {}, () => localStorage.getItem("town"), () => null);
  const town = w?.data?.towns.find((t) => t.id === townId) ?? w?.data?.towns[0];
  const meta = TOWNS.find((t) => t.id === town?.id);
  if (!w) return <p className="cs-card cs-body cs-flat">Loading the weather…</p>;
  if (!town?.hourly) return <p className="cs-card cs-body cs-flat">Weather is not available right now.</p>;
  const h = town.hourly;
  const obsFresh = town.obs && w.fetchedAt - town.obs.at < 2 * 3_600_000;
  const code = obsFresh && town.obs?.sky ? conditionCode("", town.obs.sky) : h.c[0], night = !!h.n[0];
  const temp = (obsFresh ? town.obs?.f : undefined) ?? h.t[0];
  // Wind and humidity are the station's own reading; a reading two hours old is dropped rather than shown as now.
  const mph = obsFresh ? town.obs?.wMph : undefined, rh = obsFresh ? town.obs?.rh : undefined;
  const hi = town.fc.find((p) => p.day)?.t, lo = town.fc.find((p) => !p.day)?.t;
  const d0 = Math.floor((w.fetchedAt - 10 * 3_600_000) / 86_400_000) * 86_400_000 + 10 * 3_600_000;
  const sun = meta ? sunTimes(d0, meta.lat, meta.lon) : undefined;
  const tempLabel = temp != null ? `${temp}°` : "—";
  // High and low come from the forecast, so the grid always has its first row; a station reading is a cell only when it is real.
  const cells: React.ReactNode[] = [];
  if (hi != null) cells.push(<p key="hi"><Icon name="cloud-sun" size={18} /><b>{hi}°</b><span>high today</span></p>);
  if (lo != null) cells.push(<p key="lo"><Icon name="drop" size={18} /><b>{lo}°</b><span>low tonight</span></p>);
  if (rh != null) cells.push(<p key="rh"><Icon name="drop-fill" size={18} /><b>{rh}%</b><span>humidity</span></p>);
  if (mph != null) cells.push(<p key="wind"><Icon name="wind" size={18} /><b>{mph ? `${mph} mph` : "Calm"}</b><span>wind</span></p>);
  return (
    <section className="cs-card t-weather" aria-label={`${tempLabel} · ${condWord(code)} in ${town.name}`}>
      <div className="cs-tophead">
        <span className="cs-ictile cs-ictile--lg"><Icon name="cloud-sun" size={20} /></span>
        <span className="cs-tophead-t">
          <span className="cs-label">Weather</span>
          <h2 className="cs-display cs-display--card">{town.name}</h2>
        </span>
      </div>
      <div className="cs-well cs-wx">
        <span className="cs-wx-t">
          <span className="cs-temp">{tempLabel}</span>
          <span className="cs-wx-cond">{condWord(code)}</span>
        </span>
        <ConditionIcon code={code} night={night} size={64} className="cs-wx-pic" />
      </div>
      <p className="cs-body">{nowAndLater(obsFresh ? code : undefined, h)}</p>
      {cells.length > 0 && <div className="cs-grid2">{cells}</div>}
      <div className="cs-foot">
        <span className="cs-foot-note">{sun ? `Sunrise ${fmtTime(sun.rise)} · Sunset ${fmtTime(sun.set)}` : condWord(code)}</span>
        <Link href="/weather/" className="cs-btn-ink">Weather page</Link>
      </div>
    </section>
  );
}
