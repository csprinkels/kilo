"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import PageShell from "@/components/PageShell";
import ConditionIcon from "@/components/ConditionIcon";
import HourlyChart from "@/components/HourlyChart";
import TideChart from "@/components/TideChart";
import DailyRows, { rowsFromPeriods } from "@/components/DailyRows";
import ItemRow from "@/components/ItemRow";
import RadarMap from "@/components/RadarMap";
import { usePageFilter } from "@/components/PageFilter";
import { TILES } from "@/lib/tiles";
import EmptyState from "@/components/EmptyState";
import type { Hourly, Period, TownWx, Weather } from "@/lib/pages";
import type { Island } from "@/lib/types";
import { useFeed, useJson, useStoredIsland } from "@/lib/data";
import { dropSuperseded } from "@/lib/feed";
import { TOWNS } from "@/lib/towns";
import { clock, condWord, conditionCode, feelsLike, nowAndLater, sunTimes } from "@/lib/summary";
import { LEVEL_WORD, dirWord, plainAlert, stormLine } from "@/lib/plain";
import { ISLAND_POINTS, type StormsSnapshot } from "@/lib/storm";
import { ISLAND_LABEL, fmtTime } from "@/lib/brand";

const HOUR = 3_600_000, DAY = 86_400_000;
const dayStartHST = (ms: number) => Math.floor((ms - 10 * HOUR) / DAY) * DAY + 10 * HOUR;

// The town choice lives in localStorage ("town") so the Now page shows the same place.
const townListeners = new Set<() => void>();
const subscribeTown = (cb: () => void) => { townListeners.add(cb); return () => { townListeners.delete(cb); }; };
const getTown = () => localStorage.getItem("town");
// The rain radar is live-only, so the page has to know what RadarMap knows: no signal, no map.
const subscribeOnline = (cb: () => void) => { addEventListener("online", cb); addEventListener("offline", cb); return () => { removeEventListener("online", cb); removeEventListener("offline", cb); }; };
function useStoredTown(): [string | null, (id: string) => void] {
  const id = useSyncExternalStore(subscribeTown, getTown, () => null);
  return [id, (t) => { localStorage.setItem("town", t); townListeners.forEach((cb) => cb()); }];
}

export default function WeatherPage() {
  const [stored, setIsland] = useStoredIsland();
  const island: Exclude<Island, "state"> = stored === "state" ? "hawaii" : stored;
  // "Statewide" is gone; make the choice stick so Now and Weather agree.
  useEffect(() => { if (stored === "state") setIsland("hawaii"); }, [stored, setIsland]);
  const w = useJson<Weather>(`v1/${island}/weather.json`);
  const stormsSnap = useJson<StormsSnapshot>("v1/storms.json");
  const { snap } = useFeed(island);
  const [townId, setTownId] = useStoredTown();
  const [slow, setSlow] = useState(false);
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  useEffect(() => { const t = setTimeout(() => setSlow(true), 30_000); return () => clearTimeout(t); }, []);

  const d = w?.data;
  /**
   * A tide table is only useful while it still reaches forward. Stored 60 hours at a time and read
   * from cache, it can be entirely in the past after a long stretch with no signal — and TideChart
   * would then draw a two-point stub with no high or low on it, which is the one thing the chip
   * promises. Two hours of runway is the floor for a curve worth looking at.
   */
  const tideLive = d?.tide && d.tide.t0 + (d.tide.h.length - 1) * 3_600_000 >= (w?.fetchedAt ?? 0) + 2 * 3_600_000 ? d.tide : undefined;
  // The alert pills and "Heads up" are timed against this too, and they outlive a weather.json
  // failure — so fall back to the feed's own clock rather than 1970.
  const now = w?.fetchedAt || snap?.fetchedAt || 0;
  const town = d?.towns.find((t) => t.id === townId) ?? d?.towns[0];
  const meta = TOWNS.find((t) => t.id === town?.id);
  const h = town?.hourly;

  // Town picker above the heading: a native <select> behind the words, so iPhones get their wheel. The h1 is "Right Now".
  const title = !d || !town ? "Weather" : (
    <>
      <label className="wx-townpick">
        <Icon name="navigation-arrow" size={17} aria-hidden /> {town.name} <Icon name="caret-down" size={17} aria-hidden />
        <select aria-label="Town" value={town.id} onChange={(e) => setTownId(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
          {d.towns.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
      <span className="wx-title">Right Now</span>
    </>
  );

  // Official weather items worth a "heads up" (level 2) and an approaching storm, if any.
  // The agencies reissue rather than edit, so the same advisory for the same shores arrives again
  // under a new id — three High Surf pills, two of them word-for-word identical. The feed already
  // drops the superseded copies; this page was reading the raw list.
  const weatherItems = dropSuperseded(snap?.data?.items ?? []).filter((i) => i.tier !== "community" && (i.type === "advisory" || i.type === "storm"));
  const headsUp = weatherItems.filter((i) => plainAlert(i, now, island).level === 2);
  // Watches and warnings in effect: the pill under the hero, like Acme's "Flood Watch". Level 2 and up; worst first.
  const alerts = weatherItems.map((i) => ({ i, p: plainAlert(i, now, island) })).filter((x) => x.p.level >= 2).sort((a, b) => b.p.level - a.p.level);
  // The rain map opens by itself when there is a weather alert or rain is likely soon; otherwise it is one tap away.
  const rainSoon = !!h && (h.p.slice(0, 6).some((pp) => pp >= 40) || h.c.slice(0, 3).some((c) => c >= 5 && c <= 7));
  const [showRadar, setShowRadar] = useState(false);
  const storm = (stormsSnap?.data?.storms ?? []).map((s) => stormLine(s, ISLAND_POINTS[island])).find((l) => l.approaching && l.level >= 3);
  // The surf card is one sentence, and that sentence comes out empty on feeds whose zone names it
  // cannot read. Build it once: what the chip offers and what the card holds are then the same thing.
  const surfLine = d?.surf ? surfSentence(d.surf.zones, island) : "";
  const airLevel = d && d.air.length > 0 && town ? rank(airFor(d.air, town.name).cat) : 0;

  // This is the longest page in the app, so it gets chips. Each one is spelled out only when its
  // section has CONTENT today — not merely when its payload loaded — so a chip can never filter down
  // to an empty screen. The hero, the alert pills, the storm line and "Heads up" stay outside show():
  // a filter hides sections, never warnings. Air is both, depending on the day, so it is kept on
  // screen at category 2 and up, where its sentence turns into an instruction to stay inside.
  const { bar, show, only } = usePageFilter([
    // No meta, no coordinates, no map — the chip would filter down to nothing.
    ...(TILES && online && meta ? [{ id: "radar", label: "Radar" }] : []),
    ...(h && h.t.length > 0 ? [{ id: "hourly", label: "Hourly" }] : []),
    ...(town && town.fc.length > 0 ? [{ id: "forecast", label: "Forecast" }] : []),
    ...(surfLine ? [{ id: "surf", label: "Surf" }] : []),
    // Non-empty is not the test: a table stored before a long offline stretch can be entirely in
    // the past, and TideChart would then draw a two-point stub with no turns on it at all.
    ...(tideLive ? [{ id: "tides", label: "Tides" }] : []),
    ...(d && d.air.length > 0 ? [{ id: "air", label: "Air" }] : []),
  ], { clearOn: `${alerts[0]?.p.level ?? 0}-${storm?.level ?? 0}-${airLevel}` });

  return (
    <PageShell title={title} island={island} onIsland={setIsland} fetchedAt={w?.fetchedAt} gen={d?.upd} offline={w?.offline} source="the National Weather Service">
      {!d && (w || slow
        ? <section className="cs-card wx-flush mt-s3"><EmptyState kind="error" title="Can't load right now." onRetry={() => window.dispatchEvent(new Event("online"))}>Try again when you have signal. In an emergency call 911.</EmptyState></section>
        : <p className="cs-body mt-s3">Loading the weather…</p>)}

      {/*
        Only the weather cards wait on `d`. The pills, the storm line and "Heads up" come from the
        feed and storms.json, which fail on their own schedule — a dead weather.json used to take a
        live Tsunami Warning off the screen with it. `h` and `meta` gate the two things that
        genuinely need them (the hourly readings, and anything needing coordinates), not the page.
      */}
      {d && town && <RightNow town={town} h={h} meta={meta} now={now} />}
      {d && !town && (
        <section className="cs-card wx-flush mt-s3">
          <EmptyState kind="error" title="No town weather for this island right now.">Any alerts still show below. In an emergency call 911.</EmptyState>
        </section>
      )}

      {alerts.map(({ i, p }) => {
        // The pill links to a row only when that row exists. "Heads up" is level 2 EXACTLY, so a lone
        // Flash Flood Warning got an anchor to nothing, and a level 4 beside a level 2 scrolled the
        // reader to "Nothing dangerous, but good to know". With no row to open, the pill carries the
        // instruction itself — on this page nothing else prints it.
        const row = headsUp.includes(i);
        const cls = `cs-card wx-alert mt-s3 ${p.level >= 4 ? "wx-alert--danger" : p.level >= 3 ? "wx-alert--warn" : ""}`;
        const inner = (
          <>
            <span className={`cs-ictile ${p.level >= 4 ? "cs-ictile--brick" : p.level >= 3 ? "cs-ictile--amber" : ""}`}><Icon name="warning-fill" size={21} /></span>
            <p className="wx-alert-t">
              {p.level >= 3 ? <span className="wx-sev">{p.word ?? LEVEL_WORD[p.level]}:</span> : <>{p.word ?? LEVEL_WORD[p.level]}:</>} {p.headline}
              {!row && p.action && <span className="fd-pin-sub">{p.action}</span>}
            </p>
            {row && <Icon name="caret-right" size={17} className="wx-caret" />}
          </>
        );
        return row
          ? <a key={i.key} href="#heads-up" className={cls}>{inner}</a>
          : <div key={i.key} className={cls}>{inner}</div>;
      })}

      {d && town && (
        <>
          {bar}

          {show("radar") && TILES && online && meta && ((alerts.length > 0 || rainSoon || showRadar || only === "radar")
            ? <RadarMap lat={meta.lat} lon={meta.lon} label={`Rain radar around ${town.name}: blue where it is raining now`} />
            : <button className="btn mt-s3" onClick={() => setShowRadar(true)}><Icon name="drop" size={18} /> See the rain radar</button>)}
        </>
      )}

      {storm && (
        <section className="cs-card t-storms mt-s3">
          <div className="cs-heroline">
            <span className="cs-ictile"><Icon name="wind-fill" size={21} /></span>
            <p className="cs-title">{storm.text}</p>
          </div>
          <div className="cs-actions">
            <Link href="/storms/" className="cs-link wx-golink">See the storm <Icon name="caret-right" size={16} aria-hidden /></Link>
          </div>
        </section>
      )}

      {d && town && (
        <>
          {show("hourly") && h && h.t.length > 0 && (
            <section className="cs-card t-weather mt-s3">
              <h2 className="cs-display cs-display--hero">Next {Math.round(h.t.length / 12) * 12} Hours</h2>
              <p className="cs-body num max-w-[36rem]">{nowAndLater(obsCode(town, now), h)} {trendSentence(h)} {sunLine(meta, now)}</p>
              <HourlyChart h={h} />
            </section>
          )}

          {show("forecast") && town.fc.length > 0 && (
            <section className="cs-card t-weather mt-s3">
              <h2 className="cs-display cs-display--hero">{daysTitle(town.fc)}</h2>
              <p className="cs-body max-w-[36rem]">{weekSentence(town.fc)}</p>
              <DailyRows fc={town.fc} />
            </section>
          )}

          {show("surf") && surfLine && (
            <section className="cs-card t-weather mt-s3">
              <h2 className="cs-display cs-display--hero">Surf</h2>
              <p className="cs-body max-w-[36rem]">{surfLine}</p>
            </section>
          )}

          {show("tides") && tideLive && (
            <section className="cs-card t-weather mt-s3">
              <h2 className="cs-display cs-display--hero">Tides</h2>
              <TideChart tide={tideLive} />
            </section>
          )}

          {show("air", airLevel >= 2) && d.air.length > 0 && (
            <section className={`cs-card ${island === "hawaii" ? "t-volcano" : "t-weather"} mt-s3`}>
              <h2 className="cs-display cs-display--hero">Air</h2>
              <p className="cs-body max-w-[36rem]">{airSentence(d.air, town.name, island)}</p>
              {island === "hawaii" && (
                <div className="cs-actions">
                  <Link href="/volcano/" className="cs-link wx-golink">Vog details <Icon name="caret-right" size={16} aria-hidden /></Link>
                </div>
              )}
            </section>
          )}
        </>
      )}

      {headsUp.length > 0 && (
        <section id="heads-up" className="cs-card mt-s3 scroll-mt-s4">
          <h2 className="cs-display cs-display--hero">Heads up</h2>
          <p className="cs-body max-w-[36rem]">Nothing dangerous, but good to know.</p>
          <div className="wx-rows">
            <ul className="list">{headsUp.map((i) => <ItemRow key={i.key} item={i} now={now} showSource={new Set(headsUp.map((x) => x.source)).size > 1} />)}</ul>
          </div>
        </section>
      )}
    </PageShell>
  );
}

const obsFresh = (town: TownWx, now: number) => !!town.obs && now - town.obs.at < 2 * HOUR;
/** The station's sky when its reading is fresh, else nothing (the forecast's first hour stands in). */
const obsCode = (town: TownWx, now: number) => (obsFresh(town, now) && town.obs?.sky ? conditionCode("", town.obs.sky) : undefined);
/** "Sunrise at 6:02 AM, sets at 6:44 PM." for today, or nothing for a town this build has no coordinates for. */
function sunLine(meta: { lat: number; lon: number } | undefined, now: number) {
  if (!meta) return "";
  const s = sunTimes(dayStartHST(now), meta.lat, meta.lon);
  return `Sunrise at ${fmtTime(s.rise)}, sets at ${fmtTime(s.set)}.`;
}

/**
 * The weather picture: big icon, then the temperature, the sky word, high and low, and a "More" card
 * with the rest. Every reading is optional — an hourly block can be absent or empty, and a town the
 * feed ships but this build's TOWNS list lacks has no coordinates — so each line is dropped rather
 * than guessed at. A fabricated "Clear" is worse than a missing word.
 */
function RightNow({ town, h, meta, now }: { town: TownWx; h?: Hourly; meta?: { lat: number; lon: number }; now: number }) {
  const [open, setOpen] = useState(false);
  const fresh = obsFresh(town, now);
  const code = obsCode(town, now) ?? h?.c[0];
  const temp = (fresh ? town.obs?.f : undefined) ?? h?.t[0];
  const rh = (fresh ? town.obs?.rh : undefined) ?? h?.rh[0];
  const fl = temp != null && rh != null ? feelsLike(temp, rh) : undefined;
  const hi = town.fc.find((p) => p.day)?.t, lo = town.fc.find((p) => !p.day)?.t;
  const mph = (fresh ? town.obs?.wMph : undefined) ?? h?.w[0];
  const deg = fresh && town.obs?.wDir != null ? town.obs.wDir : h?.wd[0] != null ? h.wd[0] * 22.5 : undefined;
  const sun = meta ? sunTimes(dayStartHST(now), meta.lat, meta.lon) : undefined;
  const more = fl != null || mph != null || rh != null || !!sun;
  return (
    <>
      <section className="cs-card cs-hero t-weather mt-s3" aria-label={`${town.name} right now`}>
        <div className="wx-now">
          {code != null && <ConditionIcon code={code} night={!!h?.n[0]} size={164} className="wx-now-ic" />}
          <div className="wx-now-read">
            <p className="cs-bignum cs-bignum--lg">{temp != null ? `${temp}°` : "—"}</p>
            {code != null && <p className="wx-now-word">{condWord(code)}</p>}
            {hi != null && lo != null && <p className="wx-now-hilo">High {hi}° Low {lo}°</p>}
            {more && (
              <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="wx-more">
                More <Icon name="caret-down" size={16} className={open ? "rotate-180" : ""} aria-hidden />
              </button>
            )}
          </div>
        </div>
      </section>
      {open && more && (
        <section className="cs-card t-weather mt-s3">
          <div className="cs-grid">
            {fl != null && <div className="cs-tile"><p className="wx-stat-v">Feels like {fl}°</p></div>}
            {mph != null && <div className="cs-tile"><p className="wx-stat-v">{mph < 4 ? "Almost no wind" : deg == null ? `Wind ${mph} mph` : `Wind from the ${dirWord(deg)}, ${mph} mph`}</p></div>}
            {rh != null && <div className="cs-tile"><p className="wx-stat-v">Humidity {rh}%</p></div>}
            {sun && <div className="cs-tile"><p className="wx-stat-v">Sunrise {fmtTime(sun.rise)} · Sunset {fmtTime(sun.set)}</p></div>}
          </div>
        </section>
      )}
    </>
  );
}

/** "Down to 73° around 3 AM, then up to 84° by 2 PM." */
function trendSentence(h: Hourly): string {
  const n = Math.min(24, h.t.length), t = h.t.slice(0, n);
  const iMax = t.indexOf(Math.max(...t)), iMin = t.indexOf(Math.min(...t));
  const at = (i: number) => clock(h.t0 + i * HOUR).replace("12 AM", "midnight").replace("12 PM", "noon");
  if (t[iMax] - t[iMin] < 4) return `Around ${t[0]}° all day.`;
  if (iMin === 0) return `Up to ${t[iMax]}° around ${at(iMax)}.`;
  if (iMax === 0) return `Down to ${t[iMin]}° around ${at(iMin)}.`;
  return iMin < iMax ? `Down to ${t[iMin]}° around ${at(iMin)}, then up to ${t[iMax]}° by ${at(iMax)}.` : `Up to ${t[iMax]}° around ${at(iMax)}, then down to ${t[iMin]}° by ${at(iMin)}.`;
}

// The feed carries however many days the publisher sends; the heading says that number, never more.
const daysTitle = (fc: Period[]) => { const n = fc.filter((p) => p.day).length; return n >= 7 ? "Next 7 days" : n <= 1 ? "Today and tonight" : `Next ${n} days`; };

/** "Warmest Thursday, 86°. Rain likely Saturday." */
function weekSentence(fc: Period[]): string {
  const rows = rowsFromPeriods(fc);
  const highs = rows.map((r) => r.hi).filter((t): t is number => t != null);
  const name = (s: string) => (s === "Today" || s === "Tonight" ? s.toLowerCase() : s.replace(" Night", " night"));
  const warm = rows.find((r) => r.hi === Math.max(...highs));
  const heat = !highs.length ? "" : Math.max(...highs) - Math.min(...highs) < 2 ? `Highs around ${highs[0]}°.` : `Warmest ${name(warm!.name)}, ${warm!.hi}°.`;
  // Today's rain is already in the hourly picture; name a later day when one qualifies.
  const later = rows.slice(1);
  const wet = later.find((r) => r.pop >= 60) ?? rows.find((r) => r.pop >= 60);
  const damp = later.find((r) => r.pop >= 40) ?? rows.find((r) => r.pop >= 40);
  const rain = wet ? `Rain likely ${name(wet.name)}.` : damp ? `Some showers ${name(damp.name)}.` : "Mostly dry.";
  return `${heat} ${rain}`.trim();
}

/** One sentence from the surf forecast: which side, how big, and whether tomorrow is bigger. */
function surfSentence(zones: Record<string, Record<string, [string, string]>>, island: Island): string {
  const hi = (s: string) => parseInt(s.split("-")[1] ?? s) || 0;
  const words = (s: string) => s.replace("-", " to ");
  const biggest = (shores: Record<string, [string, string]>) => Object.values(shores).reduce((a, b) => (hi(b[0]) > hi(a[0]) ? b : a));
  let parts: string[];
  if (island === "hawaii") {
    const side = (re: RegExp) => { const z = Object.entries(zones).find(([k]) => re.test(k)); return z ? biggest(z[1]) : undefined; };
    const hilo = side(/windward/i), kona = side(/leeward/i);
    parts = [hilo && `${words(hilo[0])} feet on the Hilo side`, kona && `${words(kona[0])} on the Kona side`].filter((s): s is string => !!s);
  } else {
    // Group shores that share a forecast: "2 to 4 feet on south and east shores, 0 to 2 on north and west shores."
    const shores = Object.values(zones)[0] ?? {};
    const groups = new Map<string, string[]>();
    for (const [shore, [today]] of Object.entries(shores)) groups.set(today, [...(groups.get(today) ?? []), shore.toLowerCase()]);
    parts = [...groups.entries()].sort((a, b) => hi(b[0]) - hi(a[0])).slice(0, 2).map(([rng, ss], k) => `${words(rng)}${k ? "" : " feet"} on ${ss.join(" and ")} shores`);
  }
  if (!parts.length) return "";
  const all = Object.values(zones).flatMap((z) => Object.values(z));
  const today = Math.max(...all.map((r) => hi(r[0]))), tomorrow = Math.max(...all.map((r) => hi(r[1])));
  const trend = tomorrow - today >= 2 ? " Bigger tomorrow." : today - tomorrow >= 2 ? " Smaller tomorrow." : " About the same tomorrow.";
  return `Waves ${parts.join(", ")}.${trend}`;
}

/** The monitor the Air card speaks for: the town's own, else the island's worst. Never call it empty. */
const airFor = (air: Weather["air"], townName: string) =>
  air.find((a) => a.name === townName || townName.startsWith(a.name)) ?? air.reduce((a, b) => (rank(b.cat) > rank(a.cat) ? b : a));

/** Air in EPA words for the town's monitor (or the island when there is none nearby). */
function airSentence(air: Weather["air"], townName: string, island: Island): string {
  const m = airFor(air, townName);
  const here = m.name === townName || townName.startsWith(m.name);
  const place = here || rank(m.cat) > 0 ? `in ${m.name}` : `across ${ISLAND_LABEL[island].split(" · ")[0]}`;
  const what = island === "hawaii" ? "Vog" : "Air";
  switch (rank(m.cat)) {
    case 0: return `Air is good ${place}.`;
    case 1: return `Air is okay ${place}.`;
    case 2: return `${what} is bad for people with asthma ${place} today. Stay inside if it bothers you.`;
    default: return `Air is unhealthy for everyone ${place} today. Stay inside and skip hard exercise.`;
  }
}
const rank = (cat: string) => (/good/i.test(cat) ? 0 : /moderate/i.test(cat) ? 1 : /sensitive/i.test(cat) ? 2 : 3);
