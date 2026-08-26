"use client";
import { useSyncExternalStore } from "react";
import Link from "next/link";
import Icon, { type IconName } from "@/components/Icon";
import PageShell from "@/components/PageShell";
import AlertsCard from "@/components/AlertsCard";
import { ISLANDS } from "@/lib/types";
import { useStoredIsland } from "@/lib/data";
import { APP_NAME, COUNTY_ALERTS, islandName } from "@/lib/brand";

const SOURCES = [
  ["National Weather Service", "weather, surf, warnings"],
  ["Hawaiʻi County Civil Defense", "shelters, road closures, schools"],
  ["State highways department", "roadwork"],
  ["Hawaiʻi County Department of Water Supply", "boil-water notices and water outages"],
  ["USGS", "earthquakes"],
  ["USGS Hawaiian Volcano Observatory", "Kīlauea and Mauna Loa"],
  ["Pacific Tsunami Warning Center", "tsunami"],
  ["Central Pacific Hurricane Center", "storms"],
  ["Hawaiʻi Department of Health and AirNow", "air and vog"],
  ["Honolulu 911 dispatch", "crashes on Oʻahu"],
  ["Hawaiʻi Statewide GIS Program and USGS", "map roads, coastlines, and elevation"],
  ["Neighbors", "their own reports, on the Reports page"],
] as const;

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

/** One settings card in the Now screen's language: a bubble tile beside the serif heading, then the sentence, then the controls. */
function Card({ icon, tone, title, sentence, children }: {
  icon: IconName;
  tone?: "hot";
  title: React.ReactNode;
  sentence?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className={`isl-card${tone ? ` isl-${tone}` : ""}`}>
      <div className="sr-head">
        <span className="isl-bubble"><Icon name={icon} size={20} /></span>
        <h2 className="isl-h">{title}</h2>
      </div>
      {sentence && <p className="isl-p max-w-[36rem]">{sentence}</p>}
      {children}
    </section>
  );
}

export default function Settings() {
  const [stored, setIsland] = useStoredIsland();
  const island = stored === "state" ? "hawaii" : stored;
  const [size, setSize] = useTextSize();
  const platform = usePlatform();
  const county = COUNTY_ALERTS[island];
  const countyName = county.label.replace(/\s*\(.*\)$/, "");
  const countyHow = county.how.startsWith("Text") ? county.how : "Sign up on their website";

  return (
    <PageShell title="Settings and about" sentence={`Pick your island and text size, turn on warnings, and see where ${APP_NAME}'s information comes from.`}>
      <div className="now-island">
        <div className="isl-stack mt-s7">
          <Card icon="mountains-fill" title="Your island" sentence="Everything in Kilo is about this island.">
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
          <div className="isl-card sr-embed"><AlertsCard island={island} /></div>

          <Card icon="siren-fill" title="Your county's own alerts" sentence={`${countyName}: ${countyHow}. These come straight from the county, even when ${APP_NAME} is down.`}>
            <a className="btn mt-s4" href={county.url} target="_blank" rel="noreferrer">Open the county&apos;s alerts page <Icon name="caret-right" className="size-5" aria-hidden /></a>
          </Card>

          <Card icon="house-fill" title={`Add ${APP_NAME} to your Home Screen`} sentence={
            platform === "standalone" ? `${APP_NAME} is on your Home Screen.`
            : platform === "ios" ? <>Tap the Share button, then &ldquo;Add to Home Screen&rdquo;. It then opens full screen and works with no signal.</>
            : platform === "android" ? <>Tap the menu, then &ldquo;Install app&rdquo;. It then opens full screen and works with no signal.</>
            : `Open ${APP_NAME} on your phone to add it to your Home Screen.`
          } />

          <Card icon="megaphone-fill" title="Where the information comes from" sentence="Every item says who reported it. Nothing is written by a computer.">
            <ul className="mt-s4 divide-y divide-line">
              {SOURCES.map(([name, what]) => (
                <li key={name} className="py-s3 text-body first:pt-0 last:pb-0">
                  <span className="block font-semibold text-ink">{name}</span>
                  <span className="block text-small text-ink-2">{what}</span>
                </li>
              ))}
            </ul>
            <p className="mt-s4 max-w-[36rem] border-t border-line pt-s3 text-small text-ink-2">Surf heights are the local Hawaiian scale; the face of the wave looks about twice as big.</p>
          </Card>

          <Card icon="warning-fill" tone="hot" title={`What ${APP_NAME} is not`} sentence={<>Not an emergency service. Not part of any government. <strong className="sr-911">In an emergency call 911.</strong> When Civil Defense says something different, do what Civil Defense says.</>} />

          <Card icon="check-circle" title={`What ${APP_NAME} will never do`}>
            <ul className="mt-s4 flex flex-col gap-s3">
              {NEVER.map((line) => (
                <li key={line} className="flex items-start gap-s3 text-body">
                  <Icon name="x" size={18} className="mt-s1 text-ink-2" />
                  <span className="max-w-[34rem]">{line}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <nav className="list mt-s5">
          <Link href="/guidelines/" className="row font-semibold text-brand">
            <span className="flex-1">Neighbor rules</span><Icon name="caret-right" className="size-5 shrink-0" aria-hidden />
          </Link>
          <Link href="/privacy/" className="row font-semibold text-brand">
            <span className="flex-1">Privacy</span><Icon name="caret-right" className="size-5 shrink-0" aria-hidden />
          </Link>
        </nav>

        <p className="mt-s7 text-small text-ink-2">Made in Hilo. Free, no ads, no account.</p>
      </div>
    </PageShell>
  );
}
