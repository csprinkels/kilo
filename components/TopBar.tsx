"use client";
import Link from "next/link";
import { ChevronDown, Info, Navigation } from "lucide-react";
import { ISLANDS, type Island } from "@/lib/types";
import { APP_NAME, ISLAND_LABEL } from "@/lib/brand";

/** One 56px bar on every page: wordmark · island (native select, so iPhone shows its wheel) · about. */
export default function TopBar({ island, onIsland, home }: { island?: Island; onIsland?: (i: Island) => void; home?: boolean }) {
  return (
    <header className="flex h-14 items-center justify-between pt-s3">
      {home ? <span className="display text-lead text-ink">{APP_NAME}</span> : <Link href="/" className="display text-lead text-ink">{APP_NAME}</Link>}
      {island && onIsland ? (
        <label className="relative inline-flex h-11 items-center gap-1.5 text-body font-semibold text-brand">
          <Navigation className="size-4" aria-hidden /> {ISLAND_LABEL[island].split(" · ")[0]} <ChevronDown className="size-4" aria-hidden />
          <select aria-label="Island" value={island} onChange={(e) => onIsland(e.target.value as Island)} className="absolute inset-0 cursor-pointer opacity-0">
            {ISLANDS.map((i) => <option key={i} value={i}>{ISLAND_LABEL[i]}</option>)}
          </select>
        </label>
      ) : island ? <span className="inline-flex items-center gap-1.5 text-body font-semibold text-muted"><Navigation className="size-4" aria-hidden /> {ISLAND_LABEL[island].split(" · ")[0]}</span> : <span />}
      <Link href="/sources/" aria-label={`About ${APP_NAME}`} className="-mr-2 inline-flex size-11 items-center justify-center text-muted"><Info className="size-5" /></Link>
    </header>
  );
}
