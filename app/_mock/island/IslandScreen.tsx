"use client";
import { CarFront, CloudSun, Home, Mountain, Tent, TrafficCone, Users, Waves, Wind, Activity } from "lucide-react";
import { MOCK } from "../_data";

const TABS = [
  { label: "Now", Icon: Home },
  { label: "Weather", Icon: CloudSun },
  { label: "Roads", Icon: CarFront },
  { label: "Neighbors", Icon: Users },
] as const;

export default function IslandScreen() {
  return (
    <>
      <header className="mock-kilo">
        <span className="word">Kilo</span>
        <span className="place">{MOCK.island}</span>
        <span className="gear">Settings</span>
      </header>
      <p className="mock-fresh">{MOCK.checked}</p>

      <h1 className="isl-story">A storm is coming Saturday night.</h1>
      <p className="isl-sub">Māmalahoa is still closed, and a shelter in Nāʻālehu is listed as open. Check that one before you go.</p>

      <div className="isl-stack">
        <article className="isl-card isl-storm" aria-label={MOCK.storm.headline}>
          <p className="isl-kicker"><span className="isl-bubble"><Wind aria-hidden /></span> {MOCK.storm.word}</p>
          <h2 className="isl-h">{MOCK.storm.headline}</h2>
          <p className="isl-p">{MOCK.storm.action}</p>
          <p className="isl-ready">{MOCK.storm.ready}</p>
          <div className="isl-map" aria-hidden>
            <StormSketch />
            <span className="isl-map-tag now">Two-C · now</span>
            <span className="isl-map-tag sat">Closest Sat night</span>
          </div>
        </article>

        <article className="isl-card isl-hot" aria-label={MOCK.shelter.headline}>
          <p className="isl-kicker"><span className="isl-bubble"><Tent aria-hidden /></span> {MOCK.shelter.word}</p>
          <h2 className="isl-h">{MOCK.shelter.headline}</h2>
          <p className="isl-p">{MOCK.shelter.action}</p>
          <p className="isl-note">{MOCK.shelter.stale}</p>
        </article>

        <article className="isl-card isl-road" aria-label="Roads">
          <p className="isl-kicker"><span className="isl-bubble"><TrafficCone aria-hidden /></span> Roads</p>
          <h2 className="isl-h">Māmalahoa Highway 190 is closed both ways in North Kona.</h2>
          <p className="isl-p">Not a great night to go that way. Tap for the map and the other 19 closures.</p>
          <p className="isl-more">19 more closures</p>
        </article>

        <article className="isl-card isl-wx" aria-label={`${MOCK.temp}° in ${MOCK.town}`}>
          <p className="isl-kicker"><span className="isl-bubble"><CloudSun aria-hidden /></span> Weather in {MOCK.town}</p>
          <div className="isl-wx-row">
            <p className="isl-deg">{MOCK.temp}°</p>
            <div>
              <p className="mock-strong" style={{ margin: 0 }}>{MOCK.condition}</p>
              <p className="isl-p" style={{ margin: "0.15rem 0 0" }}>Feels like {MOCK.feels}°. High {MOCK.hi}°, low {MOCK.lo}°.</p>
            </div>
          </div>
          <p className="isl-p">Showers after 6. Sunset at 6:46 PM — still a nice evening if you stay close to town.</p>
        </article>

        <section className="isl-card isl-also" aria-label="Also today">
          <p className="isl-kicker" style={{ color: "var(--mock-muted)" }}>Also today</p>
          <div className="isl-grid">
            <Mini Icon={Activity} title="Earthquakes" text="A light 4.1 on Monday. No tsunami." />
            <Mini Icon={Mountain} title="Volcano" text="Kīlauea is taking a rest." />
            <Mini Icon={Waves} title="Tsunami" text="The ocean is fine — for now." />
            <Mini Icon={Users} title="Neighbors" text="Nobody posted today." />
          </div>
        </section>

        <section className="isl-card" aria-label="Warnings on this phone">
          <p className="mock-strong" style={{ margin: 0 }}>Warnings on this phone</p>
          <p className="isl-p" style={{ color: "var(--mock-muted)" }}>Shelter openings and evacuations as notifications you can read with no signal.</p>
          <div className="isl-cta">
            <button type="button" className="isl-btn">Turn on</button>
            <button type="button" className="isl-ghost">Not now</button>
          </div>
        </section>
      </div>

      <p className="mock-foot">Free. No ads. No account. Not an emergency service — call 911.</p>

      <nav className="mock-dock" aria-label="Sections">
        {TABS.map((t) => (
          <span key={t.label} className={t.label === "Now" ? "on" : undefined}>
            <t.Icon className="size-6" strokeWidth={t.label === "Now" ? 2.25 : 1.75} aria-hidden />
            {t.label}
          </span>
        ))}
      </nav>
    </>
  );
}

function Mini({ Icon, title, text }: { Icon: typeof Wind; title: string; text: string }) {
  return (
    <div className="isl-mini">
      <span className="isl-bubble"><Icon aria-hidden /></span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

/** Map sketch: west = islands, east = the storm. Not a timeline. */
function StormSketch() {
  return (
    <svg viewBox="0 0 400 180" role="presentation">
      <rect width="400" height="180" fill="#c5dbe3" />
      {/* faint latitude lines so it reads as geography */}
      <path d="M0 50 H400 M0 90 H400 M0 130 H400" stroke="#fff" strokeWidth="1" opacity="0.35" />
      {/* forecast path: from ESE toward south of the Big Island */}
      <path d="M392 78 C 320 88, 250 108, 168 122 S 70 128, 18 118" fill="none" stroke="#274a66" strokeWidth="2.25" strokeDasharray="5 6" strokeLinecap="round" />
      {/* storm now, still well east */}
      <circle cx="372" cy="80" r="14" fill="#9bb8cc" opacity="0.55" />
      <circle cx="372" cy="80" r="7" fill="#274a66" />
      {/* island chain, west side — Big Island is the large one */}
      <ellipse cx="128" cy="118" rx="28" ry="22" fill="#6e846c" transform="rotate(-18 128 118)" />
      <ellipse cx="92" cy="96" rx="14" ry="9" fill="#7b9178" transform="rotate(-12 92 96)" />
      <ellipse cx="68" cy="88" rx="8" ry="6" fill="#7b9178" />
      <ellipse cx="48" cy="82" rx="16" ry="10" fill="#7b9178" transform="rotate(-8 48 82)" />
      <ellipse cx="22" cy="76" rx="10" ry="7" fill="#7b9178" />
    </svg>
  );
}
