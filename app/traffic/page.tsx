"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { CarFront, Map, Megaphone } from "lucide-react";
import ItemRow from "@/components/ItemRow";
import PageShell, { H2 } from "@/components/PageShell";
import Hero from "@/components/Hero";
import EmptyState from "@/components/EmptyState";
import type { Island } from "@/lib/types";
import { useFeed, useStoredIsland } from "@/lib/data";
import { ISLAND_LABEL } from "@/lib/brand";

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

  const signals = live.filter((i) => i.status === "signal").length, crashes = live.filter((i) => i.status === "crash").length;
  const parts = [signals && `${signals} signal problem${signals > 1 ? "s" : ""}`, crashes && `${crashes} crash${crashes > 1 ? "es" : ""}`, live.length - signals - crashes > 0 && `${live.length - signals - crashes} other`].filter(Boolean);
  const islandName = ISLAND_LABEL[island].split(" · ")[0];
  const neighbours = live.filter((i) => i.tier === "community").length;
  const via = neighbours === live.length ? "reported by neighbours" : neighbours ? "reported to dispatch or by neighbours" : "reported to dispatch";
  const sentence = live.length
    ? `${parts.join(", ")} ${via} in the last few hours${closures.length ? `, plus ${closures.length} closure${closures.length > 1 ? "s" : ""} and roadwork` : ""}.`
    : island === "oahu" ? `Nothing active from Honolulu dispatch${closures.length ? `; ${closures.length} planned closure${closures.length > 1 ? "s" : ""}` : ""}.`
    : `No live dispatch feed exists for ${islandName} yet${closures.length ? ` — ${closures.length} closure${closures.length > 1 ? "s" : ""} and roadwork listed` : ""}. Neighbour reports fill the gap.`;

  return (
    <PageShell title="Traffic" island={island} onIsland={setIsland} fetchedAt={ess?.fetchedAt ?? snap?.fetchedAt} gen={snap?.data?.gen} offline={!!snap?.offline && !!ess?.offline} source={island === "oahu" ? "Honolulu 911 dispatch" : "County + HDOT"}>
      {!snap?.data && <EmptyState kind="loading" title="" />}
      {snap?.data && (
        <>
          <Hero
            tone={live.length ? "var(--sev2)" : "var(--cond-windy)"}
            eyebrow={`${islandName} · right now`}
            icon={<CarFront className="size-11 text-ink-2" strokeWidth={1.75} aria-hidden />}
            value={live.length}
            label={live.length === 1 ? "active incident" : "active incidents"}
            sentence={sentence}
          />

          <section className="card mt-s4 overflow-hidden p-0">
            {showMap ? (
              <iframe title={`Waze live traffic map for ${ISLAND_LABEL[island]}`} src={`https://embed.waze.com/iframe?zoom=${w.zoom}&lat=${w.lat}&lon=${w.lon}&ct=livemap`} className="block h-[420px] w-full" loading="lazy" allow="geolocation" />
            ) : (
              <button onClick={() => setShowMap(true)} className="flex min-h-14 w-full items-center gap-s3 p-s4 text-left">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2"><Map className="size-5" /></span>
                <span className="min-w-0"><span className="block text-body font-semibold">Show live traffic map</span><span className="block text-label text-muted">Congestion and driver reports from Waze. Uses data — skip it on a weak connection.</span></span>
              </button>
            )}
          </section>

          <H2 right={`${live.length}`}>Right now</H2>
          {live.length ? <ul className="divide-y divide-line">{live.map((i) => <ItemRow key={i.key} item={i} now={now} />)}</ul>
            : <EmptyState title={island === "oahu" ? "No active incidents from Honolulu dispatch" : `No live incident feed for ${islandName}`}>{island === "oahu" ? "Crashes, stalled vehicles and signal problems appear here within minutes of a 911 call." : "Neighbour reports are the source here — tap Report when you see something."}</EmptyState>}

          <H2 right={`${closures.length}`}>Closures &amp; roadwork</H2>
          {closures.length ? <ul className="divide-y divide-line">{closures.map((i) => <ItemRow key={i.key} item={i} now={now} />)}</ul> : <p className="mt-s3 text-body text-muted">None listed.</p>}

          <Link href="/report/" className="card mt-s6 flex items-center gap-s3">
            <Megaphone className="size-6 text-brand" />
            <span><span className="block text-body font-semibold">See something? Report it</span><span className="block text-label text-ink-2">Crash, signal out, road flooded. Shown to neighbours as unverified until others confirm.</span></span>
          </Link>
        </>
      )}
    </PageShell>
  );
}
