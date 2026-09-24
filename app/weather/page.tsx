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
import { dropSuperseded, foldPins } from "@/lib/feed";
import { TOWNS } from "@/lib/towns";
import { clock, condWord, conditionCode, feelsLike, nowAndLater, sunTimes } from "@/lib/summary";
import { LEVEL_WORD, dirWord, plainAlert, stormLine, type Plain } from "@/lib/plain";
import { ISLAND_POINTS, type StormsSnapshot } from "@/lib/storm";
import { ISLAND_LABEL, fmtClock, fmtTime } from "@/lib/brand";
import "./weather.css";

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

  // The title row: "Right now" with the town picker beside it — a native <select> behind a white
  // rounded-rect button, so iPhones get their wheel.
  const title = !d || !town ? "Weather" : (
    <span className="flex items-center justify-between gap-3">
      <span>Right now</span>
      <label className="cs-island">
        <Icon name="navigation-arrow" size={15} /> {town.name} <Icon name="caret-down" size={13} />
        <select aria-label="Town" value={town.id} onChange={(e) => setTownId(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
          {d.towns.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
    </span>
  );

  // Official weather items worth a "heads up" (level 2) and an approaching storm, if any.
  // The agencies reissue rather than edit, so the same advisory for the same shores arrives again
  // under a new id — three High Surf pills, two of them word-for-word identical. The feed already
  // drops the superseded copies; this page was reading the raw list.
  const weatherItems = dropSuperseded(snap?.data?.items ?? []).filter((i) => i.tier !== "community" && (i.type === "advisory" || i.type === "storm"));
  const plain = new Map(weatherItems.map((i) => [i.key, plainAlert(i, now, island)] as [string, Plain]));
  const headsUp = weatherItems.filter((i) => plain.get(i.key)!.level === 2);
  // Level 3 and up had a pill and nothing else on this page: no body text, no "Read it on their
  // site", no share, and — before the pill carried it — no action either. They are the items most
  // worth reading in full, so they get the row that level 2 has always had.
  const warnings = weatherItems.filter((i) => plain.get(i.key)!.level >= 3);
  // Watches and warnings in effect, as the Now hero's rows: one per KIND (a Hurricane Watch arrives
  // as one item per forecast zone), the zones behind "See the list". Level 2 and up; worst first.
  const alerts = foldPins(weatherItems.filter((i) => plain.get(i.key)!.level >= 2), plain, island, now);
  const alertLevel = alerts[0]?.level ?? 0;
  // The foot pills count kinds, as the Now hero does: one Hurricane Watch, not eight zones of it.
  const nWarn = alerts.filter((g) => g.level >= 3).length, nHeads = alerts.filter((g) => g.level === 2).length;
  // The rain map opens by itself when there is a weather alert or rain is likely soon; otherwise it is one tap away.
  const rainSoon = !!h && (h.p.slice(0, 6).some((pp) => pp >= 40) || h.c.slice(0, 3).some((c) => c >= 5 && c <= 7));
  const [radarTap, setRadarTap] = useState(0);
  // The "Rain radar" button on the Right now card opens the radar in place, further down the page.
  useEffect(() => { if (radarTap) document.getElementById("radar")?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [radarTap]);
  const storm = (stormsSnap?.data?.storms ?? []).map((s) => stormLine(s, ISLAND_POINTS[island])).find((l) => l.approaching && l.level >= 3);
  // The surf card is one sentence, and that sentence comes out empty on feeds whose zone names it
  // cannot read. Build it once: what the chip offers and what the card holds are then the same thing.
  const surfLine = d?.surf ? surfSentence(d.surf.zones, island) : "";
  const air = d && d.air.length > 0 && town ? airFor(d.air, town.name) : undefined;
  const airLevel = air ? rank(air.cat) : 0;

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
  ], { clearOn: `${alertLevel}-${storm?.level ?? 0}-${airLevel}` });
  const radarOn = show("radar") && !!TILES && online && !!meta;
  const islandName = ISLAND_LABEL[island].split(" · ")[0];

  return (
    <PageShell title={title} island={island} onIsland={setIsland} fetchedAt={d ? w?.fetchedAt : undefined} gen={d?.upd} offline={w?.offline} source="the National Weather Service">
      <div className="cs-stack pg-weather">
      {!d && (w || slow
        ? <section className="cs-card"><EmptyState kind="error" title="Can't load right now." onRetry={() => window.dispatchEvent(new Event("online"))}>Try again when you have signal. In an emergency call 911.</EmptyState></section>
        : <p className="cs-body cs-flat">Loading the weather…</p>)}

      {/*
        Only the weather cards wait on `d`. The pills, the storm line and "Heads up" come from the
        feed and storms.json, which fail on their own schedule — a dead weather.json used to take a
        live Tsunami Warning off the screen with it. `h` and `meta` gate the two things that
        genuinely need them (the hourly readings, and anything needing coordinates), not the page.
      */}
      {d && town && <RightNow town={town} h={h} meta={meta} now={now} onRadar={radarOn ? () => setRadarTap((n) => n + 1) : undefined} />}
      {d && !town && (
        <section className="cs-card">
          <EmptyState kind="error" title="No town weather for this island right now.">Any alerts still show below. In an emergency call 911.</EmptyState>
        </section>
      )}

      {alerts.length > 0 && (
        <section className={`cs-card cs-hero ${alertLevel >= 4 ? "cs-hero--danger" : "cs-hero--warn"}`} aria-label="Watches and warnings">
          <h2 className="cs-display cs-display--hero">Watches and warnings</h2>
          <p className="cs-body cs-body--hero">In effect for {islandName} right now.</p>
          <div className="cs-pins">
            {alerts.map((g) => {
              // "Heads up" is level 2 EXACTLY; everything above it is in the warnings block.
              const anchor = g.level >= 3 ? "#warnings" : "#heads-up";
              const lone = g.items.length === 1;
              const body = (
                <>
                  <span className={`cs-ictile ${g.level >= 3 ? "cs-ictile--danger" : "cs-ictile--warn"}`}><Icon name="warning-fill" size={18} /></span>
                  <span className="cs-pin-main">
                    <span className="cs-pin-h">{g.headline}</span>
                    {g.action && <span className="cs-pin-a">{g.action}</span>}
                    {!lone && <span className="cs-pin-more">See the list <Icon name="caret-down" size={13} /></span>}
                  </span>
                  {lone && <Icon name="caret-right" size={16} className="cs-pin-go" />}
                </>
              );
              if (lone) return <a key={g.key} href={anchor} className="cs-pin">{body}</a>;
              return (
                <details key={g.key} className="cs-pin">
                  <summary>{body}</summary>
                  <ul className="cs-pin-list">{g.items.map((i) => <li key={i.key}><a href={anchor}>{plain.get(i.key)!.headline}</a></li>)}</ul>
                </details>
              );
            })}
          </div>
          <div className="cs-pills">
            {nWarn > 0 && <span className="cs-pill cs-pill--danger"><Icon name="siren" size={13} />{nWarn} {nWarn === 1 ? "warning" : "warnings"}</span>}
            {nHeads > 0 && <span className="cs-pill cs-pill--warn"><Icon name="warning" size={13} />{nHeads} heads up</span>}
          </div>
        </section>
      )}

      {d && town && bar}

      {storm && (
        <Link href="/storms/" className="cs-card t-storms wx-storm" aria-label={storm.text}>
          <span className="cs-tophead">
            <span className="cs-ictile cs-ictile--lg"><Icon name="wind-fill" size={20} /></span>
            <span className="cs-tophead-t">
              <span className="cs-label">Storm</span>
              <span className="wx-storm-text">{storm.text}</span>
            </span>
            <Icon name="caret-right" size={16} className="wx-storm-go" aria-hidden />
          </span>
        </Link>
      )}

      {d && town && (
        <>
          {radarOn && meta && (alerts.length > 0 || rainSoon || radarTap > 0 || only === "radar") && (
            <div id="radar" className="wx-radar-wrap scroll-mt-s4">
              <RadarMap lat={meta.lat} lon={meta.lon} label={`Rain radar around ${town.name}: blue where it is raining now`} />
            </div>
          )}

          {show("hourly") && h && h.t.length > 0 && (
            <section className="cs-card t-weather" aria-label="Hourly">
              <div className="cs-tophead">
                <span className="cs-ictile cs-ictile--lg"><Icon name="cloud-sun" size={20} /></span>
                <span className="cs-tophead-t">
                  <span className="cs-label">Hourly</span>
                  <h2 className="cs-display cs-display--card">Next {Math.round(h.t.length / 12) * 12} hours</h2>
                </span>
              </div>
              <p className="cs-body num">{nowAndLater(obsCode(town, now), h)} {trendSentence(h)} {sunLine(meta, now)}</p>
              <HourlyChart h={h} />
            </section>
          )}

          {show("forecast") && town.fc.length > 0 && (
            <section className="cs-card t-weather" aria-label="Forecast">
              <div className="cs-tophead">
                <span className="cs-ictile cs-ictile--lg"><Icon name="cloud-sun" size={20} /></span>
                <span className="cs-tophead-t">
                  <span className="cs-label">Forecast</span>
                  <h2 className="cs-display cs-display--card">{daysTitle(town.fc)}</h2>
                </span>
              </div>
              <p className="cs-body">{weekSentence(town.fc)}</p>
              <DailyRows fc={town.fc} />
            </section>
          )}

          {show("surf") && surfLine && d.surf && (
            <section className="cs-card t-tsunami" aria-label="Surf">
              <div className="cs-tophead">
                <span className="cs-ictile cs-ictile--lg"><Icon name="waves" size={20} /></span>
                <span className="cs-tophead-t">
                  <span className="cs-label">Surf</span>
                  <h2 className="cs-display cs-display--card">Waves today</h2>
                </span>
              </div>
              <p className="cs-body">{surfLine}</p>
              <div className="cs-grid2">
                {/* One short label per cell, as on Now: today and tomorrow are two cells, not one wrapped line. */}
                {surfSides(d.surf.zones, island).flatMap((s) => [
                  <p key={s.side}><Icon name="waves" size={18} /><b>{s.today} ft</b><span>{s.side}</span></p>,
                  <p key={`${s.side}-tomorrow`}><Icon name="waves" size={18} /><b>{s.tomorrow} ft</b><span>{s.side.replace(/ (side|shore)$/i, "")} tomorrow</span></p>,
                ])}
                {d.buoys[0] && <p><Icon name="navigation-arrow" size={18} /><b>{d.buoys[0].hFt} ft</b><span>{d.buoys[0].name} buoy · {d.buoys[0].perS} s</span></p>}
                {d.surf.uv && <p><Icon name="sun-horizon" size={18} /><b>{d.surf.uv} high</b><span>UV today</span></p>}
              </div>
            </section>
          )}

          {show("tides") && tideLive && (
            <section className="cs-card t-tsunami" aria-label="Tides">
              <div className="cs-tophead">
                <span className="cs-ictile cs-ictile--lg"><Icon name="waves" size={20} /></span>
                <span className="cs-tophead-t">
                  <span className="cs-label">Tides</span>
                  <h2 className="cs-display cs-display--card">High and low at {tideLive.name}</h2>
                </span>
              </div>
              <TideChart tide={tideLive} />
            </section>
          )}

          {show("air", airLevel >= 2) && air && (
            <section className={`cs-card ${island === "hawaii" ? "t-volcano" : "t-weather"}`} aria-label="Air">
              <div className="cs-tophead">
                <span className="cs-ictile cs-ictile--lg"><Icon name={island === "hawaii" ? "mountains" : "wind"} size={20} /></span>
                <span className="cs-tophead-t">
                  <span className="cs-label">Air</span>
                  <h2 className="cs-display cs-display--card">{airWord(air.cat, island)} in {air.name}</h2>
                </span>
              </div>
              <p className="cs-body">{airSentence(d.air, town.name, island)}</p>
              <div className="cs-grid2">
                {d.air.map((m) => <p key={m.name}><Icon name={island === "hawaii" ? "mountains" : "wind"} size={18} /><b>{m.pm25}</b><span>{m.name} · {m.cat.toLowerCase()}</span></p>)}
                <p><Icon name="question" size={18} /><b>PM2.5</b><span>fine particles, µg/m³</span></p>
              </div>
              {island === "hawaii" && (
                <div className="cs-foot">
                  <span className="cs-foot-note">Read {fmtClock(air.at, now)}</span>
                  <Link href="/volcano/" className="cs-btn-ink">Vog details</Link>
                </div>
              )}
            </section>
          )}
        </>
      )}

      {warnings.length > 0 && (
        <section id="warnings" className="cs-card t-weather scroll-mt-s4" aria-label="What the agency said">
          <div className="cs-tophead">
            <span className={`cs-ictile cs-ictile--lg ${Math.max(...warnings.map((i) => plain.get(i.key)!.level)) >= 4 ? "cs-ictile--danger" : "cs-ictile--warn"}`}><Icon name="warning-fill" size={20} /></span>
            <span className="cs-tophead-t">
              <span className="cs-label">{LEVEL_WORD[Math.max(...warnings.map((i) => plain.get(i.key)!.level))]}</span>
              <h2 className="cs-display cs-display--card">What the agency said</h2>
            </span>
          </div>
          <p className="cs-body">What the agency said, in full.</p>
          <ul className="cs-rows">{warnings.map((i) => <ItemRow key={i.key} item={i} now={now} showSource={new Set(warnings.map((x) => x.source)).size > 1} />)}</ul>
        </section>
      )}

      {headsUp.length > 0 && (
        <section id="heads-up" className="cs-card t-weather scroll-mt-s4" aria-label="Heads up">
          <div className="cs-tophead">
            <span className="cs-ictile cs-ictile--lg"><Icon name="warning" size={20} /></span>
            <span className="cs-tophead-t">
              <span className="cs-label">Heads up</span>
              <h2 className="cs-display cs-display--card">Good to know</h2>
            </span>
          </div>
          <p className="cs-body">Nothing dangerous, but good to know.</p>
          <ul className="cs-rows">{headsUp.map((i) => <ItemRow key={i.key} item={i} now={now} showSource={new Set(headsUp.map((x) => x.source)).size > 1} />)}</ul>
        </section>
      )}
      </div>
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
 * The reading, in the Now card's language: the well with the big temperature, the sky word and
 * high/low beside the picture; the sentence; a stat grid; a footer bar with the sun times and the
 * radar button. Every reading is optional — an hourly block can be absent or empty, and a town the
 * feed ships but this build's TOWNS list lacks has no coordinates — so each cell is dropped rather
 * than guessed at. A fabricated "Clear" is worse than a missing word.
 */
function RightNow({ town, h, meta, now, onRadar }: { town: TownWx; h?: Hourly; meta?: { lat: number; lon: number }; now: number; onRadar?: () => void }) {
  const fresh = obsFresh(town, now);
  const code = obsCode(town, now) ?? h?.c[0];
  const night = !!h?.n[0];
  const temp = (fresh ? town.obs?.f : undefined) ?? h?.t[0];
  const rh = (fresh ? town.obs?.rh : undefined) ?? h?.rh[0];
  const fl = temp != null && rh != null ? feelsLike(temp, rh) : undefined;
  const hi = town.fc.find((p) => p.day)?.t, lo = town.fc.find((p) => !p.day)?.t;
  const mph = (fresh ? town.obs?.wMph : undefined) ?? h?.w[0];
  const deg = fresh && town.obs?.wDir != null ? town.obs.wDir : h?.wd[0] != null ? h.wd[0] * 22.5 : undefined;
  const sun = meta ? sunTimes(dayStartHST(now), meta.lat, meta.lon) : undefined;
  const cells = fl != null || mph != null || rh != null || !!sun;
  return (
    <section className="cs-card t-weather" aria-label={`${town.name} right now`}>
      <div className="cs-well cs-wx cs-wx--lg">
        <span className="cs-wx-t">
          <span className="cs-temp">{temp != null ? `${temp}°` : "—"}</span>
          {code != null && <span className="cs-wx-cond">{condWord(code)}</span>}
          {hi != null && lo != null && <span className="cs-wx-hilo">High {hi}° · Low {lo}°</span>}
        </span>
        {code != null && <ConditionIcon code={code} night={night} size={96} className="cs-wx-pic" />}
      </div>
      {h && <p className="cs-body num">{nowAndLater(obsCode(town, now), h)} {trendSentence(h)}</p>}
      {cells && (
        <div className="cs-grid2">
          {fl != null && <p><Icon name="thermometer" size={18} /><b>{fl}°</b><span>feels like</span></p>}
          {mph != null && <p><Icon name="wind" size={18} /><b>{mph < 4 ? "Calm" : `${mph} mph`}</b><span>{mph < 4 || deg == null ? "wind" : `from the ${dirWord(deg)}`}</span></p>}
          {rh != null && <p><Icon name="drop-fill" size={18} /><b>{rh}%</b><span>humidity</span></p>}
          {sun && <p><Icon name="sun-horizon" size={18} /><b>{night ? fmtTime(sun.rise) : fmtTime(sun.set)}</b><span>{night ? "sunrise" : "sunset"}</span></p>}
        </div>
      )}
      {(sun || onRadar) && (
        <div className="cs-foot">
          {sun && <span className="cs-foot-note">Sunrise {fmtTime(sun.rise)} · Sunset {fmtTime(sun.set)}</span>}
          {onRadar && <button type="button" className="cs-btn-ink" onClick={onRadar}><Icon name="drop" size={16} /> Rain radar</button>}
        </div>
      )}
    </section>
  );
}

/** The sides of the island the surf forecast names, biggest shore of each, today and tomorrow. */
function surfSides(zones: Record<string, Record<string, [string, string]>>, island: Island) {
  const hi = (s: string) => parseInt(s.split("-")[1] ?? s) || 0;
  const dash = (s: string) => s.replace("-", "–");
  const biggest = (shores: Record<string, [string, string]>) => Object.values(shores).reduce((a, b) => (hi(b[0]) > hi(a[0]) ? b : a));
  if (island === "hawaii") {
    const side = (re: RegExp, label: string) => { const z = Object.entries(zones).find(([k]) => re.test(k)); return z && Object.keys(z[1]).length ? { side: label, today: dash(biggest(z[1])[0]), tomorrow: dash(biggest(z[1])[1]) } : undefined; };
    return [side(/windward/i, "Hilo side"), side(/leeward/i, "Kona side")].filter((s): s is NonNullable<typeof s> => !!s);
  }
  return Object.entries(Object.values(zones)[0] ?? {}).map(([shore, [today, tomorrow]]) => ({ side: `${shore} shore`, today: dash(today), tomorrow: dash(tomorrow) }));
}

const airWord = (cat: string, island: Island) => ["Air is good", "Air is okay", island === "hawaii" ? "Vog today" : "Air is poor", "Air is unhealthy"][rank(cat)];

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
