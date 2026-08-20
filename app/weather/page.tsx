"use client";
import { useState } from "react";
import { CloudRain, Droplets, Sun, Waves, Wind } from "lucide-react";
import PageShell, { H2 } from "@/components/PageShell";
import type { Weather } from "@/lib/pages";
import { useJson, useStoredIsland } from "@/lib/data";
import { compass } from "@/lib/storm";
import { fmtTime, okina } from "@/lib/brand";

export default function WeatherPage() {
  const [stored, setIsland] = useStoredIsland();
  const island = stored === "state" ? "hawaii" : stored;
  const w = useJson<Weather>(`v1/${island}/weather.json`);
  const d = w?.data;
  const [townId, setTownId] = useState<string | null>(null);
  const town = d?.towns.find((t) => t.id === townId) ?? d?.towns[0];

  return (
    <PageShell title="Weather" blurb="National Weather Service Honolulu, NOAA buoys, Hawaiʻi DOH air monitors" island={island} onIsland={(i) => { setIsland(i); setTownId(null); }} fetchedAt={w?.fetchedAt} offline={w?.offline}>
      {!d && <p className="py-10 text-center text-muted">{w === null ? "Loading…" : "No weather data saved yet."}</p>}
      {d && (
        <>
          {/* Town tabs */}
          <div className="no-scrollbar -mx-5 mt-5 flex gap-1.5 overflow-x-auto px-5">
            {d.towns.map((t) => (
              <button key={t.id} onClick={() => setTownId(t.id)} aria-pressed={t.id === town?.id}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium ${t.id === town?.id ? "bg-ink text-bg" : "bg-surface-2 text-ink-2"}`}>{okina(t.name)}</button>
            ))}
          </div>

          {town && (
            <section className="mt-4 rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[13px] text-muted">{okina(town.name)} now{town.obs ? ` · ${fmtTime(town.obs.at)}` : ""}</p>
                  <p className="display mt-1 text-[56px] font-medium leading-none">{town.obs?.f != null ? `${town.obs.f}°` : "—"}</p>
                  <p className="mt-1 text-[15px] text-ink-2">{town.obs?.sky ?? "Station not reporting"}</p>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px] text-ink-2">
                  <dt className="flex items-center gap-1 text-muted"><Wind className="size-3.5" /> Wind</dt><dd>{town.obs?.wMph != null ? `${town.obs.wDir != null ? compass(town.obs.wDir) : ""} ${town.obs.wMph} mph${town.obs.gMph ? ` g${town.obs.gMph}` : ""}` : "—"}</dd>
                  <dt className="flex items-center gap-1 text-muted"><Droplets className="size-3.5" /> Humidity</dt><dd>{town.obs?.rh != null ? `${town.obs.rh}%` : "—"}</dd>
                </dl>
              </div>
              <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {town.fc.map((p) => (
                  <li key={p.n} className="rounded-xl bg-surface-2 p-3">
                    <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">{p.n}</p>
                    <p className="mt-1 text-[22px] font-semibold leading-none">{p.t}°<span className="ml-1 text-[12px] font-normal text-muted">{p.day ? "high" : "low"}</span></p>
                    <p className="mt-1 text-[13px] leading-snug text-ink-2">{p.s}</p>
                    <p className="mt-1 flex items-center gap-1 text-[12px] text-muted"><CloudRain className="size-3" /> {p.pop}% · {p.wind}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {d.surf && Object.keys(d.surf.zones).length > 0 && (
            <>
              <H2 right={`NWS surf forecast · ${fmtTime(d.surf.at)}`}>Surf</H2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {Object.entries(d.surf.zones).map(([zone, shores]) => (
                  <div key={zone} className="rounded-2xl border border-line bg-surface p-4">
                    <p className="text-[13px] font-semibold">{zone.replace("Big Island", "Hawaiʻi Island")}</p>
                    <table className="mt-2 w-full text-[14px]"><tbody>
                      {Object.entries(shores).map(([shore, [today, tomorrow]]) => (
                        <tr key={shore} className="border-t border-line"><td className="py-1.5 text-ink-2">{shore}-facing</td><td className="py-1.5 text-right font-semibold tabular-nums">{today} ft</td><td className="py-1.5 text-right tabular-nums text-muted">{tomorrow} ft tomorrow</td></tr>
                      ))}
                    </tbody></table>
                  </div>
                ))}
              </div>
              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
                {d.surf.uv && <span className="inline-flex items-center gap-1"><Sun className="size-3.5" /> UV index {d.surf.uv.toLowerCase()}</span>}
                {d.buoys.map((b) => <span key={b.id} className="inline-flex items-center gap-1"><Waves className="size-3.5" /> {b.name} buoy {b.hFt} ft @ {b.perS}s{b.dir >= 0 ? ` from ${compass(b.dir)}` : ""}</span>)}
              </p>
            </>
          )}

          {d.air.length > 0 && (
            <>
              <H2 right="AirNow / Hawaiʻi DOH, hourly">Air quality</H2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {d.air.map((a) => (
                  <li key={a.name} className="rounded-full border border-line bg-surface px-3 py-1.5 text-[13px]"><strong>{a.name}</strong> PM2.5 {a.pm25} · <span className={a.cat === "Good" ? "text-emerald-700 dark:text-emerald-400" : "text-sev2"}>{a.cat}</span></li>
                ))}
              </ul>
              {island === "hawaii" && <p className="mt-2 text-[13px] text-muted">Vog and SO₂ readings are on the <a className="underline underline-offset-4" href="/volcano/">Volcano</a> page.</p>}
            </>
          )}

          <p className="mt-8 text-xs leading-relaxed text-muted">Watches, warnings and flood advisories show on the Now page and arrive as alerts. Surf heights are Hawaiian scale as issued by NWS: wave faces can be roughly twice these numbers. Data: weather.gov, ndbc.noaa.gov, airnow.gov.</p>
        </>
      )}
    </PageShell>
  );
}
