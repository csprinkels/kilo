"use client";
import { useMemo, useState } from "react";
import { ArrowUp, Droplets, Sun, Sunrise, Sunset, Waves } from "lucide-react";
import PageShell, { H2 } from "@/components/PageShell";
import ConditionIcon, { toneVar } from "@/components/ConditionIcon";
import HourlyChart from "@/components/HourlyChart";
import DailyRows from "@/components/DailyRows";
import type { Weather } from "@/lib/pages";
import { useJson, useStoredIsland } from "@/lib/data";
import { TOWNS } from "@/lib/towns";
import { clock, condWord, conditionCode, feelsLike, summarize, sunTimes } from "@/lib/summary";
import { ago, fmtTime, okina } from "@/lib/brand";

const HST = -10 * 3_600_000;
const dayStartHST = (ms: number) => Math.floor((ms + HST) / 86_400_000) * 86_400_000 - HST;

export default function WeatherPage() {
  const [stored, setIsland] = useStoredIsland();
  const island = stored === "state" ? "hawaii" : stored;
  const w = useJson<Weather>(`v1/${island}/weather.json`);
  const d = w?.data;
  const [townId, setTownId] = useState<string | null>(null);
  const town = d?.towns.find((t) => t.id === townId) ?? d?.towns[0];
  const meta = TOWNS.find((t) => t.id === town?.id);
  const h = town?.hourly;

  const sun = useMemo(() => {
    if (!h || !meta) return [];
    const d0 = dayStartHST(h.t0);
    return [0, 1, 2].map((k) => sunTimes(d0 + k * 86_400_000, meta.lat, meta.lon));
  }, [h, meta]);
  const sentence = h ? summarize(h) : undefined;
  // A fresh observation beats the forecast code for "right now"; the icon and tint follow it.
  const obsFresh = town?.obs && (w?.fetchedAt ?? 0) - town.obs.at < 2 * 3_600_000;
  const nowCode = obsFresh && town?.obs?.sky ? conditionCode("", town.obs.sky) : (h?.c[0] ?? 2);
  const night = !!h?.n[0];
  const temp = town?.obs?.f ?? h?.t[0];
  const fl = town?.obs?.f != null && town.obs.rh != null ? feelsLike(town.obs.f, town.obs.rh) : undefined;
  const dayRows = town ? town.fc : [];
  const hi = dayRows.find((p) => p.day)?.t, lo = dayRows.find((p) => !p.day)?.t;
  const nextSun = sun.flatMap((s) => [{ at: s.rise, kind: "rise" as const }, { at: s.set, kind: "set" as const }]).find((s) => s.at > (w?.fetchedAt ?? 0));
  const soonSun = nextSun && nextSun.at - (w?.fetchedAt ?? 0) < 2 * 3_600_000 ? nextSun : undefined;

  return (
    <PageShell title="Weather" blurb="NWS Honolulu · NOAA buoys · DOH air monitors" island={island} onIsland={(i) => { setIsland(i); setTownId(null); }} fetchedAt={w?.fetchedAt} offline={w?.offline}>
      {!d && <HeroSkeleton />}
      {d && (
        <>
          <div className="no-scrollbar -mx-5 mt-s4 flex gap-s2 overflow-x-auto px-5">
            {d.towns.map((t) => (
              <button key={t.id} onClick={() => setTownId(t.id)} aria-pressed={t.id === town?.id} className={`btn shrink-0 ${t.id === town?.id ? "chip-active" : ""}`}>{okina(t.name)}</button>
            ))}
          </div>

          {town && (
            <section className="card-hero mt-s4" style={{ ["--cond" as string]: toneVar(nowCode, night) }} aria-label={`${town.name} now`}>
              <p className="text-micro font-semibold uppercase tracking-[0.12em] text-muted num">{okina(town.name)} · {town.obs ? `${fmtTime(town.obs.at)} (${ago(town.obs.at, w?.fetchedAt)})` : "forecast"}</p>
              <div className="mt-s3 flex items-start justify-between gap-s4">
                <div className="flex items-center gap-s3">
                  <ConditionIcon code={nowCode} night={night} size={44} />
                  <span className="font-display text-hero font-normal num" style={{ fontVariationSettings: '"opsz" 144, "SOFT" 30' }}>{temp != null ? `${temp}°` : "—"}</span>
                </div>
                <dl className="pt-s2 text-right">
                  {fl != null && Math.abs(fl - (temp ?? fl)) >= 3 && <><dt className="sr-only">Feels like</dt><dd className="text-lead text-muted num">Feels like {fl}°</dd></>}
                  {(hi != null || lo != null) && <><dt className="sr-only">High and low</dt><dd className="text-body num"><span className="text-muted">H</span> {hi ?? "—"}° <span className="ml-2 text-muted">L</span> {lo ?? "—"}°</dd></>}
                </dl>
              </div>
              <p className="mt-s2 text-body font-medium">{obsFresh && town.obs?.sky ? town.obs.sky : condWord(nowCode)}</p>
              {sentence && <p className="mt-s1 text-lead text-ink-2">{sentence}</p>}
              <p className="mt-s3 flex flex-wrap items-center gap-x-s4 gap-y-s1 text-label text-muted num">
                {town.obs?.wMph != null && <span className="inline-flex items-center gap-1"><ArrowUp className="size-3.5" style={{ transform: `rotate(${(town.obs.wDir ?? 0) + 180}deg)` }} /> {town.obs.wMph} mph{town.obs.gMph ? ` · gusts ${town.obs.gMph}` : ""}</span>}
                {town.obs?.rh != null && <span className="inline-flex items-center gap-1"><Droplets className="size-3.5" /> {town.obs.rh}%</span>}
                {d.surf?.uv && <span className="inline-flex items-center gap-1"><Sun className="size-3.5" /> UV {d.surf.uv.toLowerCase()}</span>}
                {soonSun && <span className="inline-flex items-center gap-1">{soonSun.kind === "rise" ? <Sunrise className="size-3.5" /> : <Sunset className="size-3.5" />} {soonSun.kind === "rise" ? "Sunrise" : "Sunset"} {clock(soonSun.at)}</span>}
              </p>
            </section>
          )}

          {h && (
            <>
              <H2 right="next 24 hours">Hourly</H2>
              <HourlyChart h={h} hours={24} sun={sun} title={sentence ?? "Hourly forecast"} />
            </>
          )}

          {dayRows.length > 0 && (
            <>
              <H2 right="NWS · highs and lows on one scale">Days</H2>
              <DailyRows fc={dayRows} nowTemp={temp} />
            </>
          )}

          {d.surf && Object.keys(d.surf.zones).length > 0 && (
            <>
              <H2 right={`NWS surf forecast · ${fmtTime(d.surf.at)}`}>Surf</H2>
              <p className="mt-s2 text-body text-ink-2">{surfSentence(d.surf.zones)}</p>
              <div className="mt-s3 grid gap-s3 sm:grid-cols-2">
                {Object.entries(d.surf.zones).map(([zone, shores]) => (
                  <div key={zone} className="card">
                    <p className="text-label font-semibold">{zone.replace("Big Island", "Hawaiʻi Island")}</p>
                    <table className="mt-s2 w-full text-body num"><tbody>
                      {Object.entries(shores).map(([shore, [today, tomorrow]]) => {
                        const [a, b] = [parseInt(today.split("-")[1] ?? today), parseInt(tomorrow.split("-")[1] ?? tomorrow)];
                        return (
                          <tr key={shore} className="h-11 border-t border-line"><td className="text-ink-2">{shore}-facing</td><td className="text-right font-medium">{today} ft</td><td className="text-right text-muted">{tomorrow} ft{Number.isFinite(a) && Number.isFinite(b) && Math.abs(b - a) >= 2 ? (b > a ? " ↑" : " ↓") : ""}</td></tr>
                        );
                      })}
                    </tbody></table>
                  </div>
                ))}
              </div>
              {d.buoys.length > 0 && <p className="mt-s2 flex flex-wrap gap-x-s4 text-micro text-muted num">{d.buoys.map((b) => <span key={b.id} className="inline-flex items-center gap-1"><Waves className="size-3.5" /> {b.name} buoy {b.hFt} ft @ {b.perS}s</span>)}</p>}
            </>
          )}

          {d.air.length > 0 && (
            <>
              <H2 right="AirNow · Hawaiʻi DOH">Air</H2>
              <p className="mt-s2 text-body num">
                <span className="text-h2 font-semibold">{d.air[0].pm25}</span> <span className="text-ink-2">AQI · {d.air[0].cat} in {d.air[0].name}</span>
                {d.air.length > 1 && <span className="text-muted">{d.air.slice(1).map((a) => ` · ${a.name} ${a.pm25}`)}</span>}
              </p>
              {island === "hawaii" && <p className="mt-s1 text-label text-muted">SO₂ and vog readings are on the <a className="underline underline-offset-4" href="/volcano/">Volcano</a> page.</p>}
            </>
          )}

          <p className="mt-s6 text-micro leading-relaxed text-muted">Watches and warnings show on the Now page and arrive as alerts. Surf is Hawaiian scale as issued by NWS; wave faces can be roughly twice these numbers. Data: weather.gov, ndbc.noaa.gov, airnow.gov.</p>
        </>
      )}
    </PageShell>
  );
}

function surfSentence(zones: Record<string, Record<string, [string, string]>>): string {
  const rows = Object.values(zones).flatMap((z) => Object.entries(z));
  if (!rows.length) return "";
  const hi = (s: string) => parseInt(s.split("-")[1] ?? s) || 0;
  const top = rows.reduce((a, b) => (hi(b[1][0]) > hi(a[1][0]) ? b : a));
  const trend = hi(top[1][1]) - hi(top[1][0]);
  return `${top[0]} shores ${top[1][0]} ft${trend >= 2 ? ", building tomorrow." : trend <= -2 ? ", dropping tomorrow." : "; similar tomorrow."}`;
}

function HeroSkeleton() {
  return (
    <div className="mt-s4 space-y-s3" aria-hidden>
      <div className="h-11 w-2/3 animate-pulse rounded-chip bg-surface-2" />
      <div className="h-[180px] animate-pulse rounded-hero bg-surface-2" />
      <div className="h-[160px] animate-pulse rounded-card bg-surface-2" />
    </div>
  );
}
