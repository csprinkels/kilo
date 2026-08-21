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
export default function TopBar({ island: islandProp, onIsland: onIslandProp, quiet }: { island?: Island; onIsland?: (i: Island) => void; quiet?: boolean }) {
  const path = usePathname();
  const isTab = TAB_PATHS.includes(path);
  // Pages that aren't per-island still show the control, so it is in the same place on every screen.
  const [stored, setStored] = useStoredIsland();
  const island = islandProp ?? (stored === "state" ? "hawaii" : stored);
  const onIsland = onIslandProp ?? setStored;
  const label = ISLAND_LABEL[island].split(" · ")[0];
  return (
    <header className="pt-s2">
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-s3 gap-y-s2">
        {isTab
          ? <Wordmark className="text-ink" />
          : <Link href="/" className="-ml-2 inline-flex min-h-11 shrink-0 items-center gap-0.5 px-2 text-small font-semibold text-brand"><Icon name="caret-left" size={18} /> Now</Link>}
        {/* A native <select> behind a quiet chip: iPhones show their wheel, and it stops shouting over the wordmark. */}
        <label className="relative inline-flex min-h-11 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-s3 text-small font-semibold text-ink ring-1 ring-line">
          {label} <Icon name="caret-down" size={14} className="text-ink-2" />
          <select aria-label="Island" value={island} onChange={(e) => onIsland(e.target.value as Island)} className="absolute inset-0 cursor-pointer opacity-0">
            {ISLANDS.map((i) => <option key={i} value={i}>{ISLAND_LABEL[i]}</option>)}
          </select>
        </label>
      </div>
    </header>
  );
}
