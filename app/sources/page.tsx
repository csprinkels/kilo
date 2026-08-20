import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { APP_NAME, okina } from "@/lib/brand";

const SOURCES = [
  { name: "National Weather Service — Honolulu", what: "Watches, warnings and advisories for every Hawaiʻi zone", url: "https://www.weather.gov/hfo/" },
  { name: "Hawaiʻi County Civil Defense (public GIS)", what: "Open shelters, road closures, evacuations, hazards, school closures", url: "https://www.arcgis.com/apps/dashboards/5865229bcba74020992b372ef18b6f17" },
  { name: "Hawaiʻi DOT Highways", what: "State highway lane closures in effect today, all islands", url: "https://experience.arcgis.com/experience/397fed5aafdb4f25b73e342ef35f2ec5" },
  { name: "Hawaiʻi Emergency Management Agency", what: "State proclamations and news", url: "https://dod.hawaii.gov/hiema/" },
  { name: "USGS Earthquakes", what: "Magnitude 2.5+ earthquakes in Hawaiian waters, last 3 days", url: "https://earthquake.usgs.gov/earthquakes/map/?extent=17,-162&extent=23,-153" },
  { name: "USGS Hawaiian Volcano Observatory", what: "Alert level and color code for Kīlauea and Mauna Loa", url: "https://www.usgs.gov/observatories/hvo" },
  { name: "Pacific Tsunami Warning Center", what: "Tsunami warnings, watches, advisories and information statements", url: "https://www.tsunami.gov/" },
];

const H = ({ children }: { children: React.ReactNode }) => <h2 className="display mt-9 text-[22px] font-medium tracking-tight">{children}</h2>;

export default function Sources() {
  return (
    <main className="relative z-[1] mx-auto w-full max-w-2xl px-5 pb-20 pt-6 text-[16px] leading-relaxed text-ink-2">
      <Link href="/" className="inline-flex items-center gap-1 text-sm font-medium text-muted"><ArrowLeft className="size-4" /> Back</Link>
      <h1 className="display mt-5 text-[40px] font-medium leading-[1] tracking-[-0.02em] text-ink">About {okina(APP_NAME)}</h1>
      <p className="mt-5 text-[18px] leading-relaxed text-ink">
        One page that pulls official Hawaiʻi emergency and community information into a single list, sorted by what matters most — and keeps the last copy on your phone so it still opens when the signal is gone.
      </p>

      <H>What this is not</H>
      <p className="mt-2">
        Not an emergency service and not affiliated with any government agency. Information may be delayed or incomplete. <strong className="text-ink">In an emergency call 911.</strong> When in doubt, follow Civil Defense radio messages and your county&apos;s alert system.
      </p>

      <H>Sources</H>
      <ul className="mt-3 divide-y divide-line">
        {SOURCES.map((s) => (
          <li key={s.url} className="py-3">
            <a className="inline-flex items-center gap-1.5 font-semibold text-ink underline-offset-4 hover:underline" href={s.url} target="_blank" rel="noreferrer">
              {s.name} <ExternalLink className="size-3.5 text-muted" />
            </a>
            <div className="text-[14px] text-muted">{s.what}</div>
          </li>
        ))}
      </ul>

      <H>How fresh is it?</H>
      <p className="mt-2">
        Feeds are checked every two minutes. Every item shows when its source last listed it. If updates stop for more than 30 minutes you&apos;ll see an amber banner; if your phone can&apos;t reach the internet you&apos;ll see a red one with the time of the saved copy.
      </p>

      <H>Add to your home screen</H>
      <p className="mt-2">
        <strong className="text-ink">iPhone:</strong> Share → <em>Add to Home Screen</em>. <strong className="text-ink">Android:</strong> menu → <em>Install app</em>. It then opens full-screen and works offline.
      </p>

      <p className="mt-10 text-sm text-muted">Built in Hilo. Free, no ads, no account needed to read.</p>
    </main>
  );
}
