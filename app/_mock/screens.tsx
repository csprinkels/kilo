"use client";
import { useState } from "react";
import { Activity, CarFront, ChevronDown, CloudSun, Home, Mountain, TrafficCone, Users, Waves, Wind } from "lucide-react";
import { MOCK } from "./_data";

const TABS = ["Now", "Weather", "Roads", "Neighbors"] as const;

function Top({ kiloClass }: { kiloClass?: string }) {
  return (
    <header className="mock-kilo">
      <span className={`word ${kiloClass ?? ""}`}>Kilo</span>
      <span className="place">{MOCK.island}</span>
      <span className="gear">Settings</span>
    </header>
  );
}

function Tabs({ onClass = "on" }: { onClass?: string }) {
  return (
    <nav className="mock-tabs" aria-label="Sections">
      {TABS.map((t) => <span key={t} className={t === "Now" ? onClass : undefined}>{t}</span>)}
    </nav>
  );
}

function Dock({ onClass = "on", icons }: { onClass?: string; icons?: boolean }) {
  const Ico = [Home, CloudSun, CarFront, Users];
  return (
    <nav className="mock-dock" aria-label="Sections">
      {TABS.map((t, i) => {
        const Icon = Ico[i];
        return (
          <span key={t} className={t === "Now" ? onClass : undefined}>
            {icons && <Icon className="size-6" strokeWidth={t === "Now" ? 2.25 : 1.75} aria-hidden />}
            {t}
          </span>
        );
      })}
    </nav>
  );
}

function Quiet({ rows }: { rows: { key: string; label: string; text: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" className="mock-row" aria-expanded={open} onClick={() => setOpen((v) => !v)} style={{ borderBottom: open ? "1px solid var(--mock-line)" : undefined }}>
        <span className="min-w-0 flex-1">
          <span className="lab">Everything else is quiet</span>
        </span>
        <ChevronDown className="mt-1 size-5 shrink-0" style={{ transform: open ? "rotate(180deg)" : undefined }} aria-hidden />
      </button>
      {open && (
        <ul className="mock-list">
          {rows.map((r) => (
            <li key={r.key} className="mock-row">
              <span className="min-w-0 flex-1">
                <span className="lab">{r.label}</span>
                <span className="txt">{r.text}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Push({ mango }: { mango?: boolean }) {
  return (
    <section className="mock-cta" aria-label="Warnings on this phone">
      <p className="mock-strong">Warnings on this phone</p>
      <p>Get shelter openings and evacuations as notifications you can read with no signal.</p>
      {mango ? (
        <div>
          <button type="button" className="mango-btn">Turn on</button>
          <button type="button" className="mango-ghost">Not now</button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: "1rem", marginTop: "0.85rem", alignItems: "center" }}>
          <span className="mock-strong" style={{ display: "inline-flex", minHeight: "2.75rem", alignItems: "center" }}>Turn on</span>
          <span className="mock-muted" style={{ display: "inline-flex", minHeight: "2.75rem", alignItems: "center" }}>Not now</span>
        </div>
      )}
    </section>
  );
}

const foot = "Free. No ads. No account. Not an emergency service — call 911.";

export function SkyScreen() {
  return (
    <>
      <Top />
      <Tabs />
      <p className="mock-fresh">{MOCK.checked}</p>
      <section className="sky-wash" aria-label={`${MOCK.temp}° in ${MOCK.town}`}>
        <p className="town">{MOCK.town}</p>
        <p className="mock-temp temp">{MOCK.temp}°</p>
        <p className="cond">{MOCK.condition}</p>
        <p className="meta">Feels like {MOCK.feels}°. High {MOCK.hi}°, low {MOCK.lo}°.</p>
        <p className="say">{MOCK.forecast}</p>
      </section>
      <h2 className="mock-label">Needs a look</h2>
      <ul className="mock-list">
        <li className="mock-row">
          <span className="sky-pip hot" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="lab">{MOCK.shelter.word}</span>
            <span className="txt">{MOCK.shelter.headline}. {MOCK.shelter.stale}</span>
          </span>
        </li>
        {MOCK.needs.map((r) => (
          <li key={r.key} className="mock-row">
            <span className={`sky-pip ${r.pip}`} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="lab">{r.label}</span>
              <span className="txt">{r.text}</span>
            </span>
          </li>
        ))}
      </ul>
      <Quiet rows={MOCK.quiet} />
      <Push />
      <p className="mock-foot">{foot}</p>
      <Dock />
    </>
  );
}

export function MangoScreen() {
  return (
    <>
      <Top />
      <Tabs onClass="on" />
      <p className="mock-fresh">{MOCK.checked}</p>
      <p className="mock-temp" aria-label={`${MOCK.temp}°`}>{MOCK.temp}°</p>
      <p className="mock-strong">{MOCK.condition} in {MOCK.town}</p>
      <p className="mock-muted" style={{ marginTop: "0.2rem", fontVariantNumeric: "tabular-nums" }}>Feels like {MOCK.feels}°. High {MOCK.hi}°, low {MOCK.lo}°.</p>
      <p className="mock-muted" style={{ marginTop: "0.85rem", maxWidth: "34rem" }}>{MOCK.forecast}</p>

      <h2 className="mock-label">Needs a look</h2>
      <div className="mango-rule">
        <p className="mock-strong" style={{ margin: 0 }}>{MOCK.shelter.headline}</p>
        <p className="mock-muted" style={{ margin: "0.35rem 0 0" }}>{MOCK.shelter.action}</p>
        <p className="mock-muted" style={{ margin: "0.5rem 0 0", fontSize: "1rem" }}>{MOCK.shelter.stale}</p>
      </div>
      <ul className="mock-list">
        {MOCK.needs.map((r) => (
          <li key={r.key} className="mock-row">
            <span className="min-w-0 flex-1">
              <span className="lab">{r.label}</span>
              <span className="txt">
                Mamalahoa Highway 190 <span className="mango-pop">closed</span> both ways in North Kona. 19 more.
              </span>
            </span>
          </li>
        ))}
      </ul>
      <Quiet rows={MOCK.quiet} />
      <Push mango />
      <p className="mock-foot">{foot}</p>
      <Dock onClass="on" />
    </>
  );
}

const TOPIC_ICO = {
  storms: Wind,
  quakes: Activity,
  volcano: Mountain,
  tsunami: Waves,
  neighbors: Users,
} as const;

export function StickerScreen() {
  return (
    <>
      <Top />
      <Tabs />
      <p className="mock-fresh">{MOCK.checked}</p>
      <section aria-label={`${MOCK.temp}° in ${MOCK.town}`}>
        <div className="sticker-hero">
          <div className="sticker-badge" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/weather/overcast-day.svg" alt="" />
          </div>
          <div className="min-w-0">
            <p className="mock-temp" style={{ fontSize: "3.25rem" }}>{MOCK.temp}°</p>
            <p className="cond">{MOCK.town} · {MOCK.condition}</p>
            <p className="meta">Feels like {MOCK.feels}°. High {MOCK.hi}°, low {MOCK.lo}°.</p>
          </div>
        </div>
        <p className="sticker-say">{MOCK.forecast}</p>
      </section>
      <h2 className="mock-label">Needs a look</h2>
      <div className="sticker-note">
        <p className="word">{MOCK.shelter.word}</p>
        <p className="mock-strong" style={{ margin: "0.2rem 0 0" }}>{MOCK.shelter.headline}</p>
        <p className="mock-muted" style={{ margin: "0.35rem 0 0" }}>{MOCK.shelter.action}</p>
        <p className="mock-muted" style={{ margin: "0.5rem 0 0", fontSize: "1rem" }}>{MOCK.shelter.stale}</p>
      </div>
      <ul className="mock-list">
        {MOCK.needs.map((r) => (
          <li key={r.key} className="mock-row">
            <TrafficCone className="sticker-ico" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="lab">{r.label}</span>
              <span className="txt">{r.text}</span>
            </span>
          </li>
        ))}
      </ul>
      <QuietSticker />
      <Push />
      <p className="mock-foot">{foot}</p>
      <Dock icons />
    </>
  );
}

function QuietSticker() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" className="mock-row" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="min-w-0 flex-1"><span className="lab">Everything else is quiet</span></span>
        <ChevronDown className="mt-1 size-5 shrink-0" style={{ transform: open ? "rotate(180deg)" : undefined }} aria-hidden />
      </button>
      {open && (
        <ul className="mock-list">
          {MOCK.quiet.map((r) => {
            const Icon = TOPIC_ICO[r.key as keyof typeof TOPIC_ICO];
            return (
              <li key={r.key} className="mock-row">
                {Icon && <Icon className="sticker-ico" aria-hidden />}
                <span className="min-w-0 flex-1">
                  <span className="lab">{r.label}</span>
                  <span className="txt">{r.text}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
