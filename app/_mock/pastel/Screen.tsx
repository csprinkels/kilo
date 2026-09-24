"use client";
import Link from "next/link";
import Icon from "@/components/Icon";
import Wordmark from "@/components/Wordmark";
import StormMap from "@/components/StormMap";
import ConditionIcon from "@/components/ConditionIcon";
import MiniMap from "@/components/MiniMap";
import F from "../_fixture.json";
import "./pastel.css";

/* Pastel — the synthesis. Timeline spine from A, card layering + hero foot from B, overview card from C. */

type Row = (typeof F.bands)[number]["rows"][number];
type Pin = (typeof F.pins)[number];

const TOPIC_ICON: Record<string, string> = {
  roads: "car", storms: "wind", quakes: "pulse", volcano: "mountains", tsunami: "waves", weather: "cloud-sun", reports: "megaphone",
};
const PIN_ICON: Record<string, string> = { storm: "wind", shelter: "tent", school: "student", outage: "drop", advisory: "warning" };
const HREF: Record<string, string> = {
  roads: "/traffic/", storms: "/storms/", quakes: "/quakes/", volcano: "/volcano/", tsunami: "/tsunami/", weather: "/weather/", reports: "/report/",
};
/** [singular, plural] for the folded "N more …" rows. */
const MORE_WORD: Record<string, [string, string]> = {
  roads: ["road closure", "road closures"], storms: ["storm", "storms"], quakes: ["earthquake", "earthquakes"], volcano: ["volcano notice", "volcano notices"],
  tsunami: ["ocean notice", "ocean notices"], weather: ["weather notice", "weather notices"], reports: ["notice", "notices"],
};
const TABS = [
  { label: "Now", icon: "house", on: true },
  { label: "Weather", icon: "cloud-sun" },
  { label: "Roads", icon: "car" },
  { label: "Reports", icon: "users-three" },
];

const away = (href: string) => href.startsWith("http");
const ext = (href: string) => (away(href) ? { target: "_blank", rel: "noreferrer" } : {});

export default function Screen() {
  const band = F.bands[0];
  const rows = [...band.rows].sort((a, b) => b.at - a.at);
  const folded = band.folded as Record<string, number>;
  const warnings = F.pins.filter((p) => p.level >= 3).length;
  const headsUp = F.pins.filter((p) => p.level === 2).length;
  // "storm|Hurricane Watch" — the watch word the pin already carries.
  const watch = F.pins.find((p) => p.type === "storm")?.key.split("|")[1];
  // "…could start Fri 7 PM." — the time is literally in the fixture's sentence.
  const windsAt = /start (.+?)\./.exec(F.storm.text)?.[1];

  return (
    <div className="pz">
      <header className="pz-top">
        <Wordmark className="pz-mark" />
        <button type="button" className="pz-island"><Icon name="map-pin" size={15} />{F.island}<Icon name="caret-down" size={13} /></button>
      </header>
      <p className="pz-fresh"><span className="pz-fresh-dot" />{F.checked}</p>

      {/* ── hero: the one raised ground; pins as white inner sub-cards; foot pills count the levels ── */}
      {/* the hero: warm filled card, the pins as rows inside one white block, counts as foot pills */}
      <section className="pz-hero" aria-label="What matters now">
        <h1 className="pz-hero-h">{F.story.title}</h1>
        <p className="pz-hero-sub">{F.story.sub}</p>
        <div className="pz-inner pz-pins">
          {F.pins.map((p) => <PinRow key={p.key} pin={p} />)}
        </div>
        <div className="pz-pills">
          <span className="pz-pill pz-pill--danger"><Icon name="siren" size={13} />{warnings} warnings</span>
          <span className="pz-pill pz-pill--warn"><Icon name="warning" size={13} />{headsUp} heads up</span>
        </div>
      </section>


      <label className="pz-ask">
        <Icon name="question" size={20} />
        <input type="search" placeholder="Is Saddle Road open?" aria-label="Ask ʻIo" />
      </label>

      <div className="pz-chips" role="group" aria-label="Filter the feed">
        <button type="button" className="pz-chip is-on" aria-pressed="true">All</button>
        {F.chips.map((c) => <button key={c.id} type="button" className="pz-chip" aria-pressed="false">{c.label}</button>)}
      </div>

      {/* ── storm: the compact info card — map, icon+value rows on dotted dividers, one dark pill in the foot ── */}
      <section className="pz-card pz-topic t-storms" aria-label={F.storm.text}>
        <div className="pz-topic-head">
          <span className="pz-tile pz-tile--lg"><Icon name="wind" size={20} /></span>
          <span className="pz-topic-t">
            <span className="cs-label pz-label">{F.storm.label}</span>
            <span className="pz-h2">{F.storm.name}</span>
          </span>
        </div>
        <p className="pz-topic-text">{F.storm.text}</p>
        <div className="pz-inner pz-figure"><StormMap storm={F.storm.storm as never} place={F.storm.place} compact /></div>
        <div className="pz-grid">
          {windsAt && <p><Icon name="warning" size={18} /><b>{windsAt}</b><span>winds could start</span></p>}
          <p><Icon name="wind" size={18} /><b>{F.storm.storm.windKt} kt</b><span>at storm centre</span></p>
          {watch && <p><Icon name="siren" size={18} /><b>{watch}</b></p>}
          <p><Icon name="warning-fill" size={18} /><b>Advisory {F.storm.storm.advNum}</b><span>latest</span></p>
        </div>
        <div className="pz-foot">
          <span className="pz-foot-note">{F.storm.name}</span>
          <Link href="/storms/" className="pz-btn-ink">Storm page</Link>
        </div>
      </section>

      {/* ── weather: sky card, temperature and the condition picture side by side in the white sub-card ── */}
      <section className="pz-card pz-topic t-weather" aria-label={`${F.weather.temp}° ${F.weather.cond} in ${F.weather.town}`}>
        <div className="pz-topic-head">
          <span className="pz-tile pz-tile--lg"><Icon name="cloud-sun" size={20} /></span>
          <span className="pz-topic-t">
            <span className="cs-label pz-label">Weather</span>
            <span className="pz-h2">{F.weather.town}</span>
          </span>
        </div>
        <div className="pz-inner pz-wx">
          <span className="pz-wx-t">
            <span className="pz-temp">{F.weather.temp}°</span>
            <span className="pz-wx-cond">{F.weather.cond}</span>
          </span>
          <ConditionIcon code={F.weather.code} night={F.weather.night} size={64} className="pz-wx-pic" />
        </div>
        <p className="pz-topic-text">{F.weather.later}</p>
        <div className="pz-grid">
          <p><Icon name="cloud-sun" size={18} /><b>{F.weather.hi}°</b><span>high today</span></p>
          <p><Icon name="drop" size={18} /><b>{F.weather.lo}°</b><span>low tonight</span></p>
          {F.weather.rh != null && <p><Icon name="drop-fill" size={18} /><b>{F.weather.rh}%</b><span>humidity</span></p>}
          {F.weather.windMph != null && <p><Icon name="wind" size={18} /><b>{F.weather.windMph ? `${F.weather.windMph} mph` : "Calm"}</b><span>wind</span></p>}
        </div>
        <div className="pz-foot">
          <span className="pz-foot-note">{F.weather.night ? `Sunrise ${F.weather.sunrise}` : `Sunset ${F.weather.sunset}`}</span>
          <Link href="/weather/" className="pz-btn-ink">Weather page</Link>
        </div>
      </section>

      {/* ── the feed: hairline rows, one chip per event with its time on the title line, quiet "more" rows ── */}
      <section className="pz-tl" aria-label={band.label}>
        <div className="pz-tl-head">
          <p className="cs-label pz-label">{band.label}</p>
          <span className="pz-pill pz-pill--ink">{rows.length}</span>
        </div>
        <ol className="pz-tl-list">
          {rows.map((r) => <li key={r.key} className="pz-tl-row"><FeedEntry row={r} /></li>)}
          {Object.entries(folded).map(([topic, n]) => (
            <li key={topic} className="pz-tl-row pz-tl-quiet">
              <Link href={HREF[topic] ?? "/"} className="pz-more">
                <span>{n} more {MORE_WORD[topic]?.[n === 1 ? 0 : 1] ?? "of these"}</span><Icon name="caret-right" size={14} />
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {/* ── warnings on this phone: the app's real copy, a recessed footer bar with one dark pill ── */}
      <section className="pz-card pz-push" aria-label="Warnings on this phone">
        <div className="pz-push-head">
          <span className="pz-tile pz-tile--ink"><Icon name="bell" size={18} /></span>
          <div>
            <h2>Warnings on this phone</h2>
            <p>Get shelter openings, evacuations and warnings for {F.island} as notifications. The whole message is in the notification, so you can read it with no signal.</p>
          </div>
        </div>
        <div className="pz-foot">
          <button type="button" className="pz-btn-quiet">Not now</button>
          <button type="button" className="pz-btn-ink">Turn on</button>
        </div>
      </section>

      <Link href="/sources/" className="pz-settings">
        <span className="pz-tile pz-tile--ink"><Icon name="gear" size={18} /></span>
        <span className="pz-settings-t">Settings and about</span>
        <Icon name="caret-right" size={16} />
      </Link>
      <footer className="pz-footer">Free. No ads. No account. Not an emergency service — call 911.</footer>

      <nav className="pz-dock" aria-label="Sections">
        {TABS.map((t) => (
          <span key={t.label} className={`pz-dock-tab ${t.on ? "is-on" : ""}`} aria-current={t.on ? "page" : undefined}>
            <Icon name={t.on ? `${t.icon}-fill` : t.icon} size={22} px />
            <span>{t.label}</span>
          </span>
        ))}
      </nav>
    </div>
  );
}

function PinRow({ pin }: { pin: Pin }) {
  const group = pin.members.length > 1;
  const body = (
    <>
      <span className={`pz-tile ${pin.level >= 3 ? "pz-tile--danger" : "pz-tile--warn"}`}><Icon name={PIN_ICON[pin.type] ?? "warning"} size={18} /></span>
      <span className="pz-pin-main">
        <span className="pz-pin-h">{pin.headline}{away(pin.href) && !group && <Icon name="arrow-square-out" size={13} className="pz-away" />}</span>
        <span className="pz-pin-a">{pin.action}</span>
        {group && <span className="pz-pin-more">See the list <Icon name="caret-down" size={13} /></span>}
      </span>
      {!group && <Icon name="caret-right" size={16} className="pz-pin-go" />}
    </>
  );
  if (!group) return <Link href={pin.href} {...ext(pin.href)} className="pz-pin">{body}</Link>;
  return (
    <details className="pz-pin pz-pin--group">
      <summary>{body}</summary>
      <ul className="pz-pin-list">
        {pin.members.map((m) => <li key={m.key}><Link href={m.href} {...ext(m.href)}>{m.headline}{away(m.href) && <Icon name="arrow-square-out" size={12} className="pz-away" />}</Link></li>)}
      </ul>
    </details>
  );
}

/** One shape for every entry: tile, headline with its time, sub-line, source, and a thumbnail when the thing has a position. */
function FeedEntry({ row }: { row: Row }) {
  const thumb = "mark" in row && row.mark ? <span className="pz-inner pz-thumb"><MiniMap island="hawaii" mark={row.mark as never} size={52} /></span> : null;
  const text = (
    <span className="pz-ev-main">
      <span className="pz-ev-hl"><span className="pz-ev-h">{row.headline}</span><span className="pz-ev-when">{row.when}</span></span>
      {row.sub && <span className="pz-ev-sub">{row.sub}</span>}
      <span className="pz-ev-meta">{row.source}{away(row.href) && <Icon name="arrow-square-out" size={12} className="pz-away" />}</span>
    </span>
  );
  const tile = <span className="pz-tile"><Icon name={TOPIC_ICON[row.topic] ?? "bell"} size={18} /></span>;
  return (
    <Link href={row.href} {...ext(row.href)} className={`pz-ev t-${row.topic}`}>{tile}{text}{thumb}</Link>
  );
}
