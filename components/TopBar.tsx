"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/Icon";
import Wordmark from "@/components/Wordmark";
import { ISLANDS, type Island } from "@/lib/types";
import { useStoredIsland } from "@/lib/data";
import { ISLAND_LABEL } from "@/lib/brand";

const TAB_PATHS = ["/", "/weather/", "/traffic/", "/report/"];

/**
 * One bar on every page: wordmark (or "‹ Now" on pages that aren't tabs) on the left, the island picker on the right.
 * Settings lives in the footer: it is a place you go once, not a control you need on every screen.
 * The island control is a native <select> so iPhones show their big wheel; it looks like a button, not plain text.
 */
export default function TopBar({ island: islandProp, onIsland: onIslandProp }: { island?: Island; onIsland?: (i: Island) => void }) {
  const path = usePathname();
  const isTab = TAB_PATHS.includes(path);
  // Pages that aren't per-island still show the control, so it is in the same place on every screen.
  const [stored, setStored] = useStoredIsland();
  const island = islandProp ?? (stored === "state" ? "hawaii" : stored);
  const onIsland = onIslandProp ?? setStored;
  const label = ISLAND_LABEL[island].split(" · ")[0];
  return (
    <header className="cs-top">
      {isTab
        ? <Wordmark className="text-ink" />
        : <Link href="/" className="cs-btn-quiet -ml-1"><Icon name="caret-left" size={18} /> Now</Link>}
      {/* A native <select> behind a white rounded-rect button: iPhones show their wheel, and it stops shouting over the wordmark. */}
      <label className="cs-island">
        <Icon name="map-pin" size={15} /> {label} <Icon name="caret-down" size={13} />
        <select aria-label="Island" value={island} onChange={(e) => onIsland(e.target.value as Island)} className="absolute inset-0 cursor-pointer opacity-0">
          {ISLANDS.map((i) => <option key={i} value={i}>{ISLAND_LABEL[i]}</option>)}
        </select>
      </label>
    </header>
  );
}
