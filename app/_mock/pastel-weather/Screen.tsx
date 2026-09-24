"use client";
import Link from "next/link";
import Icon from "@/components/Icon";
import Wordmark from "@/components/Wordmark";
import ConditionIcon from "@/components/ConditionIcon";
import HourlyChart from "@/components/HourlyChart";
import DailyRows, { rowsFromPeriods } from "@/components/DailyRows";
import type { Hourly, Period } from "@/lib/pages";
import { clock, condWord, conditionCode, feelsLike, nowAndLater, sunTimes } from "@/lib/summary";
import { dirWord } from "@/lib/plain";
import { fmtClock, fmtTime } from "@/lib/brand";
import F from "../_fixture-weather.json";
import "../pastel/pastel.css";
import "./weather.css";

/* Weather, in the Now page's language: white cards, accent tiles, stat grids with a footer bar. */

const HOUR = 3_600_000, DAY = 86_400_000;
const dayStartHST = (ms: number) => Math.floor((ms - 10 * HOUR) / DAY) * DAY + 10 * HOUR;
const TABS = [
  { label: "Now", icon: "house" },
  { label: "Weather", icon: "cloud-sun", on: true },
  { label: "Roads", icon: "car" },
  { label: "Reports", icon: "users-three" },
];
type Alert = (typeof F.alerts)[number];

export default function Screen() {
  const town = F.town, h = town.hourly as Hourly, fc = town.fc as Period[];
  const fresh = !!town.obs && F.now - town.obs.at < 2 * HOUR;
  const code = (fresh && town.obs?.sky ? conditionCode("", town.obs.sky) : undefined) ?? h.c[0];
  const temp = (fresh ? town.obs?.f : undefined) ?? h.t[0];
  const rh = (fresh ? town.obs?.rh : undefined) ?? h.rh[0];
  const fl = temp != null && rh != null ? feelsLike(temp, rh) : undefined;
  const hi = fc.find((p) => p.day)?.t, lo = fc.find((p) => !p.day)?.t;
  const mph = (fresh ? town.obs?.wMph : undefined) ?? h.w[0];
  const deg = fresh && town.obs?.wDir != null ? town.obs.wDir : h.wd[0] != null ? h.wd[0] * 22.5 : undefined;
  const sun = sunTimes(dayStartHST(F.now), F.meta.lat, F.meta.lon);
  const night = !!h.n[0];

  // The agencies send one alert per forecast zone; the page says each kind once, with the zones behind it.
  const groups = new Map<string, Alert[]>();
  for (const a of F.alerts) { const k = a.title.split(":")[0]; groups.set(k, [...(groups.get(k) ?? []), a]); }
  const alertRows = [...groups.entries()].map(([kind, list]) => ({ kind, list, lead: list[0] }));
  const warnings = alertRows.filter((r) => r.lead.level >= 3), headsUp = alertRows.filter((r) => r.lead.level === 2);

  const surf = F.surf ? surfSentence(F.surf.zones as unknown as Zones) : "";
  const buoy = F.buoys[0];
  const air = airFor(F.air, town.name);

  return (
    <div className="mock-pastel"><div className="pz">
      <header className="pz-top">
        <Wordmark className="pz-mark" />
        <button type="button" className="pz-island"><Icon name="map-pin" size={15} />{F.island}<Icon name="caret-down" size={13} /></button>
      </header>
      <p className="pz-fresh"><span className="pz-fresh-dot" />{F.checked}</p>

      {/* ── the town, then the reading: a stat grid and a footer bar like every other card ── */}
      <div className="pw-title">
        <h1 className="pz-hero-h">Right now</h1>
        <button type="button" className="pz-island"><Icon name="navigation-arrow" size={15} />{town.name}<Icon name="caret-down" size={13} /></button>
      </div>
      <section className="pz-card pz-topic t-weather" aria-label={`${town.name} right now`}>
        <div className="pz-inner pz-wx pw-wx">
          <span className="pz-wx-t">
            <span className="pz-temp pw-temp">{temp != null ? `${temp}°` : "—"}</span>
            <span className="pz-wx-cond">{condWord(code)}</span>
            {hi != null && lo != null && <span className="pw-hilo">High {hi}° · Low {lo}°</span>}
          </span>
          <ConditionIcon code={code} night={night} size={96} className="pz-wx-pic pw-pic" />
        </div>
        <p className="pz-topic-text">{nowAndLater(fresh ? code : undefined, h)} {trendSentence(h)}</p>
        <div className="pz-grid">
          {fl != null && <p><Icon name="cloud-sun" size={18} /><b>{fl}°</b><span>feels like</span></p>}
          {mph != null && <p><Icon name="wind" size={18} /><b>{mph < 4 ? "Calm" : `${mph} mph`}</b><span>{mph < 4 || deg == null ? "wind" : `from the ${dirWord(deg)}`}</span></p>}
          {rh != null && <p><Icon name="drop-fill" size={18} /><b>{rh}%</b><span>humidity</span></p>}
          <p><Icon name="lightbulb-filament" size={18} /><b>{night ? fmtTime(sun.rise) : fmtTime(sun.set)}</b><span>{night ? "sunrise" : "sunset"}</span></p>
        </div>
        <div className="pz-foot">
          <span className="pz-foot-note">Sunrise {fmtTime(sun.rise)} · Sunset {fmtTime(sun.set)}</span>
          <button type="button" className="pz-btn-ink"><Icon name="drop" size={16} /> Rain radar</button>
        </div>
      </section>

      {/* ── watches and warnings: the Now hero's shape, one row per kind ── */}
      {alertRows.length > 0 && (
        <section className="pz-hero" aria-label="Watches and warnings">
          <h2 className="pz-hero-h">Watches and warnings</h2>
          <p className="pz-hero-sub">In effect for {F.island} right now.</p>
          <div className="pz-inner pz-pins">
            {alertRows.map((r) => <AlertRow key={r.kind} list={r.list} />)}
          </div>
          <div className="pz-pills">
            {warnings.length > 0 && <span className="pz-pill pz-pill--danger"><Icon name="siren" size={13} />{warnings.length} {warnings.length === 1 ? "warning" : "warnings"}</span>}
            {headsUp.length > 0 && <span className="pz-pill pz-pill--warn"><Icon name="warning" size={13} />{headsUp.length} heads up</span>}
          </div>
        </section>
      )}

      <div className="pz-chips" role="group" aria-label="Filter this page">
        <button type="button" className="pz-chip is-on" aria-pressed="true">All</button>
        {["Radar", "Hourly", "Forecast", "Surf", "Air"].map((c) => <button key={c} type="button" className="pz-chip" aria-pressed="false">{c}</button>)}
      </div>

      {F.storm && (
        <Link href="/storms/" className="pz-card pz-topic t-storms pw-storm" aria-label={F.storm.text}>
          <span className="pz-tile pz-tile--lg"><Icon name="wind-fill" size={20} /></span>
          <span className="pw-storm-t">
            <span className="cs-label pz-label">Storm</span>
            <span className="pw-storm-text">{F.storm.text}</span>
          </span>
          <Icon name="caret-right" size={16} className="pw-storm-go" />
        </Link>
      )}

      {/* ── hourly ── */}
      <section className="pz-card pz-topic t-weather" aria-label="Hourly">
        <div className="pz-topic-head">
          <span className="pz-tile pz-tile--lg"><Icon name="cloud-sun" size={20} /></span>
          <span className="pz-topic-t">
            <span className="cs-label pz-label">Hourly</span>
            <span className="pz-h2">Next {Math.round(h.t.length / 12) * 12} hours</span>
          </span>
        </div>
        <p className="pz-topic-text">{trendSentence(h)} Sunrise at {fmtTime(sun.rise)}, sets at {fmtTime(sun.set)}.</p>
        <div className="pw-chart"><HourlyChart h={h} /></div>
      </section>

      {/* ── forecast ── */}
      <section className="pz-card pz-topic t-weather" aria-label="Forecast">
        <div className="pz-topic-head">
          <span className="pz-tile pz-tile--lg"><Icon name="cloud-sun" size={20} /></span>
          <span className="pz-topic-t">
            <span className="cs-label pz-label">Forecast</span>
            <span className="pz-h2">{daysTitle(fc)}</span>
          </span>
        </div>
        <p className="pz-topic-text">{weekSentence(fc)}</p>
        <div className="pw-days"><DailyRows fc={fc} /></div>
      </section>

      {/* ── surf ── */}
      {F.surf && surf && (
        <section className="pz-card pz-topic t-tsunami" aria-label="Surf">
          <div className="pz-topic-head">
            <span className="pz-tile pz-tile--lg"><Icon name="waves" size={20} /></span>
            <span className="pz-topic-t">
              <span className="cs-label pz-label">Surf</span>
              <span className="pz-h2">Waves today</span>
            </span>
          </div>
          <p className="pz-topic-text">{surf}</p>
          <div className="pz-grid">
            {sides(F.surf.zones as unknown as Zones).map((s) => <p key={s.side}><Icon name="waves" size={18} /><b>{s.today} ft</b><span>{s.side}, {s.tomorrow} ft tomorrow</span></p>)}
            {buoy && <p><Icon name="navigation-arrow" size={18} /><b>{buoy.hFt} ft</b><span>at the {buoy.name} buoy, every {buoy.perS} s</span></p>}
            {F.surf.uv && <p><Icon name="lightbulb-filament" size={18} /><b>{F.surf.uv} high</b><span>UV today</span></p>}
          </div>
        </section>
      )}

      {/* ── air ── */}
      {F.air.length > 0 && (
        <section className="pz-card pz-topic t-volcano" aria-label="Air">
          <div className="pz-topic-head">
            <span className="pz-tile pz-tile--lg"><Icon name="mountains" size={20} /></span>
            <span className="pz-topic-t">
              <span className="cs-label pz-label">Air</span>
              <span className="pz-h2">{airWord(air.cat)} in {air.name}</span>
            </span>
          </div>
          <p className="pz-topic-text">{airSentence(air, town.name)}</p>
          <div className="pz-grid">
            {F.air.map((m) => <p key={m.name}><Icon name="mountains" size={18} /><b>{m.pm25}</b><span>{m.name} · {m.cat.toLowerCase()}</span></p>)}
            <p><Icon name="question" size={18} /><b>PM2.5</b><span>fine particles, µg/m³</span></p>
          </div>
          <div className="pz-foot">
            <span className="pz-foot-note">Read {fmtClock(F.air[0].at, F.now)}</span>
            <Link href="/volcano/" className="pz-btn-ink">Vog details</Link>
          </div>
        </section>
      )}

      {/* ── what the agency said, in full ── */}
      {[{ id: "warnings", label: "Warning", title: "What the agency said", rows: warnings }, { id: "heads-up", label: "Heads up", title: "Good to know", rows: headsUp }].map((s) => s.rows.length > 0 && (
        <section key={s.id} id={s.id} className="pz-card pw-full" aria-label={s.title}>
          <div className="pw-full-head">
            <span className="cs-label pz-label">{s.label}</span>
            <h2 className="pz-h2">{s.title}</h2>
          </div>
          {s.rows.map(({ kind, list, lead }) => (
            <a key={kind} href={lead.srcUrl} target="_blank" rel="noreferrer" className="pw-full-row">
              <span className="pw-full-t">{lead.title}{list.length > 1 && <span className="pz-pill pw-zones">{list.length} zones</span>}</span>
              <span className="pw-full-b">{lead.body}</span>
              <span className="pw-full-m">{lead.source} · {fmtClock(lead.issuedAt, F.now)} <Icon name="arrow-square-out" size={12} className="pz-away" /></span>
            </a>
          ))}
        </section>
      ))}

      <footer className="pz-footer">Free. No ads. No account. Not an emergency service — call 911.</footer>

      <nav className="pz-dock" aria-label="Sections">
        {TABS.map((t) => (
          <span key={t.label} className={`pz-dock-tab ${t.on ? "is-on" : ""}`} aria-current={t.on ? "page" : undefined}>
            <Icon name={t.on ? `${t.icon}-fill` : t.icon} size={22} px />
            <span>{t.label}</span>
          </span>
        ))}
      </nav>
    </div></div>
  );
}

/** One kind of alert, said once; the zones it covers sit behind "See the list". */
function AlertRow({ list }: { list: Alert[] }) {
  const lead = list[0], group = list.length > 1;
  const headline = group ? lead.headline.replace(/ (in|on) [^.]+$/, ` on ${F.island}`) : lead.headline;
  const body = (
    <>
      <span className={`pz-tile ${lead.level >= 3 ? "pz-tile--danger" : "pz-tile--warn"}`}><Icon name="warning-fill" size={18} /></span>
      <span className="pz-pin-main">
        <span className="pz-pin-h">{headline}</span>
        <span className="pz-pin-a">{lead.action}</span>
        {group && <span className="pz-pin-more">See the list <Icon name="caret-down" size={13} /></span>}
      </span>
      {!group && <Icon name="caret-right" size={16} className="pz-pin-go" />}
    </>
  );
  if (!group) return <a href={`#${lead.level >= 3 ? "warnings" : "heads-up"}`} className="pz-pin">{body}</a>;
  return (
    <details className="pz-pin pz-pin--group">
      <summary>{body}</summary>
      <ul className="pz-pin-list">{list.map((a) => <li key={a.key}><a href="#warnings">{a.headline}</a></li>)}</ul>
    </details>
  );
}

// ── the sentences the real page builds, unchanged ──
function trendSentence(h: Hourly): string {
  const n = Math.min(24, h.t.length), t = h.t.slice(0, n);
  const iMax = t.indexOf(Math.max(...t)), iMin = t.indexOf(Math.min(...t));
  const at = (i: number) => clock(h.t0 + i * HOUR).replace("12 AM", "midnight").replace("12 PM", "noon");
  if (t[iMax] - t[iMin] < 4) return `Around ${t[0]}° all day.`;
  if (iMin === 0) return `Up to ${t[iMax]}° around ${at(iMax)}.`;
  if (iMax === 0) return `Down to ${t[iMin]}° around ${at(iMin)}.`;
  return iMin < iMax ? `Down to ${t[iMin]}° around ${at(iMin)}, then up to ${t[iMax]}° by ${at(iMax)}.` : `Up to ${t[iMax]}° around ${at(iMax)}, then down to ${t[iMin]}° by ${at(iMin)}.`;
}
const daysTitle = (fc: Period[]) => { const n = fc.filter((p) => p.day).length; return n >= 7 ? "Next 7 days" : n <= 1 ? "Today and tonight" : `Next ${n} days`; };
function weekSentence(fc: Period[]): string {
  const rows = rowsFromPeriods(fc);
  const highs = rows.map((r) => r.hi).filter((t): t is number => t != null);
  const name = (s: string) => (s === "Today" || s === "Tonight" ? s.toLowerCase() : s.replace(" Night", " night"));
  const warm = rows.find((r) => r.hi === Math.max(...highs));
  const heat = !highs.length ? "" : Math.max(...highs) - Math.min(...highs) < 2 ? `Highs around ${highs[0]}°.` : `Warmest ${name(warm!.name)}, ${warm!.hi}°.`;
  const later = rows.slice(1);
  const wet = later.find((r) => r.pop >= 60) ?? rows.find((r) => r.pop >= 60);
  const damp = later.find((r) => r.pop >= 40) ?? rows.find((r) => r.pop >= 40);
  const rain = wet ? `Rain likely ${name(wet.name)}.` : damp ? `Some showers ${name(damp.name)}.` : "Mostly dry.";
  return `${heat} ${rain}`.trim();
}
type Zones = Record<string, Record<string, [string, string]>>;
const hiFt = (s: string) => parseInt(s.split("-")[1] ?? s) || 0;
const words = (s: string) => s.replace("-", " to ");
const biggest = (shores: Record<string, [string, string]>) => Object.values(shores).reduce((a, b) => (hiFt(b[0]) > hiFt(a[0]) ? b : a));
/** The Hilo side and the Kona side, biggest shore of each, today and tomorrow. */
function sides(zones: Zones) {
  const side = (re: RegExp, label: string) => { const z = Object.entries(zones).find(([k]) => re.test(k)); return z ? { side: label, today: z[1] && biggest(z[1])[0].replace("-", "–"), tomorrow: biggest(z[1])[1].replace("-", "–") } : undefined; };
  return [side(/windward/i, "Hilo side"), side(/leeward/i, "Kona side")].filter((s): s is NonNullable<typeof s> => !!s);
}
function surfSentence(zones: Zones): string {
  const parts = sides(zones).map((s, k) => `${words(s.today.replace("–", "-"))}${k ? "" : " feet"} on the ${s.side}`);
  if (!parts.length) return "";
  const all = Object.values(zones).flatMap((z) => Object.values(z));
  const today = Math.max(...all.map((r) => hiFt(r[0]))), tomorrow = Math.max(...all.map((r) => hiFt(r[1])));
  const trend = tomorrow - today >= 2 ? " Bigger tomorrow." : today - tomorrow >= 2 ? " Smaller tomorrow." : " About the same tomorrow.";
  return `Waves ${parts.join(", ")}.${trend}`;
}
type Air = (typeof F.air)[number];
const rank = (cat: string) => (/good/i.test(cat) ? 0 : /moderate/i.test(cat) ? 1 : /sensitive/i.test(cat) ? 2 : 3);
const airFor = (air: Air[], townName: string) => air.find((a) => a.name === townName || townName.startsWith(a.name)) ?? air.reduce((a, b) => (rank(b.cat) > rank(a.cat) ? b : a));
const airWord = (cat: string) => ["Air is good", "Air is okay", "Vog today", "Air is unhealthy"][rank(cat)];
function airSentence(m: Air, townName: string): string {
  const here = m.name === townName || townName.startsWith(m.name);
  const place = here || rank(m.cat) > 0 ? `in ${m.name}` : `across ${F.island}`;
  switch (rank(m.cat)) {
    case 0: return `Air is good ${place}.`;
    case 1: return `Air is okay ${place}.`;
    case 2: return `Vog is bad for people with asthma ${place} today. Stay inside if it bothers you.`;
    default: return `Air is unhealthy for everyone ${place} today. Stay inside and skip hard exercise.`;
  }
}
