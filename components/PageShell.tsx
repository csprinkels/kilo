"use client";
import Link from "next/link";
import { ArrowLeft, WifiOff } from "lucide-react";
import SectionNav from "./SectionNav";
import { ISLANDS, type Island } from "@/lib/types";
import { ISLAND_LABEL, ago } from "@/lib/brand";

/** Shared chrome for section pages: back link, nav, title, optional island chips, freshness line. */
export default function PageShell({
  title, blurb, island, onIsland, fetchedAt, offline, children,
}: { title: string; blurb?: string; island?: Island; onIsland?: (i: Island) => void; fetchedAt?: number; offline?: boolean; children: React.ReactNode }) {
  return (
    <main className="relative z-[1] mx-auto w-full max-w-2xl px-5 pb-20 pt-6">
      <Link href="/" className="inline-flex items-center gap-1 text-sm font-medium text-muted"><ArrowLeft className="size-4" /> Back</Link>
      <SectionNav />
      <h1 className="display mt-4 text-[34px] font-medium leading-[1] tracking-[-0.02em] text-ink">{title}</h1>
      {(blurb || fetchedAt) && (
        <p className="mt-2 text-[14px] text-muted">
          {blurb}{blurb && fetchedAt ? " · " : ""}
          {fetchedAt ? <>checked {ago(fetchedAt)}{offline ? <> · <WifiOff className="inline size-3.5 align-text-bottom text-sev4" /> offline, showing saved copy</> : ""}</> : null}
        </p>
      )}
      {island && onIsland && (
        <nav aria-label="Island" className="no-scrollbar -mx-5 mt-4 flex gap-2 overflow-x-auto px-5">
          {ISLANDS.map((i) => (
            <button key={i} onClick={() => onIsland(i)} aria-pressed={i === island}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${i === island ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface text-ink-2"}`}>
              {ISLAND_LABEL[i].split(" · ")[0]}
            </button>
          ))}
        </nav>
      )}
      {children}
    </main>
  );
}

export const H2 = ({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) => (
  <h2 className="mt-7 flex items-baseline gap-2 border-b border-line pb-2"><span className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-2">{children}</span>{right && <span className="ml-auto text-xs text-muted">{right}</span>}</h2>
);
