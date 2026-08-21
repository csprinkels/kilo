"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronLeft } from "lucide-react";
import { ISLANDS, type Island } from "@/lib/types";
import { useStoredIsland } from "@/lib/data";
import { APP_NAME, ISLAND_LABEL } from "@/lib/brand";

const TAB_PATHS = ["/", "/weather/", "/traffic/", "/report/"];

/**
 * One bar on every page: wordmark (or "‹ Now" on pages that aren't tabs) · island as a visible button · Settings.
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
    // @container: when the bar is narrower than 20rem (large text sizes), the island button takes its own row instead of clipping.
    <header className="@container pt-s2">
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-x-s2 gap-y-s1">
      {isTab
        ? <span className="display text-title text-ink">{APP_NAME}</span>
        : <Link href="/" className="-ml-2 inline-flex min-h-11 shrink-0 items-center gap-0.5 px-2 text-small font-semibold text-brand"><ChevronLeft className="size-5" aria-hidden /> Now</Link>}
      {(
        <label className="relative inline-flex min-h-11 items-center gap-1 whitespace-nowrap rounded-full bg-surface-2 px-4 text-small font-semibold text-ink @max-[20rem]:order-3 @max-[20rem]:basis-full @max-[20rem]:justify-between">
          {label} <ChevronDown className="size-4 text-ink-2" aria-hidden />
          <select aria-label="Island" value={island} onChange={(e) => onIsland(e.target.value as Island)} className="absolute inset-0 cursor-pointer opacity-0">
            {ISLANDS.map((i) => <option key={i} value={i}>{ISLAND_LABEL[i]}</option>)}
          </select>
        </label>
      )}
      <Link href="/sources/" className="-mr-2 inline-flex min-h-11 shrink-0 items-center px-2 text-small font-semibold text-brand">Settings</Link>
      </div>
    </header>
  );
}
