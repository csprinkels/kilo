import Link from "next/link";
import { APP_NAME } from "@/lib/brand";

const SOURCES = [
  { name: "National Weather Service — Honolulu", what: "Watches, warnings and advisories for every Hawaiʻi zone", url: "https://www.weather.gov/hfo/" },
  { name: "Hawaiʻi County Civil Defense (public GIS)", what: "Open shelters, road closures, evacuations, hazards, school closures", url: "https://www.arcgis.com/apps/dashboards/5865229bcba74020992b372ef18b6f17" },
];

export default function Sources() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 text-[15px] leading-relaxed">
      <Link href="/" className="text-sm underline">← Back</Link>
      <h1 className="mt-3 text-2xl font-bold">About {APP_NAME}</h1>
      <p className="mt-3">
        One page that pulls official Hawaiʻi emergency and community information into a single list, sorted by what matters most, and keeps the last copy on your phone so it still opens when the signal is gone.
      </p>
      <h2 className="mt-6 text-lg font-semibold">What this is not</h2>
      <p className="mt-2">
        Not an emergency service and not affiliated with any government agency. Information may be delayed or incomplete. <strong>In an emergency call 911.</strong> When in doubt, follow Civil Defense radio messages and your county&apos;s alert system.
      </p>
      <h2 className="mt-6 text-lg font-semibold">Sources</h2>
      <ul className="mt-2 space-y-3">
        {SOURCES.map((s) => (
          <li key={s.url}>
            <a className="font-medium underline" href={s.url} target="_blank" rel="noreferrer">{s.name} ↗</a>
            <div className="text-sm text-muted">{s.what}</div>
          </li>
        ))}
      </ul>
      <h2 className="mt-6 text-lg font-semibold">How fresh is it?</h2>
      <p className="mt-2">
        Feeds are checked every two minutes. Every item shows when its source last listed it. If updates stop for more than 30 minutes you&apos;ll see an amber banner; if your phone can&apos;t reach the internet you&apos;ll see a red one with the time of the saved copy.
      </p>
      <h2 className="mt-6 text-lg font-semibold">Add to your home screen</h2>
      <p className="mt-2">
        iPhone: Share → <em>Add to Home Screen</em>. Android: menu → <em>Install app</em>. It then opens full-screen and works offline.
      </p>
      <p className="mt-8 text-sm text-muted">Built in Hilo. Free, no ads, no account needed to read.</p>
    </main>
  );
}
