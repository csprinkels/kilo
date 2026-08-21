"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/Icon";
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
    // One row: the wordmark, then the two controls together on the right. @container: at the largest text
    // sizes the controls take their own row instead of squeezing the wordmark.
    <header className="@container pt-s2">
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-s3 gap-y-s2">
        {isTab
          ? <span className="display text-[1.375rem] leading-none text-ink">{APP_NAME}</span>
          : <Link href="/" className="-ml-2 inline-flex min-h-11 shrink-0 items-center gap-0.5 px-2 text-small font-semibold text-brand"><Icon name="caret-left" size={18} /> Now</Link>}
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-s2 gap-y-s1 @max-[19rem]:w-full @max-[19rem]:justify-between">
          {/* A native <select> behind a quiet chip: iPhones show their wheel, and it stops shouting over the wordmark. */}
          <label className="relative inline-flex min-h-11 items-center gap-1 whitespace-nowrap rounded-full px-s3 text-small font-semibold text-ink ring-1 ring-line">
            {label} <Icon name="caret-down" size={14} className="text-ink-2" />
            <select aria-label="Island" value={island} onChange={(e) => onIsland(e.target.value as Island)} className="absolute inset-0 cursor-pointer opacity-0">
              {ISLANDS.map((i) => <option key={i} value={i}>{ISLAND_LABEL[i]}</option>)}
            </select>
          </label>
          <Link href="/sources/" className="inline-flex min-h-11 shrink-0 items-center gap-1 text-[0.8125rem] font-semibold text-ink-2">
            <Icon name="gear" size={18} /> Settings
          </Link>
        </div>
      </div>
    </header>
  );
}
