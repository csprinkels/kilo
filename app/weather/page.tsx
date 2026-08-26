"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import PageShell from "@/components/PageShell";
import ConditionIcon from "@/components/ConditionIcon";
import HourlyChart from "@/components/HourlyChart";
import DailyRows, { rowsFromPeriods } from "@/components/DailyRows";
import ItemRow from "@/components/ItemRow";
import RadarMap from "@/components/RadarMap";
import EmptyState from "@/components/EmptyState";
import type { Hourly, Period, TownWx, Weather } from "@/lib/pages";
import type { Island } from "@/lib/types";
import { useFeed, useJson, useStoredIsland } from "@/lib/data";
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
  useEffect(() => { const t = setTimeout(() => setSlow(true), 30_000); return () => clearTimeout(t); }, []);

  const d = w?.data;
  const now = w?.fetchedAt ?? 0;
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
  const weatherItems = (snap?.data?.items ?? []).filter((i) => i.tier !== "community" && (i.type === "advisory" || i.type === "storm"));
  const headsUp = weatherItems.filter((i) => plainAlert(i, now, island).level === 2);
  // Watches and warnings in effect: the pill under the hero, like Acme's "Flood Watch". Level 2 and up; worst first.
  const alerts = weatherItems.map((i) => ({ i, p: plainAlert(i, now, island) })).filter((x) => x.p.level >= 2).sort((a, b) => b.p.level - a.p.level);
  // The rain map opens by itself when there is a weather alert or rain is likely soon; otherwise it is one tap away.
  const rainSoon = !!h && (h.p.slice(0, 6).some((pp) => pp >= 40) || h.c.slice(0, 3).some((c) => c >= 5 && c <= 7));
  const [showRadar, setShowRadar] = useState(false);
  const storm = (stormsSnap?.data?.storms ?? []).map((s) => stormLine(s, ISLAND_POINTS[island])).find((l) => l.approaching && l.level >= 3);

  return (
    <PageShell title={title} island={island} onIsland={setIsland} fetchedAt={w?.fetchedAt} gen={d?.upd} offline={w?.offline} source="the National Weather Service">
      {!d && (w || slow
        ? <section className="cs-card wx-flush mt-s3"><EmptyState kind="error" title="Can't load right now." onRetry={() => window.dispatchEvent(new Event("online"))}>Try again when you have signal. In an emergency call 911.</EmptyState></section>
        : <p className="cs-body mt-s3">Loading the weather…</p>)}

      {d && town && h && meta && (
        <>
          <RightNow town={town} meta={meta} now={now} />

          {alerts.map(({ i, p }) => (
            <a key={i.key} href="#heads-up" className={`cs-card wx-alert mt-s3 ${p.level >= 4 ? "wx-alert--danger" : p.level >= 3 ? "wx-alert--warn" : ""}`}>
              <span className={`cs-ictile ${p.level >= 4 ? "cs-ictile--brick" : p.level >= 3 ? "cs-ictile--amber" : ""}`}><Icon name="warning-fill" size={21} /></span>
              <p className="wx-alert-t">
                {p.level >= 3 ? <span className="wx-sev">{p.word ?? LEVEL_WORD[p.level]}:</span> : <>{p.word ?? LEVEL_WORD[p.level]}:</>} {p.headline}
              </p>
              <Icon name="caret-right" size={17} className="wx-caret" />
            </a>
          ))}

          {(alerts.length > 0 || rainSoon || showRadar)
            ? <RadarMap lat={meta.lat} lon={meta.lon} label={`Rain radar around ${town.name}: blue where it is raining now`} />
            : <button className="btn mt-s3" onClick={() => setShowRadar(true)}><Icon name="drop" size={18} /> See the rain radar</button>}
          {storm && (
            <section className="cs-card mt-s3">
              <div className="cs-heroline">
                <span className="cs-ictile"><Icon name="wind-fill" size={21} /></span>
                <p className="cs-title">{storm.text}</p>
              </div>
              <div className="cs-actions">
                <Link href="/storms/" className="cs-link wx-golink">See the storm <Icon name="caret-right" size={16} aria-hidden /></Link>
              </div>
            </section>
          )}

          <section className="cs-card mt-s3">
            <h2 className="cs-display cs-display--hero">Next 24 Hours</h2>
            <p className="cs-body num max-w-[36rem]">{nowAndLater(obsCode(town, now), h)} {trendSentence(h)} {sunLine(meta, now)}</p>
            <HourlyChart h={h} />
          </section>

          {town.fc.length > 0 && (
            <section className="cs-card mt-s3">
              <h2 className="cs-display cs-display--hero">{daysTitle(town.fc)}</h2>
              <p className="cs-body max-w-[36rem]">{weekSentence(town.fc)}</p>
              <DailyRows fc={town.fc} />
            </section>
          )}

          {d.surf && Object.keys(d.surf.zones).length > 0 && (
            <section className="cs-card mt-s3">
              <h2 className="cs-display cs-display--hero">Surf</h2>
              <p className="cs-body max-w-[36rem]">{surfSentence(d.surf.zones, island)}</p>
            </section>
          )}

          {d.air.length > 0 && (
            <section className="cs-card mt-s3">
              <h2 className="cs-display cs-display--hero">Air</h2>
              <p className="cs-body max-w-[36rem]">{airSentence(d.air, town.name, island)}</p>
              {island === "hawaii" && (
                <div className="cs-actions">
                  <Link href="/volcano/" className="cs-link wx-golink">Vog details <Icon name="caret-right" size={16} aria-hidden /></Link>
                </div>
              )}
            </section>
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
        </>
      )}
    </PageShell>
  );
}

const obsFresh = (town: TownWx, now: number) => !!town.obs && now - town.obs.at < 2 * HOUR;
/** The station's sky when its reading is fresh, else nothing (the forecast's first hour stands in). */
const obsCode = (town: TownWx, now: number) => (obsFresh(town, now) && town.obs?.sky ? conditionCode("", town.obs.sky) : undefined);
/** "Sunrise at 6:02 AM, sets at 6:44 PM." for today. */
function sunLine(meta: { lat: number; lon: number }, now: number) {
  const s = sunTimes(dayStartHST(now), meta.lat, meta.lon);
  return `Sunrise at ${fmtTime(s.rise)}, sets at ${fmtTime(s.set)}.`;
}

/** The weather picture: big icon, then the temperature, the sky word, high and low, and a "More" card with the rest. */
function RightNow({ town, meta, now }: { town: TownWx; meta: { lat: number; lon: number }; now: number }) {
  const [open, setOpen] = useState(false);
  const h = town.hourly!;
  const fresh = obsFresh(town, now);
  const code = obsCode(town, now) ?? h.c[0];
  const temp = (fresh ? town.obs?.f : undefined) ?? h.t[0];
  const rh = (fresh ? town.obs?.rh : undefined) ?? h.rh[0];
  const fl = temp != null && rh != null ? feelsLike(temp, rh) : undefined;
  const hi = town.fc.find((p) => p.day)?.t, lo = town.fc.find((p) => !p.day)?.t;
  const mph = (fresh ? town.obs?.wMph : undefined) ?? h.w[0];
  const deg = fresh && town.obs?.wDir != null ? town.obs.wDir : h.wd[0] * 22.5;
  const sun = sunTimes(dayStartHST(now), meta.lat, meta.lon);
  return (
    <>
      <section className="cs-card cs-hero mt-s3" aria-label={`${town.name} right now`}>
        <div className="wx-now">
          <ConditionIcon code={code} night={!!h.n[0]} size={164} className="wx-now-ic" />
          <div className="wx-now-read">
            <p className="cs-bignum cs-bignum--lg">{temp != null ? `${temp}°` : "—"}</p>
            <p className="wx-now-word">{condWord(code)}</p>
            {hi != null && lo != null && <p className="wx-now-hilo">High {hi}° Low {lo}°</p>}
            <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="wx-more">
              More <Icon name="caret-down" size={16} className={open ? "rotate-180" : ""} aria-hidden />
            </button>
          </div>
        </div>
      </section>
      {open && (
        <section className="cs-card mt-s3">
          <div className="cs-grid">
            {fl != null && <div className="cs-tile"><p className="wx-stat-v">Feels like {fl}°</p></div>}
            {mph != null && <div className="cs-tile"><p className="wx-stat-v">{mph < 4 ? "Almost no wind" : `Wind from the ${dirWord(deg)}, ${mph} mph`}</p></div>}
            {rh != null && <div className="cs-tile"><p className="wx-stat-v">Humidity {rh}%</p></div>}
            <div className="cs-tile"><p className="wx-stat-v">Sunrise {fmtTime(sun.rise)} · Sunset {fmtTime(sun.set)}</p></div>
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

/** Air in EPA words for the town's monitor (or the island when there is none nearby). */
function airSentence(air: Weather["air"], townName: string, island: Island): string {
  const here = air.find((a) => a.name === townName || townName.startsWith(a.name));
  const worst = air.reduce((a, b) => (rank(b.cat) > rank(a.cat) ? b : a));
  const m = here ?? worst;
  const place = here ? `in ${m.name}` : rank(worst.cat) === 0 ? `across ${ISLAND_LABEL[island].split(" · ")[0]}` : `in ${m.name}`;
  const what = island === "hawaii" ? "Vog" : "Air";
  switch (rank(m.cat)) {
    case 0: return `Air is good ${place}.`;
    case 1: return `Air is okay ${place}.`;
    case 2: return `${what} is bad for people with asthma ${place} today. Stay inside if it bothers you.`;
    default: return `Air is unhealthy for everyone ${place} today. Stay inside and skip hard exercise.`;
  }
}
const rank = (cat: string) => (/good/i.test(cat) ? 0 : /moderate/i.test(cat) ? 1 : /sensitive/i.test(cat) ? 2 : 3);
