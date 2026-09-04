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
import Ask from "@/components/Ask";
import type { DigestItem, Island, Item } from "@/lib/types";
import { ISLANDS, hashOf } from "@/lib/types";
import type { StormsSnapshot } from "@/lib/storm";
import { ISLAND_POINTS } from "@/lib/storm";
import type { Quakes, Weather } from "@/lib/pages";
import { useFeed, useIslandChosen, useJson, useStoredIsland } from "@/lib/data";
import { condWord, conditionCode, feelsLike, nowAndLater, sunTimes } from "@/lib/summary";
import { TOWNS } from "@/lib/towns";
import { LEVEL_WORD, plainAlert, quakeSentence, rankStorms, staleLine, stormName, type Plain } from "@/lib/plain";
import { nowStory, officialExtra, topicRows, type Row } from "@/lib/now";
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
  const [showAll, setShowAll] = useState(false);
  const [showAllNotices, setShowAllNotices] = useState(false);

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
  /* Two homes, split by what you do with the thing, because everything below level 3 used to have
     neither. ACT_ON is a hazard that changes today: it gets a Heads up note and can raise the headline.
     Everything else official — agency notices, the Governor's storm proclamation, police releases — was
     parsed, given plain wording and then rendered on no screen in the app at all. It gets one card.
     Severity leads the sort: with a funnel this wide, recency alone lets a press release outrank a watch. */
  const ACT_ON: Item["type"][] = ["advisory", "storm", "outage", "tsunami", "hazard", "school"];
  const bySeverity = (a: Item, b: Item) => b.sev - a.sev || b.issuedAt - a.issuedAt;
  const headsUp = official.filter((i) => plain.get(i.key)!.level === 2 && ACT_ON.includes(i.type)).sort(bySeverity);
  const notices = official.filter((i) => i.type === "notice" && plain.get(i.key)!.level >= 2).sort(bySeverity);
  const shownNotices = showAllNotices ? notices : notices.slice(0, 3);

  const storms = stormsSnap?.data?.storms ?? [];
  const place = ISLAND_POINTS[island];
  const stormLines = rankStorms(storms, place);
  const coming = stormLines.filter((x) => x.approaching);
  const mainStorm = coming[0];
  const approaching = !!mainStorm;
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
  const alsoToday = rows.filter((r) => r.quiet);
  /* Every loud row reaches the screen. Roads has its own card, and the storm hero already covers a lone
     approaching storm; the rest used to be computed and then dropped on the floor. */
  const loud = rows.filter((r) => !r.quiet && r.key !== "roads" && !(r.key === "storms" && approaching && storms.length === 1));
  // No lead warning and no storm hero? The headline is still allowed to name the worst watch.
  const nextPlain = !lead && !mainStorm && headsUp[0] ? plain.get(headsUp[0].key) : undefined;
  /* ʻIo searches exactly what this page is rendering: same items, same wording, same storm lines. */
  const askCtx = { items, plain, storms: stormsSnap?.data ? stormLines.map((x) => ({ name: x.s.name, short: x.short })) : undefined };
  const story = nowStory({ storm: mainStorm, roads, shelterPlain: shelters[0] ? plain.get(shelters[0].key) : undefined, leadPlain: stormCovered ? undefined : leadPlain, nextPlain, island: islandName(island) });

  /* The one "there is more of this" control, shared by the two cards that can hold the rest. */
  const moreWarnings = rest.length > 2 && !showAll && (
    <div className="cs-chiprow">
      <button type="button" className="cs-chip cs-chip--link" onClick={() => setShowAll(true)}>All warnings ({rest.length}) <Icon name="caret-right" size={14} className="cs-ic" /></button>
    </div>
  );
  const restRows = (headlinesOnly.length > 0 || extraWarnings.length > 0) && (
    <ul className="hm-rows">
      {headlinesOnly.map((a) => (
        <li key={a.h} className="py-s3">
          <span className="cs-rowname">{a.title}</span>
          <span className="cs-rowsub">Details load when the signal is better.</span>
        </li>
      ))}
      {extraWarnings.map((i) => <ItemRow key={i.key} item={i} now={now} focus={i.key === focusKey} />)}
    </ul>
  );

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
            </section>
          )}

          {loaded && <Ask island={island} ctx={askCtx} now={now} />}

          {lead && !stormCovered && (
            <ItemCard icon={lead.type === "tsunami" ? "waves" : lead.type === "shelter" ? "tent" : lead.type === "outage" ? (lead.fields?.kind ? "drop" : "lightning-slash") : "wind"} kicker={plain.get(lead.key)!.word ?? LEVEL_WORD[plain.get(lead.key)!.level] ?? "Get ready"} title={plain.get(lead.key)!.headline} item={lead} focus={lead.key === focusKey}>
              {plain.get(lead.key)!.action && <p className="cs-body">{plain.get(lead.key)!.action}</p>}
              {staleLine(lead, now) && <><div className="cs-rule" /><p className="cs-meta">{staleLine(lead, now)}</p></>}
              {restRows}
              {moreWarnings}
            </ItemCard>
          )}

          {approaching && mainStorm && (
            <Link href="/storms/" className="cs-card cs-hero cs-hero--amber" aria-label={mainStorm.text}>
              <div className="cs-heroline">
                <span className="cs-ictile cs-ictile--amber"><Icon name="wind" size={21} className="cs-ic" /></span>
                <div className="hm-heromain">
                  <p className="cs-label">{/Saturday|Sunday/i.test(mainStorm.text) ? "Storm this weekend" : "Storm"}</p>
                  {/* non-breaking hyphen: never "Two-" / "C" */}
                  <h2 className="cs-display cs-display--hero">{stormName(mainStorm.s).replace(/-/g, "‑")}</h2>
                </div>
              </div>
              <p className="cs-body cs-body--hero">{mainStorm.text}</p>
              {mainStorm.level >= 3 && <p className="cs-note"><Icon name="warning" size={18} />Finish getting ready. Follow Civil Defense.</p>}
              <div className="cs-figure hm-figure"><StormMap storm={mainStorm.s} place={place} compact /></div>
            </Link>
          )}

          {/* Exactly the cases the lead card above did not render: otherwise both hold the same rows. */}
          {(!lead || stormCovered) && restRows && (
            <section className="cs-card">
              <p className="cs-label">Also in effect</p>
              {restRows}
              {moreWarnings}
            </section>
          )}

          {shelters.map((i) => <ShelterCard key={i.key} item={i} plain={plain.get(i.key)!} now={now} focus={i.key === focusKey} />)}

          {!roads.quiet && (
            <Link href="/traffic/" className="cs-card t-roads">
              <p className="cs-label"><Icon name="traffic-cone" size={15} className="cs-ic" /> Roads</p>
              <h2 className="cs-title">{roads.text.replace(/\s+\d+ more\.$/, "")}</h2>
              <p className="cs-body">Tap for the map and detours.</p>
              {/\d+ more/.test(roads.text) && <div className="cs-chiprow"><span className="cs-chip cs-chip--link">{roads.text.match(/(\d+ more)\.?$/)?.[1]}</span></div>}
            </Link>
          )}

          {loud.map((r) => <TopicCard key={r.key} row={r} />)}

          {mode === "low" || offline
            ? <p className="cs-card cs-body hm-flat">Weather loads when the signal is better.</p>
            : <WeatherNow island={island} />}

          {headsUp.filter((i) => plain.get(i.key) !== nextPlain).map((i) => {
            const p = plain.get(i.key)!;
            return (
              <p key={i.key} className="cs-note hm-flat">
                <Icon name="warning" size={18} />
                <span><span className="font-semibold">Heads up:</span> {p.headline}. <span className="text-ink-2">{p.action}</span></span>
              </p>
            );
          })}

          {shownNotices.length > 0 && (
            <section className="cs-card" aria-label="Notices">
              <p className="cs-label"><Icon name="megaphone" size={15} className="cs-ic" /> Notices</p>
              <ul className="hm-rows">{shownNotices.map((i) => <ItemRow key={i.key} item={i} now={now} focus={i.key === focusKey} />)}</ul>
              {notices.length > shownNotices.length && (
                <div className="cs-chiprow">
                  <button type="button" className="cs-chip cs-chip--link" onClick={() => setShowAllNotices(true)}>All notices ({notices.length}) <Icon name="caret-right" size={14} className="cs-ic" /></button>
                </div>
              )}
            </section>
          )}

          {loaded && alsoToday.length > 0 && (
            <section className="cs-card" aria-label="Also today">
              <p className="cs-label">Also today</p>
              <div className="cs-grid">
                {alsoToday.map((r) => (
                  <Link key={r.key} href={r.href} className={`cs-tile ${TOPIC_CLASS[r.key] ?? ""}`}>
                    <span className="cs-ictile"><Icon name={MINI_ICON[r.key] ?? "cloud-sun"} size={21} className="cs-ic" /></span>
                    <p className="cs-tile-name">{r.label}</p>
                    <p className="cs-tile-line">{r.text}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}

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

/** Reports is the one row whose key and topic name differ. */
const TOPIC_CLASS: Record<string, string> = {
  roads: "t-roads", storms: "t-storms", quakes: "t-quakes",
  volcano: "t-volcano", tsunami: "t-tsunami", neighbors: "t-reports",
};

const MINI_ICON: Record<string, IconName> = {
  storms: "wind", quakes: "pulse", volcano: "mountains", tsunami: "waves", neighbors: "users-three", roads: "traffic-cone",
};

/** A topic with something to say, as an ordinary card: the label, the sentence, and the way in. */
function TopicCard({ row }: { row: Row }) {
  return (
    // the row key IS the topic key: one class carries the hue to the label and the icon tile
    <Link href={row.href} className={`cs-card ${TOPIC_CLASS[row.key] ?? ""}`}>
      <p className="cs-label"><Icon name={MINI_ICON[row.key] ?? "cloud-sun"} size={15} className="cs-ic" /> {row.label}</p>
      <h2 className="cs-title">{row.text}</h2>
    </Link>
  );
}

/** The loudest card on the page: a hero on the brick edge, the level word over the plain headline. */
function ItemCard({ icon, kicker, title, children, item, focus }: {
  icon: IconName;
  kicker: string;
  title: string;
  children?: React.ReactNode;
  item?: Item;
  focus?: boolean;
}) {
  const extra = item ? officialExtra(item, title) : undefined;
  useFocusScroll(item?.key, focus);
  return (
    <article id={item ? `item-${hashOf(item.key)}` : undefined} className="cs-card cs-hero hm-alarm" aria-label={title}>
      <div className="cs-heroline">
        <span className="cs-ictile cs-ictile--brick"><Icon name={icon} size={21} className="cs-ic" /></span>
        <div className="hm-heromain">
          <p className="cs-label hm-label--alarm">{kicker}</p>
          <h2 className="cs-display cs-display--card">{title}</h2>
        </div>
      </div>
      {children}
      {extra && <p className="cs-body">{extra}</p>}
    </article>
  );
}

/** An open shelter: the calm card, because the thing to do is already in the sentence. */
function ShelterCard({ item, plain, now, focus }: { item: Item; plain: Plain; now: number; focus?: boolean }) {
  const stale = staleLine(item, now);
  const extra = officialExtra(item, plain.headline);
  useFocusScroll(item.key, focus);
  return (
    <article id={`item-${hashOf(item.key)}`} className="cs-card" aria-label={plain.headline}>
      <p className="cs-label"><Icon name="tent" size={15} className="cs-ic" /> {plain.word ?? "Shelter open"}</p>
      <h2 className="cs-title">{plain.headline}</h2>
      {plain.action && <p className="cs-body">{plain.action}</p>}
      {stale && <><div className="cs-rule" /><p className="cs-meta">{stale}</p></>}
      {extra && <p className="cs-body">{extra}</p>}
    </article>
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
