"use client";
import { useSyncExternalStore } from "react";
import { showEveryone, useHidden } from "@/lib/hidden";
import Link from "next/link";
import Icon, { type IconName } from "@/components/Icon";
import PageShell from "@/components/PageShell";
import AlertsCard from "@/components/AlertsCard";
import { Notice } from "@/components/AlertBlock";
import "./sources.css";
import { ISLANDS } from "@/lib/types";
import { useStoredIsland } from "@/lib/data";
import { APP_NAME, COUNTY_ALERTS, islandName } from "@/lib/brand";

// name · what · the tile's glyph (the same glyph the feed's items carry, where there is one)
const SOURCES: readonly (readonly [string, string, IconName])[] = [
  ["National Weather Service", "weather, surf, warnings", "cloud-sun"],
  ["Hawaiʻi County Civil Defense", "shelters, road closures, schools", "siren"],
  ["State highways department", "roadwork", "traffic-cone"],
  ["Hawaiʻi County Department of Water Supply", "boil-water notices and water outages", "drop"],
  ["USGS", "earthquakes", "pulse"],
  ["USGS Hawaiian Volcano Observatory", "Kīlauea and Mauna Loa", "mountains"],
  ["Pacific Tsunami Warning Center", "tsunami", "waves"],
  ["Central Pacific Hurricane Center", "storms", "wind"],
  ["Hawaiʻi Department of Health and AirNow", "air and vog", "lightning-slash"],
  ["Honolulu 911 dispatch", "crashes on Oʻahu", "car"],
  ["Hawaiʻi Statewide GIS Program and USGS", "map roads, coastlines, and elevation", "map-pin"],
  ["Neighbors", "their own reports, on the Reports page", "users-three"],
];

// The promise list, one sentence a line. Each line is word for word the sentence this page has always shown.
const NEVER = [
  "Show ads.",
  "Make you create an account.",
  "Sell or share where you are.",
  "Let a computer write an alert.",
  "Make a neighbor's post look official.",
] as const;

const SIZES = [["", "Normal"], ["large", "Large"], ["largest", "Largest"]] as const;
type TextSize = (typeof SIZES)[number][0];

// Kilo's own text size, mirrored to <html data-text> right away; app/layout.tsx re-applies it before paint on the next load.
const sizeListeners = new Set<() => void>();
const subscribeSize = (cb: () => void) => { sizeListeners.add(cb); return () => { sizeListeners.delete(cb); }; };
const getSize = () => (localStorage.getItem("text") ?? "") as TextSize;
function useTextSize(): [TextSize, (s: TextSize) => void] {
  const size = useSyncExternalStore(subscribeSize, getSize, () => "" as TextSize);
  return [size, (s) => {
    if (s) { localStorage.setItem("text", s); document.documentElement.dataset.text = s; }
    else { localStorage.removeItem("text"); delete document.documentElement.dataset.text; }
    sizeListeners.forEach((cb) => cb());
  }];
}

// Where this is running, for the one Home Screen instruction. Read once; it cannot change while the page is open.
const getPlatform = () => {
  if (window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true) return "standalone";
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) return "ios";
  if (/Android/.test(navigator.userAgent)) return "android";
  return "other";
};
const usePlatform = () => useSyncExternalStore(() => () => {}, getPlatform, () => "other" as ReturnType<typeof getPlatform>);

/**
 * One card: .cs-card ground with a .cs-lead head (tint tile · 16px title · 13.5px line) — the block
 * AlertsCard and the Now screen's notification card already draw, so every card here is that card.
 */
function Card({ icon, title, sentence, children }: {
  icon: IconName;
  title: React.ReactNode;
  sentence?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="cs-card">
      <div className="cs-lead">
        <span className="cs-ictile cs-ictile--ink"><Icon name={icon} size={18} /></span>
        <div className="cs-lead-t">
          <h2 className="cs-lead-h">{title}</h2>
          {sentence && <p className="cs-lead-p">{sentence}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export default function Settings() {
  const [stored, setIsland] = useStoredIsland();
  const island = stored === "state" ? "hawaii" : stored;
  const [size, setSize] = useTextSize();
  const platform = usePlatform();
  const hidden = useHidden();
  const county = COUNTY_ALERTS[island];
  const countyName = county.label.replace(/\s*\(.*\)$/, "");
  const countyHow = county.how.startsWith("Text") ? county.how : "Sign up on their website";

  return (
    <PageShell title="Settings and about" sentence={`Pick your island and text size, turn on warnings, and see where ${APP_NAME}'s information comes from.`}>
      <div className="cs-stack pg-sources">
        <Card icon="mountains" title="Your island" sentence="Everything in Kilo is about this island.">
          <div className="mt-s4 flex flex-col gap-s2">
            {ISLANDS.map((i) => (
              <button key={i} onClick={() => setIsland(i)} aria-pressed={i === island} className={`btn btn-big justify-start px-s5 text-left ${i === island ? "chip-active" : ""}`}>
                {islandName(i, true)}
              </button>
            ))}
          </div>
        </Card>

        <Card icon="note-pencil" title="Text size" sentence="Makes every word in Kilo bigger. Your phone's own text setting still works too.">
          <div className="mt-s4 flex gap-s2" role="group" aria-label="Text size">
            {SIZES.map(([v, label]) => (
              <button key={v} onClick={() => setSize(v)} aria-pressed={size === v} className={`btn flex-1 px-s2 ${size === v ? "chip-active" : ""}`}>{label}</button>
            ))}
          </div>
        </Card>

        {/* AlertsCard is shared with the Now screen; it gets the card ground here, not a rewrite. */}
        <div className="cs-card"><AlertsCard island={island} /></div>

        <Card icon="siren" title="Your county's own alerts" sentence={`${countyName}: ${countyHow}. These come straight from the county, even when ${APP_NAME} is down.`}>
          <div className="cs-foot">
            <a className="cs-btn-ink" href={county.url} target="_blank" rel="noreferrer">Open the county&apos;s alerts page <Icon name="arrow-square-out" size={16} aria-hidden /></a>
          </div>
        </Card>

        <Card icon="house" title={`Add ${APP_NAME} to your Home Screen`} sentence={
          platform === "standalone" ? `${APP_NAME} is on your Home Screen.`
          : platform === "ios" ? <>Tap the Share button, then &ldquo;Add to Home Screen&rdquo;. It then opens full screen and works with no signal.</>
          : platform === "android" ? <>Tap the menu, then &ldquo;Install app&rdquo;. It then opens full screen and works with no signal.</>
          : `Open ${APP_NAME} on your phone to add it to your Home Screen.`
        } />

        <Card icon="users-three" title="Neighbors you have hidden" sentence={
          hidden.size
            ? `${hidden.size} hidden on this phone. Nothing they post reaches you, on any screen.`
            : "Open any neighbor report and tap \u201CHide posts from this neighbor\u201D to stop seeing that person. It stays on this phone, and nobody is told."
        }>
          {hidden.size > 0 && (
            <div className="cs-foot"><button className="cs-btn-ink" onClick={showEveryone}>Show them again</button></div>
          )}
        </Card>

        <Card icon="megaphone" title="Where the information comes from" sentence="Every item says who reported it. Nothing is written by a computer.">
          {/* who · what, one row a feed. No pip: nothing on this phone knows whether a feed answered, so it may not claim one did. */}
          <ul className="mt-s3">
            {SOURCES.map(([name, what, icon]) => (
              <li key={name} className="cs-row cs-row--mid">
                <span className="cs-ictile"><Icon name={icon} size={18} /></span>
                <div className="cs-rowmain">
                  <span className="cs-rowname">{name}</span>
                  <span className="cs-rowsub">{what}</span>
                </div>
              </li>
            ))}
          </ul>
          <div className="cs-rule" />
          <p className="cs-meta">Surf heights are the local Hawaiian scale; the face of the wave looks about twice as big.</p>
        </Card>

        <Notice title={`What ${APP_NAME} is not`} icon="warning">
          Not an emergency service. Not part of any government. <strong className="sr-911">In an emergency call 911.</strong> When Civil Defense says something different, do what Civil Defense says.
        </Notice>

        <Card icon="check-circle" title={`What ${APP_NAME} will never do`}>
          <ul className="mt-s3">
            {NEVER.map((line) => (
              <li key={line} className="cs-row cs-row--mid">
                <Icon name="x" size={18} className="cs-ic text-mute" aria-hidden />
                <span className="cs-rowname">{line}</span>
              </li>
            ))}
          </ul>
        </Card>

        <nav className="cs-card" aria-label="More about Kilo">
          {([["/guidelines/", "Neighbor rules", "users-three"], ["/privacy/", "Privacy", "note-pencil"], ["/support/", "Support", "question"]] as const).map(([href, label, icon]) => (
            <Link key={href} href={href} className="cs-row cs-row--mid sr-go">
              <span className="cs-ictile cs-ictile--ink"><Icon name={icon} size={18} /></span>
              <span className="cs-rowmain cs-rowname">{label}</span>
              <Icon name="caret-right" size={16} className="cs-ic text-mute" aria-hidden />
            </Link>
          ))}
        </nav>

        {/* Last thing on the page, as on Now. PageShell's "Settings and about" row would link this page to itself; sources.css hides it. */}
        <footer className="cs-footer">Made in Hilo. Free, no ads, no account.</footer>
      </div>
    </PageShell>
  );
}
