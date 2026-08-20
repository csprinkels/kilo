"use client";
import Link from "next/link";
import { ArrowLeft, CircleCheck } from "lucide-react";
import StormTracker from "@/components/StormTracker";
import { ISLANDS } from "@/lib/types";
import type { StormsSnapshot } from "@/lib/storm";
import { useJson, useStoredIsland } from "@/lib/data";
import { ISLAND_LABEL, ago, fmtDateTime, okina } from "@/lib/brand";

export default function StormsPage() {
  const [stored, setIsland] = useStoredIsland();
  const island = stored === "state" ? "hawaii" : stored;
  const snap = useJson<StormsSnapshot>("v1/storms.json");
  const storms = snap?.data?.storms ?? [];

  return (
    <main className="relative z-[1] mx-auto w-full max-w-2xl px-5 pb-20 pt-6">
      <Link href="/" className="inline-flex items-center gap-1 text-sm font-medium text-muted"><ArrowLeft className="size-4" /> Back</Link>
      <h1 className="display mt-4 text-[34px] font-medium leading-[1] tracking-[-0.02em] text-ink">Storm tracker</h1>
      <p className="mt-2 text-[14px] text-muted">
        Central Pacific Hurricane Center forecasts, explained for where you live.
        {snap?.data && <> Checked {ago(snap.fetchedAt)}{snap.offline ? " · offline, showing saved copy" : ""}.</>}
      </p>

      <nav aria-label="Island" className="no-scrollbar -mx-5 mt-4 flex gap-2 overflow-x-auto px-5">
        {ISLANDS.map((i) => (
          <button key={i} onClick={() => setIsland(i)} aria-pressed={i === island}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${i === island ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface text-ink-2"}`}>
            {ISLAND_LABEL[i].split(" · ")[0]}
          </button>
        ))}
      </nav>

      {snap?.data && storms.length === 0 && (
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-4">
          <CircleCheck className="size-6 shrink-0 text-emerald-600" />
          <div>
            <p className="font-semibold">No active tropical cyclones near Hawaiʻi</p>
            <p className="text-sm text-muted">This page wakes up when the Central Pacific Hurricane Center issues advisories. Last checked {fmtDateTime(snap.data.gen)} HST.</p>
          </div>
        </div>
      )}
      {storms.map((s) => <StormTracker key={s.id} storm={s} island={island} />)}
      <p className="mt-8 text-center text-xs text-muted">Data: NWS Central Pacific Hurricane Center / National Hurricane Center. Not an emergency service. {okina("Hawaiʻi")} county alerts are the official call to act.</p>
    </main>
  );
}
