"use client";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  Activity, CarFront, ChevronDown, ChevronRight, CircleCheck, CloudRainWind, ExternalLink, Gauge, Megaphone, Mountain,
  Radio, School, Siren, Tent, TrafficCone, TriangleAlert, Users, Waves, Wind, ZapOff, type LucideIcon,
} from "lucide-react";
import ItemRow, { ICON, SEV_TEXT } from "@/components/ItemRow";
import Banner from "@/components/Banner";
import StormCard from "@/components/StormCard";
import AlertsCard from "@/components/AlertsCard";
import SectionNav from "@/components/SectionNav";
import TopBar from "@/components/TopBar";
import ConditionIcon from "@/components/ConditionIcon";
import type { DigestItem, Island, Item, ItemType } from "@/lib/types";
import { ISLANDS, hashOf } from "@/lib/types";
import type { StormsSnapshot } from "@/lib/storm";
import { ISLAND_POINTS, outlookFor } from "@/lib/storm";
import type { Weather } from "@/lib/pages";
import { useFeed, useJson, useStoredIsland } from "@/lib/data";
import { condWord, summarize as weatherSentence } from "@/lib/summary";
import { COUNTY_ALERTS, ISLAND_LABEL, ago, fmtDayTime, fmtTime } from "@/lib/brand";

const STALE_MS = 30 * 60_000;
/** Warnings that earn a full row on Now; everything else folds into a one-line group. */
const ALERT_TYPES = new Set<ItemType>(["advisory", "storm", "tsunami", "evac", "hazard", "outage"]);

/** A pushed digest item rendered like any other row when the phone has no newer snapshot. */
const fromDigest = (d: DigestItem, at: number): Item => ({
  ...d, source: "digest", tier: "official", islands: [], lastConfirmedAt: at, hash: "",
});

type Group = { key: string; label: string; icon: LucideIcon; items: Item[]; summary: string; href?: string };
const plural = (c: number, one: string, many = `${one}s`) => `${c} ${c === 1 ? one : many}`;

function groupItems(items: Item[], island: Island): Group[] {
  const of = (...t: ItemType[]) => items.filter((i) => i.tier !== "community" && t.includes(i.type));
  const roads = of("road_closure"), lanes = roads.filter((i) => i.source === "hdot"), closed = roads.length - lanes.length;
  const shelters = of("shelter"), schools = of("school"), traffic = of("traffic"), signals = traffic.filter((i) => i.status === "signal");
  const volcano = of("volcano"), quakes = of("quake"), notices = of("notice"), tsunami = of("tsunami"), hazards = of("hazard", "outage");
  const weather = of("advisory", "storm").filter((i) => i.sev <= 2);
  const community = items.filter((i) => i.tier === "community");
  const firstName = (i?: Item) => i?.title.replace(/^Shelter \w+: /, "") ?? "";
  const groups: Group[] = [
    { key: "weather", label: "Weather advisories", icon: CloudRainWind, items: weather, summary: weather.map((i) => i.title).join(" · "), href: "/weather/" },
    { key: "tsunami", label: "Tsunami", icon: Waves, items: tsunami, summary: tsunami[0]?.sev >= 3 ? tsunami[0].title : "No threat · information statement", href: "/tsunami/" },
    { key: "shelters", label: "Shelters", icon: Tent, items: shelters, summary: shelters.length ? `${plural(shelters.length, "open", "open")} · ${firstName(shelters[0])}` : "" },
    { key: "roads", label: "Roads", icon: TrafficCone, items: roads, summary: [closed ? plural(closed, "closure") : "", lanes.length ? plural(lanes.length, "lane closure") : ""].filter(Boolean).join(", ") },
    { key: "traffic", label: "Traffic", icon: CarFront, items: traffic, summary: [traffic.length - signals.length ? plural(traffic.length - signals.length, "incident") : "", signals.length ? plural(signals.length, "signal out", "signals out") : ""].filter(Boolean).join(", "), href: "/traffic/" },
    { key: "schools", label: "Schools", icon: School, items: schools, summary: plural(schools.length, "closed", "closed") },
    { key: "hazards", label: "Hazards & outages", icon: ZapOff, items: hazards, summary: hazards[0]?.title ?? "" },
    { key: "volcano", label: "Volcano", icon: Mountain, items: volcano, summary: volcano.map((v) => v.title.replace(/\s*\/.*$/, "").replace(/:\s*(\w+)/, (_, l: string) => `: ${l[0]}${l.slice(1).toLowerCase()}`)).join(" · "), href: "/volcano/" },
    { key: "quakes", label: "Earthquakes", icon: Activity, items: quakes, summary: `${plural(quakes.length, "quake")} this week`, href: "/quakes/" },
    { key: "notices", label: "Notices", icon: Megaphone, items: notices, summary: `${notices.length} from the state and county` },
  ].filter((g) => g.items.length);
  if (island !== "state") groups.push({ key: "community", label: "Neighbours", icon: Users, items: community, summary: community.length ? plural(community.length, "unverified report") : "Nothing reported", href: "/report/" });
  return groups;
}

export default function Home() {
  const [island, setIsland] = useStoredIsland();
  const { ess, snap, digest, mode } = useFeed(island);
  const stormsSnap = useJson<StormsSnapshot>("v1/storms.json");
  const now = ess?.fetchedAt || snap?.fetchedAt || 0;
  const gen = Math.max(ess?.data?.gen ?? 0, snap?.data?.gen ?? 0);
  // Deep link from a notification: /?island=hawaii&item=<key> (read once; static export has no server-side params)
  const focusKey = useSyncExternalStore(() => () => {}, () => new URLSearchParams(window.location.search).get("item"), () => null);
  useEffect(() => {
    const i = new URLSearchParams(window.location.search).get("island");
    if (i && ISLANDS.includes(i as never) && i !== island) queueMicrotask(() => setIsland(i as never));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const items = useMemo(() => {
    const base = snap?.data?.items ?? [];
    // A push digest newer than the stored snapshot fills in what the snapshot can't (the phone never got it).
    if (digest && digest.island === island && digest.gen > (snap?.data?.gen ?? 0)) {
      const have = new Set(base.map((i) => i.key));
      return [...digest.top.filter((d) => !have.has(d.key)).map((d) => fromDigest(d, digest.gen)), ...base].sort((a, b) => b.sev - a.sev || b.issuedAt - a.issuedAt);
    }
    return base;
  }, [snap, digest, island]);
  const alerts = useMemo(() => items.filter((i) => i.tier !== "community" && (i.sev >= 4 || (i.sev === 3 && ALERT_TYPES.has(i.type)))), [items]);
  const groups = useMemo(() => groupItems(items, island), [items, island]);
  const clauses = useMemo(() => summarize(items), [items]);

  const offline = !!ess?.offline && !!snap?.offline;
  const stale = gen > 0 && now - gen > STALE_MS;
  const slow = mode === "low" && !offline;
  const watch = ess?.data?.mode === "watch";
  const loaded = !!(snap?.data || ess?.data);
  // Headlines the essentials file knows about but the (older or missing) snapshot doesn't: show titles now, details when the link allows.
  const headlinesOnly = ess?.data && ess.data.gen > (snap?.data?.gen ?? 0) ? ess.data.alerts.filter((a) => !items.some((i) => i.key && hashOf(i.key) === a.h)) : [];

  const storms = stormsSnap?.data?.storms ?? [];
  const place = island === "state" ? ISLAND_POINTS.hawaii : ISLAND_POINTS[island];
  const approaching = storms.map((s) => ({ s, o: outlookFor(s, place) })).filter((x) => !x.o.movingAway).sort((a, b) => a.o.closest.distNm - b.o.closest.distNm)[0];

  // The one thing to know, Acme's "Right Now": the worst active warning, else an approaching storm, else the counts.
  const top = alerts[0];
  const rightNow = !loaded ? null
    : top?.sev === 4 ? { icon: ICON[top.type] ?? TriangleAlert, tone: "var(--sev4)", head: top.title, sub: clauses.slice(0, 3).join("\u00a0· ") }
    : approaching ? { icon: Wind, tone: "var(--cond-storm)", head: `${approaching.s.name} approaching`, sub: [`Closest ${fmtDayTime(approaching.o.closest.at)}`, ...clauses.slice(0, 2)].join("\u00a0· ") }
    : top ? { icon: ICON[top.type] ?? TriangleAlert, tone: "var(--sev3)", head: top.title, sub: clauses.slice(0, 3).join("\u00a0· ") }
    : clauses.length ? { icon: CircleCheck, tone: "var(--cond-windy)", head: "No warnings", sub: clauses.slice(0, 3).join("\u00a0· ") }
    : { icon: CircleCheck, tone: "var(--cond-windy)", head: "All quiet", sub: "No alerts, closures or shelters from the sources we track." };

  return (
    <main className="relative z-[1] mx-auto w-full max-w-2xl px-5 pb-28 md:pb-20">
      <TopBar island={island} onIsland={setIsland} home />
      <SectionNav />

      {offline && <Banner sev={4} icon={Radio} title="No connection">Showing the copy saved {fmtTime(gen)}. For emergencies call 911; Civil Defense messages air on AM/FM radio.</Banner>}
      {!offline && slow && <Banner sev={2} icon={Gauge} title="Weak connection">Showing saved details plus the newest headlines. Alerts you turned on still arrive in full.</Banner>}
      {!offline && !slow && stale && <Banner sev={2} icon={TriangleAlert} title={`Updates paused for ${ago(gen, now)}`}>Treat everything below as possibly out of date.</Banner>}
      {watch && <Banner sev={4} icon={Siren} title="Hurricane, tropical storm or tsunami watch/warning in effect">Follow your county&apos;s alerts.</Banner>}

      {/* Right now */}
      <h2 className="h2-display mt-s6">Right now</h2>
      {rightNow ? (
        <div className="mt-s3 flex items-start gap-s4">
          <rightNow.icon className="mt-1 size-14 shrink-0" strokeWidth={1.5} style={{ color: rightNow.tone }} aria-hidden />
          <div className="min-w-0">
            <p className="text-h2 font-semibold leading-tight tracking-[-0.01em]">{rightNow.head}</p>
            <p className="mt-1 text-body leading-snug text-ink-2">{rightNow.sub}</p>
            <p className="mt-1.5 text-label text-muted num">{gen ? <>Updated {fmtTime(gen)} · {ago(gen, now)}</> : "Loading…"}</p>
          </div>
        </div>
      ) : !offline && <Skeleton />}

      {island !== "state" && storms.length > 0 && <StormCard storms={storms} place={place} />}

      {/* Warnings + headlines the snapshot hasn't caught up with */}
      {(alerts.length > 0 || headlinesOnly.length > 0) && (
        <section className="mt-10" aria-label="Alerts">
          <h2 className="h2-display">Alerts</h2>
          <ul className="mt-s2 divide-y divide-line">
            {headlinesOnly.map((a) => {
              const Icon = ICON[a.type] ?? Megaphone;
              return <li key={a.h} className="flex items-start gap-s3 py-s3 text-body leading-snug"><Icon className={`mt-0.5 size-5 shrink-0 ${SEV_TEXT[a.sev]}`} /><span>{a.title}<span className="block text-label text-muted">Title only until the connection improves</span></span></li>;
            })}
            {alerts.map((i) => <ItemRow key={i.key} item={i} now={now} focus={i.key === focusKey} />)}
          </ul>
        </section>
      )}

      {/* Everything else: one line per kind, tap to open */}
      {loaded && (
        <section className="mt-10" aria-label="Around the island">
          <h2 className="h2-display">{island === "state" ? "Around the state" : `Around ${ISLAND_LABEL[island].split(" · ")[0]}`}</h2>
          <ul className="mt-s2 divide-y divide-line">
            {island !== "state" && mode !== "low" && !offline && <WeatherRow island={island} />}
            {groups.map((g) => {
              const hasFocus = !!focusKey && g.items.some((i) => i.key === focusKey);
              return (
                <li key={g.key}>
                  <details className="group" open={hasFocus || undefined}>
                    <summary className="flex min-h-14 cursor-pointer list-none items-center gap-s3 py-s2 [&::-webkit-details-marker]:hidden">
                      <g.icon className="size-6 shrink-0 text-ink-2" strokeWidth={1.75} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block text-body font-medium">{g.label}</span>
                        {g.summary && <span className="block truncate text-label text-muted">{g.summary}</span>}
                      </span>
                      <ChevronDown className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
                    </summary>
                    <div className="pb-s3 pl-9">
                      {g.items.length > 0 && <ul className="divide-y divide-line border-t border-line">{g.items.map((i) => <ItemRow key={i.key} item={i} now={now} focus={i.key === focusKey} compact />)}</ul>}
                      {g.key === "community" && g.items.length === 0 && <p className="py-s2 text-label text-muted">Crashes, signals out, flooded roads, outages, lost pets — unverified until others confirm.</p>}
                      {g.href && <Link href={g.href} className="mt-s2 inline-flex items-center gap-1 text-label font-medium text-brand">{g.key === "community" ? "Report something" : `Open ${g.label.toLowerCase()}`} <ChevronRight className="size-4" /></Link>}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {island !== "state" && <AlertsCard island={island} />}

      {island !== "state" && (
        <section className="mt-s4 card">
          <p className="text-body font-semibold">Get your county&apos;s own alerts</p>
          <p className="mt-1 text-label text-ink-2">Kilo collects official information; it doesn&apos;t replace the county&apos;s emergency messages.</p>
          <p className="mt-2 text-body font-semibold">{COUNTY_ALERTS[island].how}</p>
          <a className="mt-2 inline-flex items-center gap-1 text-label font-medium text-brand" href={COUNTY_ALERTS[island].url} target="_blank" rel="noreferrer">{COUNTY_ALERTS[island].label} <ExternalLink className="size-3.5" /></a>
        </section>
      )}

      <footer className="mt-10 text-center text-micro leading-relaxed text-muted">
        Compiled from official sources every two minutes. Information only — not an emergency service.
        <br />Free, no ads, no account. <Link className="underline underline-offset-4" href="/sources/">How this works</Link>
      </footer>
    </main>
  );
}

/** One line of weather for the island's first town; the Weather page has the rest. */
function WeatherRow({ island }: { island: Exclude<Island, "state"> }) {
  const w = useJson<Weather>(`v1/${island}/weather.json`);
  const town = w?.data?.towns[0];
  if (!town?.hourly) return null;
  const h = town.hourly;
  const temp = town.obs?.f ?? h.t[0];
  return (
    <li>
      <Link href="/weather/" className="flex min-h-14 items-center gap-s3 py-s2">
        <ConditionIcon code={h.c[0]} night={!!h.n[0]} size={24} />
        <span className="min-w-0 flex-1">
          <span className="block text-body font-medium num">{town.name} {temp != null ? `${temp}°` : ""} <span className="font-normal text-ink-2">{condWord(h.c[0])}</span></span>
          <span className="block truncate text-label text-muted">{weatherSentence(h)}</span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
      </Link>
    </li>
  );
}

/** "1 shelter open · 19 road closures · 2 schools closed · Kīlauea: Advisory" — most urgent first. */
function summarize(items: Item[]): string[] {
  const n = (f: (i: Item) => boolean) => items.filter(f).length;
  const out: string[] = [];
  const evac = n((i) => i.type === "evac"); if (evac) out.push(plural(evac, "evacuation order"));
  const tsu = n((i) => i.type === "tsunami" && i.sev >= 3); if (tsu) out.push(plural(tsu, "tsunami alert"));
  const weather = n((i) => i.type === "advisory" || i.type === "storm"); if (weather) out.push(plural(weather, "weather alert"));
  const shelters = n((i) => i.type === "shelter"); if (shelters) out.push(plural(shelters, "shelter open", "shelters open"));
  const roads = n((i) => i.type === "road_closure" && !i.source.startsWith("hdot")); if (roads) out.push(plural(roads, "road closed", "roads closed"));
  const schools = n((i) => i.type === "school"); if (schools) out.push(plural(schools, "school closed", "schools closed"));
  const hazards = n((i) => i.type === "hazard"); if (hazards) out.push(plural(hazards, "hazard"));
  const traffic = n((i) => i.type === "traffic"); if (traffic) out.push(plural(traffic, "traffic incident"));
  for (const v of items.filter((i) => i.type === "volcano")) out.push(v.title.replace(/\s*\/.*$/, "").replace(/:\s*(\w+)/, (_, l: string) => `: ${l[0]}${l.slice(1).toLowerCase()}`));
  const lanes = n((i) => i.source === "hdot"); if (lanes) out.push(plural(lanes, "lane closure"));
  const quakes = n((i) => i.type === "quake"); if (quakes) out.push(plural(quakes, "quake this week", "quakes this week"));
  return out;
}

function Skeleton() {
  return (
    <div className="mt-s3 flex gap-s4" aria-hidden>
      <div className="size-14 rounded-full bg-surface-2" />
      <div className="flex-1 space-y-2 pt-1"><div className="h-6 w-2/3 rounded bg-surface-2" /><div className="h-4 w-full rounded bg-surface-2" /><div className="h-3 w-1/3 rounded bg-surface-2" /></div>
    </div>
  );
}
