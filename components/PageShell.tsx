"use client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import SectionNav from "./SectionNav";
import StatusLine from "./StatusLine";
import { ISLANDS, type Island } from "@/lib/types";
import { ISLAND_LABEL } from "@/lib/brand";

/** Shared chrome for section pages: back link, nav, title, optional island chips, freshness line. */
export default function PageShell({
  title, blurb, island, onIsland, fetchedAt, gen, offline, source, children,
}: { title: string; blurb?: string; island?: Island; onIsland?: (i: Island) => void; fetchedAt?: number; gen?: number; offline?: boolean; source?: string; children: React.ReactNode }) {
  return (
    <main className="relative z-[1] mx-auto w-full max-w-2xl px-5 pb-28 pt-s5 md:pb-20">
      <Link href="/" className="inline-flex items-center gap-1 text-label font-medium text-muted"><ArrowLeft className="size-4" /> Back</Link>
      <SectionNav />
      <h1 className="display mt-s4 text-display font-medium tracking-[-0.02em] text-ink">{title}</h1>
      {blurb && <p className="mt-s2 text-lead text-ink-2">{blurb}</p>}
      {island && onIsland && (
        <nav aria-label="Island" className="no-scrollbar -mx-5 mt-s4 flex gap-s2 overflow-x-auto px-5">
          {ISLANDS.map((i) => (
            <button key={i} onClick={() => onIsland(i)} aria-pressed={i === island} className={`btn shrink-0 ${i === island ? "btn-primary" : ""}`}>
              {ISLAND_LABEL[i].split(" · ")[0]}
            </button>
          ))}
        </nav>
      )}
      {fetchedAt != null && <StatusLine gen={gen ?? fetchedAt} checkedAt={fetchedAt} offline={!!offline} source={source} />}
      {children}
    </main>
  );
}

export const H2 = ({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) => (
  <h2 className="mt-s6 flex items-baseline gap-s2 border-b border-line pb-s2"><span className="h2-display">{children}</span>{right && <span className="ml-auto text-label text-muted num">{right}</span>}</h2>
);
