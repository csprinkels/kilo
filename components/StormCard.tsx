"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import StormMap, { catColor } from "./StormMap";
import type { Island } from "@/lib/types";
import { ISLAND_POINTS, bearingDeg, categoryOf, compass, distanceNm, ktToMph, nmToMi, outlookFor, type StormsSnapshot } from "@/lib/storm";
import { useJson } from "@/lib/data";
import { fmtDayTime, okina } from "@/lib/brand";

/** Compact tracker preview for the home page; renders nothing when no storm is active. */
export default function StormCard({ island }: { island: Exclude<Island, "state"> }) {
  const snap = useJson<StormsSnapshot>("v1/storms.json");
  const storms = snap?.data?.storms ?? [];
  if (!storms.length) return null;
  const place = ISLAND_POINTS[island];
  return (
    <section className="mt-5 space-y-3" aria-label="Storm tracker">
      {storms.map((s) => {
        const o = outlookFor(s, place);
        const d = distanceNm(s.lat, s.lon, place.lat, place.lon);
        const cat = categoryOf(s.windKt, s.cls);
        return (
          <Link key={s.id} href="/storms/" className="block overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-ink-2">
            <div className="flex items-start justify-between gap-3 p-4 pb-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white" style={{ background: catColor(s.windKt, s.cls) }}>{cat.level > 0 ? `Cat ${cat.level}` : cat.short}</span>
                  <span className="display truncate text-[22px] font-medium leading-none">{s.cls === "HU" ? "Hurricane" : s.cls === "TS" ? "Tropical Storm" : ""} {s.name}</span>
                </div>
                <p className="mt-2 text-[14px] leading-snug text-ink-2">
                  {ktToMph(s.windKt)} mph · {nmToMi(d).toLocaleString()} mi {compass(bearingDeg(place.lat, place.lon, s.lat, s.lon))} of {okina(place.label)}
                  {o.movingAway ? ", moving away" : o.tsWindsFrom ? <> · <strong className="text-sev3">TS winds possible from {fmtDayTime(o.tsWindsFrom)}</strong></> : `, closest ${fmtDayTime(o.closest.at)}`}
                </p>
              </div>
              <ArrowRight className="mt-1 size-5 shrink-0 text-muted" />
            </div>
            <StormMap storm={s} place={place} compact />
          </Link>
        );
      })}
    </section>
  );
}
