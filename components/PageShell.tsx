"use client";
import SectionNav from "./SectionNav";
import StatusLine from "./StatusLine";
import TopBar from "./TopBar";
import type { Island } from "@/lib/types";

/** Shared chrome for section pages: top bar (island picker when the page is per-island), title, one-line blurb, freshness line. */
export default function PageShell({
  title, blurb, island, onIsland, fetchedAt, gen, offline, source, children,
}: { title: string; blurb?: string; island?: Island; onIsland?: (i: Island) => void; fetchedAt?: number; gen?: number; offline?: boolean; source?: string; children: React.ReactNode }) {
  return (
    <main className="relative z-[1] mx-auto w-full max-w-2xl px-5 pb-28 md:pb-20">
      <TopBar island={island} onIsland={onIsland} />
      <SectionNav />
      <h1 className="h2-display mt-s6">{title}</h1>
      {blurb && <p className="mt-s2 text-body leading-snug text-ink-2">{blurb}</p>}
      {fetchedAt != null && <StatusLine gen={gen ?? fetchedAt} checkedAt={fetchedAt} offline={!!offline} source={source} />}
      {children}
    </main>
  );
}

export const H2 = ({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) => (
  <h2 className="mt-10 flex flex-wrap items-baseline gap-x-s3 gap-y-1"><span className="h2-display">{children}</span>{right && <span className="text-label text-muted num">{right}</span>}</h2>
);
