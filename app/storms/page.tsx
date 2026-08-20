"use client";

import EmptyState from "@/components/EmptyState";
import StormTracker from "@/components/StormTracker";
import SectionNav from "@/components/SectionNav";
import TopBar from "@/components/TopBar";
import type { StormsSnapshot } from "@/lib/storm";
import { useJson, useStoredIsland } from "@/lib/data";
import { fmtDateTime } from "@/lib/brand";

export default function StormsPage() {
  const [stored, setIsland] = useStoredIsland();
  const island = stored === "state" ? "hawaii" : stored;
  const snap = useJson<StormsSnapshot>("v1/storms.json");
  const storms = snap?.data?.storms ?? [];

  return (
    <main className="relative z-[1] mx-auto w-full max-w-2xl px-5 pb-28 md:pb-20">
      <TopBar island={island} onIsland={setIsland} />
      <SectionNav />
      <h1 className="h2-display mt-s6">Storms</h1>
      <p className="mt-s2 text-body leading-snug text-ink-2">
        {storms.length ? `${storms.length === 1 ? "One system" : `${storms.length} systems`} being tracked by the Central Pacific Hurricane Center, explained for where you live.` : "Central Pacific Hurricane Center forecasts, explained for where you live."}
      </p>

      {snap?.data && storms.length === 0 && (
        <EmptyState title="No active tropical cyclones near Hawaiʻi">This page wakes up when the Central Pacific Hurricane Center issues advisories. Last checked {fmtDateTime(snap.data.gen)} HST.</EmptyState>
      )}
      {storms.map((s) => <StormTracker key={s.id} storm={s} island={island} />)}
      <p className="mt-8 text-center text-micro text-muted">Data: NWS Central Pacific Hurricane Center / National Hurricane Center. Not an emergency service. {"Hawaiʻi"} county alerts are the official call to act.</p>
    </main>
  );
}
