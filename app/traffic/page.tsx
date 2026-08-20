"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CircleCheck, Map, Megaphone } from "lucide-react";
import ItemRow from "@/components/ItemRow";
import SectionNav from "@/components/SectionNav";
import { ISLANDS, type Island } from "@/lib/types";
import { useFeed, useStoredIsland } from "@/lib/data";
import { ISLAND_LABEL, ago, okina } from "@/lib/brand";

// Waze's official embeddable live map (jams + crowd reports). Loaded only on tap: it's a full web app.
const WAZE: Record<Exclude<Island, "state">, { lat: number; lon: number; zoom: number }> = {
  hawaii: { lat: 19.62, lon: -155.45, zoom: 9 }, maui: { lat: 20.8, lon: -156.33, zoom: 10 },
  oahu: { lat: 21.42, lon: -157.98, zoom: 10 }, kauai: { lat: 22.05, lon: -159.5, zoom: 10 },
};

export default function TrafficPage() {
  const [stored, setIsland] = useStoredIsland();
  const island = stored === "state" ? "hawaii" : stored;
  const { snap, ess } = useFeed(island);
  const now = ess?.fetchedAt || snap?.fetchedAt || 0;
  const [showMap, setShowMap] = useState(false);
  const items = useMemo(() => (snap?.data?.items ?? []).filter((i) => i.type === "traffic" || i.type === "road_closure" || i.type === "hazard"), [snap]);
  const live = items.filter((i) => i.type === "traffic");
  const closures = items.filter((i) => i.type !== "traffic");
  const w = WAZE[island];

  return (
    <main className="relative z-[1] mx-auto w-full max-w-2xl px-5 pb-20 pt-6">
      <Link href="/" className="inline-flex items-center gap-1 text-label font-medium text-muted"><ArrowLeft className="size-4" /> Back</Link>
      <SectionNav />
      <h1 className="display mt-4 text-display font-medium leading-[1] tracking-[-0.02em] text-ink">Traffic</h1>
      <p className="mt-2 text-label text-muted">Crashes, stalled vehicles, signal problems and closures from official dispatch and roadwork feeds{snap?.data ? ` · updated ${ago(snap.data.gen, now)}` : ""}.</p>

      <nav aria-label="Island" className="no-scrollbar -mx-5 mt-4 flex gap-2 overflow-x-auto px-5">
        {ISLANDS.map((i) => (
          <button key={i} onClick={() => setIsland(i)} aria-pressed={i === island}
            className={`shrink-0 rounded-full border px-4 py-2 text-label font-medium transition-colors ${i === island ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface text-ink-2"}`}>
            {ISLAND_LABEL[i].split(" · ")[0]}
          </button>
        ))}
      </nav>

      {/* Live map, tap to load */}
      <section className="mt-5 overflow-hidden rounded-card border border-line bg-surface">
        {showMap ? (
          <iframe title={`Waze live traffic map for ${ISLAND_LABEL[island]}`} src={`https://embed.waze.com/iframe?zoom=${w.zoom}&lat=${w.lat}&lon=${w.lon}&ct=livemap`}
            className="block h-[420px] w-full" loading="lazy" allow="geolocation" />
        ) : (
          <button onClick={() => setShowMap(true)} className="flex w-full items-center gap-3 p-4 text-left">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2"><Map className="size-5" /></span>
            <span>
              <span className="block font-semibold">Show live traffic map</span>
              <span className="block text-micro text-muted">Congestion and driver reports from Waze. Uses data; skip it on a weak connection.</span>
            </span>
          </button>
        )}
      </section>

      {/* Incidents */}
      <section className="mt-6">
        <h2 className="flex items-baseline gap-2 border-b border-line pb-2"><span className="text-micro font-semibold uppercase tracking-[0.12em] text-sev2">Right now</span><span className="text-micro text-muted">{live.length}</span></h2>
        {live.length ? <ul className="divide-y divide-line">{live.map((i) => <ItemRow key={i.key} item={i} now={now} />)}</ul>
          : <div className="flex items-center gap-3 py-4 text-label text-muted">
              <CircleCheck className="size-5 text-emerald-600" />
              {island === "oahu" ? "No active incidents from Honolulu dispatch." : `No live dispatch feed exists for ${okina(ISLAND_LABEL[island].split(" · ")[0])} yet — this is where neighbours' reports will show.`}
            </div>}
      </section>
      <section className="mt-6">
        <h2 className="flex items-baseline gap-2 border-b border-line pb-2"><span className="text-micro font-semibold uppercase tracking-[0.12em] text-muted">Closures &amp; roadwork</span><span className="text-micro text-muted">{closures.length}</span></h2>
        {closures.length ? <ul className="divide-y divide-line">{closures.map((i) => <ItemRow key={i.key} item={i} now={now} />)}</ul> : <p className="py-4 text-label text-muted">None listed.</p>}
      </section>

      <Link href="/report/" className="mt-8 flex items-center gap-3 rounded-card bg-surface-2 p-4">
        <Megaphone className="size-5 text-brand" />
        <span><span className="block font-semibold">See something? Report it</span><span className="block text-micro text-ink-2">Crash, signal out, road flooded. Shown to neighbours as unverified until others confirm.</span></span>
      </Link>
    </main>
  );
}
