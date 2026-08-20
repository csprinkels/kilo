"use client";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import StormMap from "./StormMap";
import { bearingDeg, compass, distanceNm, ktToMph, nmToMi, outlookFor, type Storm } from "@/lib/storm";
import { fmtDayTime } from "@/lib/brand";

const CLS: Record<string, string> = { HU: "Hurricane", TS: "Tropical Storm", TD: "Tropical Depression", PTC: "Potential Tropical Cyclone" };

/** Home-page storm section: one sentence for every active system, one map for the one that matters most. */
export default function StormCard({ storms, place }: { storms: Storm[]; place: { lat: number; lon: number; label: string } }) {
  const ranked = storms
    .map((s) => ({ s, o: outlookFor(s, place), d: nmToMi(distanceNm(s.lat, s.lon, place.lat, place.lon)) }))
    .sort((a, b) => Number(a.o.movingAway) - Number(b.o.movingAway) || a.o.closest.distNm - b.o.closest.distNm);
  const [main, ...rest] = ranked;
  // The island is already in the header, so "981 mi ESE" needs no "of Hawaiʻi Island". Wind speed only for the main one.
  const sentence = (x: typeof main, i: number) => {
    const name = `${CLS[x.s.cls] ?? ""} ${x.s.name}`.trim();
    const where = `${x.d.toLocaleString()} mi ${compass(bearingDeg(place.lat, place.lon, x.s.lat, x.s.lon))}${i === 0 ? `, ${ktToMph(x.s.windKt)} mph winds` : ""}`;
    if (x.o.movingAway) return `${name} is ${where}, moving away.`;
    if (x.o.tsWindsFrom) return `${name} is ${where}; tropical-storm winds possible from ${fmtDayTime(x.o.tsWindsFrom)}.`;
    return `${name} is ${where}, closest ${fmtDayTime(x.o.closest.at)}.`;
  };
  return (
    <section className="mt-10" aria-label="Storms">
      <h2 className="h2-display">Storms</h2>
      <p className="mt-s2 text-body leading-snug text-ink-2">{ranked.map(sentence).join(" ")}</p>
      <Link href="/storms/" className="mt-s3 block overflow-hidden rounded-card border border-line bg-surface">
        <StormMap storm={main.s} place={place} compact />
      </Link>
      <Link href="/storms/" className="mt-s2 inline-flex items-center gap-1 text-label font-medium text-brand">Storm tracker{rest.length ? ` · ${rest.map((r) => r.s.name).join(", ")}` : ""} <ChevronRight className="size-4" /></Link>
    </section>
  );
}
