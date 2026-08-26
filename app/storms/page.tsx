"use client";
import { useState } from "react";
import Icon from "@/components/Icon";
import EmptyState from "@/components/EmptyState";
import PageShell from "@/components/PageShell";
import StormTracker from "@/components/StormTracker";
import { ISLAND_POINTS, bearingDeg, distanceNm, nmToMi, type StormsSnapshot } from "@/lib/storm";
import { dirWord, rankStorms, stormName } from "@/lib/plain";
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
  const others = storms.filter((s) => s !== shown);
  const shell = { island, onIsland: setIsland, fetchedAt: snap?.fetchedAt, gen: snap?.data?.gen, offline: snap?.offline, source: SOURCE };

  if (snap && !snap.data) {
    return (
      <PageShell {...shell} fetchedAt={undefined} title="Storms">
        <div className="st-stack mt-s5">
          <section className="cs-card st-flush">
            {/* useJson refetches on the window "online" event, so this is a retry without a page reload. */}
            <EmptyState kind="error" title="Can't load right now." onRetry={() => window.dispatchEvent(new Event("online"))}>Try again when you have signal. In an emergency call 911.</EmptyState>
          </section>
        </div>
      </PageShell>
    );
  }

  // Most days. One card, one sentence, the calm mark beside it — the same shape the alarm uses.
  if (!shown) {
    return (
      <PageShell {...shell} title="Storms">
        <div className="st-stack mt-s5">
          <section className="cs-card cs-hero">
            {snap ? (
              <div className="cs-heroline">
                <span className="cs-ictile cs-ictile--teal"><Icon name="check-circle" size={21} className="cs-ic" /></span>
                <p className="cs-body cs-body--hero st-heroline-body">No hurricanes or tropical storms near <span className="cs-haw">Hawaiʻi</span>. Hurricane season runs June to November.</p>
              </div>
            ) : (
              <p className="cs-body st-do">Checking for storms…</p>
            )}
          </section>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell {...shell} title={stormName(shown)}>
      <div className="st-stack mt-s5">
        <StormTracker key={shown.id} storm={shown} island={island} />
        {others.length > 0 && (
          <section className="cs-card st-flush">
            {others.map((s) => (
              <button key={s.id} type="button" className="cs-row cs-row--mid st-row" onClick={() => { setPick(s.id); window.scrollTo({ top: 0 }); }}>
                <span className="cs-rowmain">
                  <span className="cs-rowname num">Also: {stormName(s)}, {miles(s).toLocaleString("en-US")} miles {dirWord(bearingDeg(place.lat, place.lon, s.lat, s.lon))}</span>
                </span>
                <Icon name="caret-right" size={16} className="cs-ic" />
              </button>
            ))}
          </section>
        )}
      </div>
    </PageShell>
  );
}
