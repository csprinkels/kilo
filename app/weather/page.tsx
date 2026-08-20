"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import PageShell, { Section } from "@/components/PageShell";
import ConditionIcon from "@/components/ConditionIcon";
import HourlyChart from "@/components/HourlyChart";
import DailyRows, { rowsFromPeriods } from "@/components/DailyRows";
import ItemRow from "@/components/ItemRow";
import EmptyState from "@/components/EmptyState";
import type { Hourly, Period, TownWx, Weather } from "@/lib/pages";
import type { Island } from "@/lib/types";
import { useFeed, useJson, useStoredIsland } from "@/lib/data";
import { TOWNS } from "@/lib/towns";
import { clock, condWord, conditionCode, feelsLike, nowAndLater, sunTimes } from "@/lib/summary";
import { dirWord, plainAlert, stormLine } from "@/lib/plain";
import { ISLAND_POINTS, type StormsSnapshot } from "@/lib/storm";
import { ISLAND_LABEL, fmtTime } from "@/lib/brand";

const HOUR = 3_600_000, DAY = 86_400_000;
const dayStartHST = (ms: number) => Math.floor((ms - 10 * HOUR) / DAY) * DAY + 10 * HOUR;
const hourHST = (ms: number) => new Date(ms - 10 * HOUR).getUTCHours();

// The town choice lives in localStorage ("town") so the Now page shows the same place.
const townListeners = new Set<() => void>();
const subscribeTown = (cb: () => void) => { townListeners.add(cb); return () => { townListeners.delete(cb); }; };
const getTown = () => localStorage.getItem("town");
function useStoredTown(): [string | null, (id: string) => void] {
  const id = useSyncExternalStore(subscribeTown, getTown, () => null);
  return [id, (t) => { localStorage.setItem("town", t); townListeners.forEach((cb) => cb()); }];
}

export default function WeatherPage() {
  const [stored, setIsland] = useStoredIsland();
  const island: Exclude<Island, "state"> = stored === "state" ? "hawaii" : stored;
  // "Statewide" is gone; make the choice stick so Now and Weather agree.
  useEffect(() => { if (stored === "state") setIsland("hawaii"); }, [stored, setIsland]);
  const w = useJson<Weather>(`v1/${island}/weather.json`);
  const stormsSnap = useJson<StormsSnapshot>("v1/storms.json");
  const { snap } = useFeed(island);
  const [townId, setTownId] = useStoredTown();
  const [slow, setSlow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSlow(true), 30_000); return () => clearTimeout(t); }, []);

  const d = w?.data;
  const now = w?.fetchedAt ?? 0;
  const town = d?.towns.find((t) => t.id === townId) ?? d?.towns[0];
  const meta = TOWNS.find((t) => t.id === town?.id);
  const h = town?.hourly;

  // The town is a visible select-as-button, same look as the island pill up top.
  const title = !d || !town ? "Weather" : (
    <>Weather in{" "}
      <label className="relative inline-flex min-h-11 items-center gap-1 whitespace-nowrap rounded-full bg-surface-2 px-4 align-middle font-sans text-body font-semibold text-ink">
        {town.name} <ChevronDown className="size-5 text-ink-2" aria-hidden />
        <select aria-label="Town" value={town.id} onChange={(e) => setTownId(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
          {d.towns.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
    </>
  );

  // Official weather items worth a "heads up" (level 2) and an approaching storm, if any.
  const headsUp = (snap?.data?.items ?? []).filter((i) => i.tier !== "community" && (i.type === "advisory" || i.type === "storm") && plainAlert(i, now, island).level === 2);
  const storm = (stormsSnap?.data?.storms ?? []).map((s) => stormLine(s, ISLAND_POINTS[island])).find((l) => l.approaching && l.level >= 3);

  return (
    <PageShell title={title} island={island} onIsland={setIsland} fetchedAt={w?.fetchedAt} gen={d?.upd} offline={w?.offline} source="the National Weather Service">
      {!d && (w || slow
        ? <EmptyState kind="error" title="Can't load right now."><>Try again when you have signal. In an emergency call 911.<br /><button className="btn mt-s3" onClick={() => window.location.reload()}>Try again</button></></EmptyState>
        : <p className="mt-s4 text-body text-ink-2">Loading the weather…</p>)}

      {d && town && h && meta && (
        <>
          <RightNow town={town} meta={meta} now={now} />
          {storm && <p className="mt-s3 max-w-[36rem] text-body text-ink"><span className="font-semibold">{storm.text}</span> <Link href="/storms/" className="inline-flex min-h-11 items-center font-semibold text-brand">See the storm <ChevronRight className="size-5" aria-hidden /></Link></p>}

          <Section title="Next 24 hours" sentence={`${trendSentence(h)}${sunburn(d.surf?.uv, now)}`}>
            <HourlyChart h={h} />
          </Section>

          {town.fc.length > 0 && (
            <Section title={daysTitle(town.fc)} sentence={weekSentence(town.fc)}>
              <DailyRows fc={town.fc} />
            </Section>
          )}

          {d.surf && Object.keys(d.surf.zones).length > 0 && <Section title="Surf" sentence={surfSentence(d.surf.zones, island)} />}

          {d.air.length > 0 && (
            <Section title="Air" sentence={airSentence(d.air, town.name, island)}>
              {island === "hawaii" && <Link href="/volcano/" className="mt-s2 inline-flex min-h-11 items-center text-body font-semibold text-brand">Vog details <ChevronRight className="size-5" aria-hidden /></Link>}
            </Section>
          )}

          {headsUp.length > 0 && (
            <Section title="Heads up" sentence="Nothing dangerous, but good to know.">
              <ul className="mt-s2 divide-y divide-line">{headsUp.map((i) => <ItemRow key={i.key} item={i} now={now} />)}</ul>
            </Section>
          )}
        </>
      )}
    </PageShell>
  );
}

/** The weather picture: big icon, temperature, feels like, high/low, town and condition, then one sentence with wind and sun. */
function RightNow({ town, meta, now }: { town: TownWx; meta: { lat: number; lon: number }; now: number }) {
  const h = town.hourly!;
  const obsFresh = !!town.obs && now - town.obs.at < 2 * HOUR;
  const code = obsFresh && town.obs?.sky ? conditionCode("", town.obs.sky) : h.c[0];
  const night = !!h.n[0];
  const temp = (obsFresh ? town.obs?.f : undefined) ?? h.t[0];
  const fl = obsFresh && town.obs?.f != null && town.obs.rh != null ? feelsLike(town.obs.f, town.obs.rh) : undefined;
  const hi = town.fc.find((p) => p.day)?.t, lo = town.fc.find((p) => !p.day)?.t;
  const mph = (obsFresh ? town.obs?.wMph : undefined) ?? h.w[0];
  const deg = obsFresh && town.obs?.wDir != null ? town.obs.wDir : h.wd[0] * 22.5;
  const wind = mph == null ? "" : mph < 4 ? " Almost no wind." : ` Wind from the ${dirWord(deg)}, ${mph} mph.`;
  const d0 = dayStartHST(now);
  const sun = [0, 1].map((k) => sunTimes(d0 + k * DAY, meta.lat, meta.lon)).flatMap((s) => [{ k: "Sunrise", at: s.rise }, { k: "Sunset", at: s.set }]).find((s) => s.at > now);
  return (
    <section className="mt-s4" aria-label={`${town.name} right now`}>
      <div className="flex items-center gap-s4">
        <ConditionIcon code={code} night={night} size={88} />
        <div className="min-w-0">
          <p className="text-number font-semibold text-ink num">{temp != null ? `${temp}°` : "—"}</p>
          <p className="text-body text-ink-2 num">{fl != null && Math.abs(fl - (temp ?? fl)) >= 3 ? `Feels like ${fl}°. ` : ""}{hi != null && lo != null ? `High ${hi}°, low ${lo}°.` : ""}</p>
          <p className="text-body font-semibold text-ink">{town.name} · {condWord(code)}</p>
        </div>
      </div>
      <p className="mt-s3 max-w-[36rem] text-body text-ink-2 num">{nowAndLater(obsFresh ? code : undefined, h)}{wind}{sun ? ` ${sun.k} at ${fmtTime(sun.at)}.` : ""}</p>
    </section>
  );
}

/** "Down to 73° around 3 AM, then up to 84° by 2 PM." */
function trendSentence(h: Hourly): string {
  const n = Math.min(24, h.t.length), t = h.t.slice(0, n);
  const iMax = t.indexOf(Math.max(...t)), iMin = t.indexOf(Math.min(...t));
  const at = (i: number) => clock(h.t0 + i * HOUR).replace("12 AM", "midnight").replace("12 PM", "noon");
  if (t[iMax] - t[iMin] < 4) return `Around ${t[0]}° all day.`;
  if (iMin === 0) return `Up to ${t[iMax]}° around ${at(iMax)}.`;
  if (iMax === 0) return `Down to ${t[iMin]}° around ${at(iMin)}.`;
  return iMin < iMax ? `Down to ${t[iMin]}° around ${at(iMin)}, then up to ${t[iMax]}° by ${at(iMax)}.` : `Up to ${t[iMax]}° around ${at(iMax)}, then down to ${t[iMin]}° by ${at(iMin)}.`;
}

const sunburn = (uv: string | undefined, now: number) => (uv && /very high|extreme/i.test(uv) && hourHST(now) < 16 ? " Sunburn risk very high this afternoon." : "");

// The feed carries however many days the publisher sends; the heading says that number, never more.
const daysTitle = (fc: Period[]) => { const n = fc.filter((p) => p.day).length; return n >= 7 ? "Next 7 days" : n <= 1 ? "Today and tonight" : `Next ${n} days`; };

/** "Warmest Thursday, 86°. Rain likely Saturday." */
function weekSentence(fc: Period[]): string {
  const rows = rowsFromPeriods(fc);
  const highs = rows.map((r) => r.hi).filter((t): t is number => t != null);
  const name = (s: string) => (s === "Today" || s === "Tonight" ? s.toLowerCase() : s.replace(" Night", " night"));
  const warm = rows.find((r) => r.hi === Math.max(...highs));
  const heat = !highs.length ? "" : Math.max(...highs) - Math.min(...highs) < 2 ? `Highs around ${highs[0]}°.` : `Warmest ${name(warm!.name)}, ${warm!.hi}°.`;
  // Today's rain is already in the hourly picture; name a later day when one qualifies.
  const later = rows.slice(1);
  const wet = later.find((r) => r.pop >= 60) ?? rows.find((r) => r.pop >= 60);
  const damp = later.find((r) => r.pop >= 40) ?? rows.find((r) => r.pop >= 40);
  const rain = wet ? `Rain likely ${name(wet.name)}.` : damp ? `Some showers ${name(damp.name)}.` : "Mostly dry.";
  return `${heat} ${rain}`.trim();
}

/** One sentence from the surf forecast: which side, how big, and whether tomorrow is bigger. */
function surfSentence(zones: Record<string, Record<string, [string, string]>>, island: Island): string {
  const hi = (s: string) => parseInt(s.split("-")[1] ?? s) || 0;
  const words = (s: string) => s.replace("-", " to ");
  const biggest = (shores: Record<string, [string, string]>) => Object.values(shores).reduce((a, b) => (hi(b[0]) > hi(a[0]) ? b : a));
  let parts: string[];
  if (island === "hawaii") {
    const side = (re: RegExp) => { const z = Object.entries(zones).find(([k]) => re.test(k)); return z ? biggest(z[1]) : undefined; };
    const hilo = side(/windward/i), kona = side(/leeward/i);
    parts = [hilo && `${words(hilo[0])} feet on the Hilo side`, kona && `${words(kona[0])} on the Kona side`].filter((s): s is string => !!s);
  } else {
    // Group shores that share a forecast: "2 to 4 feet on south and east shores, 0 to 2 on north and west shores."
    const shores = Object.values(zones)[0] ?? {};
    const groups = new Map<string, string[]>();
    for (const [shore, [today]] of Object.entries(shores)) groups.set(today, [...(groups.get(today) ?? []), shore.toLowerCase()]);
    parts = [...groups.entries()].sort((a, b) => hi(b[0]) - hi(a[0])).slice(0, 2).map(([rng, ss], k) => `${words(rng)}${k ? "" : " feet"} on ${ss.join(" and ")} shores`);
  }
  if (!parts.length) return "";
  const all = Object.values(zones).flatMap((z) => Object.values(z));
  const today = Math.max(...all.map((r) => hi(r[0]))), tomorrow = Math.max(...all.map((r) => hi(r[1])));
  const trend = tomorrow - today >= 2 ? " Bigger tomorrow." : today - tomorrow >= 2 ? " Smaller tomorrow." : " About the same tomorrow.";
  return `Waves ${parts.join(", ")}.${trend}`;
}

/** Air in EPA words for the town's monitor (or the island when there is none nearby). */
function airSentence(air: Weather["air"], townName: string, island: Island): string {
  const here = air.find((a) => a.name === townName || townName.startsWith(a.name));
  const worst = air.reduce((a, b) => (rank(b.cat) > rank(a.cat) ? b : a));
  const m = here ?? worst;
  const place = here ? `in ${m.name}` : rank(worst.cat) === 0 ? `across ${ISLAND_LABEL[island].split(" · ")[0]}` : `in ${m.name}`;
  const what = island === "hawaii" ? "Vog" : "Air";
  switch (rank(m.cat)) {
    case 0: return `Air is good ${place}.`;
    case 1: return `Air is okay ${place}.`;
    case 2: return `${what} is bad for people with asthma ${place} today. Stay inside if it bothers you.`;
    default: return `Air is unhealthy for everyone ${place} today. Stay inside and skip hard exercise.`;
  }
}
const rank = (cat: string) => (/good/i.test(cat) ? 0 : /moderate/i.test(cat) ? 1 : /sensitive/i.test(cat) ? 2 : 3);
