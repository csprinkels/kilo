"use client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import StormTracker from "@/components/StormTracker";
import SectionNav from "@/components/SectionNav";
import { ISLANDS } from "@/lib/types";
import type { StormsSnapshot } from "@/lib/storm";
import { useJson, useStoredIsland } from "@/lib/data";
import { ISLAND_LABEL, fmtDateTime } from "@/lib/brand";

export default function StormsPage() {
  const [stored, setIsland] = useStoredIsland();
  const island = stored === "state" ? "hawaii" : stored;
  const snap = useJson<StormsSnapshot>("v1/storms.json");
  const storms = snap?.data?.storms ?? [];

  return (
    <main className="relative z-[1] mx-auto w-full max-w-2xl px-5 pb-28 pt-s5 md:pb-20">
      <Link href="/" className="inline-flex items-center gap-1 text-label font-medium text-muted"><ArrowLeft className="size-4" /> Back</Link>
      <SectionNav />
      <h1 className="display mt-s4 text-display text-ink">Storms</h1>
      <p className="mt-s2 text-lead text-ink-2">
        {storms.length ? `${storms.length === 1 ? "One system" : `${storms.length} systems`} being tracked by the Central Pacific Hurricane Center, explained for where you live.` : "Central Pacific Hurricane Center forecasts, explained for where you live."}
      </p>

      <nav aria-label="Island" className="no-scrollbar -mx-5 mt-4 flex gap-2 overflow-x-auto px-5">
        {ISLANDS.map((i) => (
          <button key={i} onClick={() => setIsland(i)} aria-pressed={i === island}
            className={`btn shrink-0 ${i === island ? "btn-primary" : ""}`}>
            {ISLAND_LABEL[i].split(" · ")[0]}
          </button>
        ))}
      </nav>

      {snap?.data && storms.length === 0 && (
        <EmptyState title="No active tropical cyclones near Hawaiʻi">This page wakes up when the Central Pacific Hurricane Center issues advisories. Last checked {fmtDateTime(snap.data.gen)} HST.</EmptyState>
      )}
      {storms.map((s) => <StormTracker key={s.id} storm={s} island={island} />)}
      <p className="mt-8 text-center text-micro text-muted">Data: NWS Central Pacific Hurricane Center / National Hurricane Center. Not an emergency service. {"Hawaiʻi"} county alerts are the official call to act.</p>
    </main>
  );
}
