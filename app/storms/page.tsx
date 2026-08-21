"use client";
import { useState } from "react";
import Icon from "@/components/Icon";
import EmptyState from "@/components/EmptyState";
import PageShell from "@/components/PageShell";
import StormTracker from "@/components/StormTracker";
import { ISLAND_POINTS, bearingDeg, distanceNm, nmToMi, type StormsSnapshot } from "@/lib/storm";
import { dirWord, rankStorms, stormName, windsLine } from "@/lib/plain";
import { useJson, useStoredIsland } from "@/lib/data";

const SOURCE = "the Central Pacific Hurricane Center";

export default function StormsPage() {
  const [stored, setIsland] = useStoredIsland();
  const island = stored === "state" ? "hawaii" : stored;
  const place = ISLAND_POINTS[island];
  const snap = useJson<StormsSnapshot>("v1/storms.json");
  const [pick, setPick] = useState<string | null>(null);

  const miles = (s: { lat: number; lon: number }) => nmToMi(distanceNm(s.lat, s.lon, place.lat, place.lon));
  const storms = rankStorms(snap?.data?.storms ?? [], place).map((x) => x.s); // the one that matters here first
  const shown = storms.find((s) => s.id === pick) ?? storms[0];
  const shell = { island, onIsland: setIsland, fetchedAt: snap?.fetchedAt, gen: snap?.data?.gen, offline: snap?.offline, source: SOURCE };

  if (snap && !snap.data) {
    return (
      <PageShell {...shell} fetchedAt={undefined} title="Storms">
        <EmptyState kind="error" title="Can't load right now.">Try again when you have signal. In an emergency call 911.</EmptyState>
        {/* useJson refetches on the window "online" event, so this is a retry without a page reload. */}
        <button className="btn mt-s4" onClick={() => window.dispatchEvent(new Event("online"))}>Try again</button>
      </PageShell>
    );
  }

  if (!shown) {
    return (
      <PageShell {...shell} title="Storms" sentence={snap ? "No hurricanes or tropical storms near Hawaiʻi. Hurricane season runs June to November." : undefined}>
        {!snap && <p className="mt-s4 text-body text-ink-2">Checking for storms…</p>}
      </PageShell>
    );
  }

  return (
    <PageShell {...shell} title={stormName(shown)} sentence={windsLine(shown)}>
      <StormTracker key={shown.id} storm={shown} island={island} />
      {storms.filter((s) => s !== shown).map((s) => (
        <button key={s.id} className="row mt-s4 border-t border-line text-body text-ink num" onClick={() => { setPick(s.id); window.scrollTo({ top: 0 }); }}>
          <span className="min-w-0 flex-1">Also: {stormName(s)}, {miles(s).toLocaleString("en-US")} miles {dirWord(bearingDeg(place.lat, place.lon, s.lat, s.lon))}</span>
          <Icon name="caret-right" className="size-5 shrink-0 text-ink-2" aria-hidden />
        </button>
      ))}
    </PageShell>
  );
}
