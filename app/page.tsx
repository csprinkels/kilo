"use client";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  Activity, ChevronDown, CircleCheck, CloudRainWind, ExternalLink, Gauge, MapPin, Megaphone, Mountain, Radio, School,
  Share2, Siren, Tent, TrafficCone, TriangleAlert, Waves, WifiOff, Wind, ZapOff, type LucideIcon,
} from "lucide-react";
import type { DigestItem, Item, ItemType } from "@/lib/types";
import { ISLANDS, hashOf, smsText } from "@/lib/types";
import { useFeed, useStoredIsland } from "@/lib/data";
import StormCard from "@/components/StormCard";
import AlertsCard from "@/components/AlertsCard";
import { APP_NAME, COUNTY_ALERTS, ISLAND_LABEL, SEV_SECTION, SOURCE_LABEL, TYPE_LABEL, ago, fmtDateTime, fmtTime, okina } from "@/lib/brand";

const STALE_MS = 30 * 60_000;

const ICON: Record<ItemType, LucideIcon> = {
  shelter: Tent, road_closure: TrafficCone, school: School, advisory: CloudRainWind, storm: Wind, tsunami: Waves,
  quake: Activity, volcano: Mountain, notice: Megaphone, evac: Siren, hazard: TriangleAlert, outage: ZapOff,
};
const SEV_TEXT: Record<number, string> = { 4: "text-sev4", 3: "text-sev3", 2: "text-sev2", 1: "text-sev1" };
const SEV_CHIP: Record<number, string> = { 4: "bg-sev4-bg text-sev4", 3: "bg-sev3-bg text-sev3", 2: "bg-sev2-bg text-sev2", 1: "bg-surface-2 text-ink-2" };

/** A pushed digest item rendered like any other row when the phone has no newer snapshot. */
const fromDigest = (d: DigestItem, at: number): Item => ({
  ...d, source: "digest", tier: "official", islands: [], lastConfirmedAt: at, hash: "",
});

export default function Home() {
  const [island, setIsland] = useStoredIsland();
  const { ess, snap, digest, mode } = useFeed(island);
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
  const sections = useMemo(() => {
    const by: Record<number, Item[]> = { 4: [], 3: [], 2: [], 1: [] };
    for (const i of items) by[i.sev].push(i);
    return ([4, 3, 2, 1] as const).filter((s) => by[s].length).map((s) => ({ sev: s, items: by[s] }));
  }, [items]);
  const situation = useMemo(() => summarize(items), [items]);

  const offline = !!ess?.offline && !!snap?.offline;
  const stale = gen > 0 && now - gen > STALE_MS;
  const slow = mode === "low" && !offline;
  const watch = ess?.data?.mode === "watch";
  const [srcOk, srcTotal] = ess?.data?.ok ?? [0, 0];
  const topSev = items[0]?.sev ?? 0;
  // Headlines the essentials file knows about but the (older or missing) snapshot doesn't: show titles now, details when the link allows.
  const headlinesOnly = ess?.data && ess.data.gen > (snap?.data?.gen ?? 0) ? ess.data.alerts.filter((a) => !items.some((i) => i.key && hashOf(i.key) === a.h)) : [];

  return (
    <main className="relative z-[1] mx-auto w-full max-w-2xl px-5 pb-20">
      {/* Masthead */}
      <header className="pt-6">
        <div className="flex items-baseline justify-between">
          <span className="display text-[17px] font-semibold tracking-tight text-ink">{okina(APP_NAME)}</span>
          <Link href="/sources/" className="text-xs font-medium text-muted underline-offset-4 hover:underline">Sources &amp; about</Link>
        </div>
        <h1 className="display mt-4 text-[44px] font-medium leading-[0.95] tracking-[-0.02em] text-ink sm:text-[56px]">
          {okina(ISLAND_LABEL[island].split(" · ")[0])}
          {ISLAND_LABEL[island].includes(" · ") && (
            <span className="block text-[22px] font-normal tracking-normal text-ink-2 sm:text-[26px]">
              {okina(ISLAND_LABEL[island].split(" · ").slice(1).join(" · "))}
            </span>
          )}
        </h1>

        <nav aria-label="Island" className="no-scrollbar -mx-5 mt-5 flex gap-2 overflow-x-auto px-5">
          {ISLANDS.map((i) => {
            const on = i === island;
            return (
              <button
                key={i}
                onClick={() => setIsland(i)}
                aria-pressed={on}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  on ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface text-ink-2 hover:border-ink-2"
                }`}
              >
                {ISLAND_LABEL[i].split(" · ")[0]}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Status line (sticky) */}
      <div className="sticky top-0 z-10 -mx-5 mt-5 border-y border-line bg-bg/90 px-5 py-2 text-[13px] backdrop-blur supports-[backdrop-filter]:bg-bg/75">
        <div className="flex items-center gap-2 text-muted">
          {offline ? (
            <><WifiOff className="size-3.5 text-sev4" /> <span className="font-medium text-sev4">Offline</span><span>· saved {gen ? fmtDateTime(gen) : "—"}</span></>
          ) : gen ? (
            <>
              {slow ? <Gauge className="size-3.5 text-sev2" /> : <span className={`inline-block size-2 rounded-full ${stale ? "bg-sev2" : "bg-emerald-500"}`} />}
              <span>Updated {fmtTime(gen)} HST · {ago(gen, now)}{slow ? " · slow connection" : ""}</span>
              {srcTotal > 0 && <span className="ml-auto tabular-nums">{srcOk}/{srcTotal} sources</span>}
            </>
          ) : (
            <span>{ess === null && snap === null ? "Loading…" : "No data yet"}</span>
          )}
        </div>
      </div>

      {/* Banners */}
      {offline && (
        <Banner tone="red" icon={Radio}>
          No connection. Showing the last copy saved on this phone. For emergencies call 911; Civil Defense messages air on AM/FM radio.
        </Banner>
      )}
      {!offline && slow && (
        <Banner tone="amber" icon={Gauge}>Weak connection. Showing the last saved details plus the newest headlines; full text loads when the link improves. Alerts you turned on still arrive in full.</Banner>
      )}
      {!offline && !slow && stale && (
        <Banner tone="amber" icon={TriangleAlert}>Feed updates paused for {ago(gen, now)}. Treat everything below as possibly out of date.</Banner>
      )}
      {watch && (
        <Banner tone="red" icon={Siren}>A hurricane, tropical storm or tsunami watch/warning is in effect for Hawaiʻi. Follow your county&apos;s alerts.</Banner>
      )}

      {island !== "state" && <StormCard island={island} />}

      {/* Headlines the full snapshot hasn't caught up with (weak link) */}
      {headlinesOnly.length > 0 && (
        <section className="mt-5 rounded-2xl border border-sev2 bg-sev2-bg/60 p-3" aria-label="Latest headlines">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sev2">Newest headlines · {ess?.data && fmtTime(ess.data.gen)} HST</p>
          <ul className="mt-2 space-y-1.5">
            {headlinesOnly.map((a) => {
              const Icon = ICON[a.type] ?? Megaphone;
              return <li key={a.h} className="flex items-start gap-2 text-[15px] leading-snug"><Icon className={`mt-0.5 size-4 shrink-0 ${SEV_TEXT[a.sev]}`} /><span>{a.title}</span></li>;
            })}
          </ul>
          <p className="mt-2 text-xs text-muted">Titles only for now; details arrive with the next successful update.</p>
        </section>
      )}

      {/* Situation summary */}
      {(snap?.data || ess?.data) && (
        <section className="mt-5" aria-label="Situation summary">
          {items.length === 0 && headlinesOnly.length === 0 ? (
            <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-4">
              <CircleCheck className="size-6 shrink-0 text-emerald-600" />
              <div>
                <p className="font-semibold">All quiet on {ISLAND_LABEL[island].split(" · ")[0]}</p>
                <p className="text-sm text-muted">No active alerts, closures or shelters from the sources we track.</p>
              </div>
            </div>
          ) : (
            <p className="text-[15px] leading-relaxed text-ink-2">
              <span className={`font-semibold ${SEV_TEXT[topSev]}`}>{topSev >= 4 ? "Life-safety alerts active. " : topSev === 3 ? "Warnings in effect. " : ""}</span>
              {situation.map((s, i) => (
                <span key={s}>{i > 0 && <span className="mx-1.5 text-muted">·</span>}{s}</span>
              ))}
            </p>
          )}
        </section>
      )}
      {!snap?.data && !ess?.data && !offline && <Skeleton />}

      {/* Items */}
      {sections.map(({ sev, items }) => (
        <section key={sev} className="mt-7">
          <h2 className="flex items-baseline gap-2 border-b border-line pb-2">
            <span className={`text-[13px] font-semibold uppercase tracking-[0.12em] ${SEV_TEXT[sev]}`}>{SEV_SECTION[sev]}</span>
            <span className="text-xs tabular-nums text-muted">{items.length}</span>
          </h2>
          <ul className="divide-y divide-line">
            {items.map((i) => <Row key={i.key} item={i} now={now} focus={i.key === focusKey} />)}
          </ul>
        </section>
      ))}

      {island !== "state" && <AlertsCard island={island} />}

      {/* County alerts */}
      {island !== "state" && (
        <section className="mt-10 rounded-2xl bg-surface-2 p-5">
          <p className="display text-lg font-semibold">Get your county&apos;s own alerts</p>
          <p className="mt-1 text-sm text-ink-2">
            This page collects official information; it doesn&apos;t replace the county&apos;s emergency messages. {COUNTY_ALERTS[island].label}:
          </p>
          <p className="mt-2 text-base font-semibold">{COUNTY_ALERTS[island].how}</p>
          <a className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand underline-offset-4 hover:underline" href={COUNTY_ALERTS[island].url} target="_blank" rel="noreferrer">
            Sign-up page <ExternalLink className="size-3.5" />
          </a>
        </section>
      )}

      <footer className="mt-8 text-center text-xs leading-relaxed text-muted">
        Compiled from official sources every two minutes. Information only — not an emergency service.
        <br />Free, no ads, no account. <Link className="underline underline-offset-4" href="/sources/">How this works</Link>
      </footer>
    </main>
  );
}

/** "1 shelter open · 19 road closures · 2 schools closed · Kīlauea: Advisory" */
function summarize(items: Item[]): string[] {
  const n = (f: (i: Item) => boolean) => items.filter(f).length;
  const plural = (c: number, one: string, many: string) => `${c} ${c === 1 ? one : many}`;
  const out: string[] = [];
  const evac = n((i) => i.type === "evac"); if (evac) out.push(plural(evac, "evacuation order", "evacuation orders"));
  const weather = n((i) => i.type === "advisory" || i.type === "storm"); if (weather) out.push(plural(weather, "weather alert", "weather alerts"));
  const tsu = n((i) => i.type === "tsunami"); if (tsu) out.push(plural(tsu, "tsunami bulletin", "tsunami bulletins"));
  const shelters = n((i) => i.type === "shelter"); if (shelters) out.push(plural(shelters, "shelter open", "shelters open"));
  const roads = n((i) => i.type === "road_closure" && !i.source.startsWith("hdot")); if (roads) out.push(plural(roads, "road closure", "road closures"));
  const lanes = n((i) => i.source === "hdot"); if (lanes) out.push(plural(lanes, "highway lane closure", "highway lane closures"));
  const schools = n((i) => i.type === "school"); if (schools) out.push(plural(schools, "school closed", "schools closed"));
  const hazards = n((i) => i.type === "hazard"); if (hazards) out.push(plural(hazards, "hazard", "hazards"));
  for (const v of items.filter((i) => i.type === "volcano")) out.push(v.title.replace(/\s*\/.*$/, "").replace(/:\s*(\w+)/, (_, l: string) => `: ${l[0]}${l.slice(1).toLowerCase()}`));
  const quakes = n((i) => i.type === "quake"); if (quakes) out.push(plural(quakes, "earthquake this week", "earthquakes this week"));
  const notices = n((i) => i.type === "notice"); if (notices) out.push(plural(notices, "state notice", "state notices"));
  return out;
}

function Banner({ tone, icon: Icon, children }: { tone: "red" | "amber"; icon: LucideIcon; children: React.ReactNode }) {
  const cls = tone === "red" ? "bg-sev4 text-white" : "bg-sev2 text-white";
  return (
    <div role="status" className={`fade-up mt-4 flex items-start gap-3 rounded-xl px-4 py-3 text-sm font-medium leading-snug ${cls}`}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="mt-6 space-y-4" aria-hidden>
      {[0, 1, 2].map((k) => (
        <div key={k} className="flex gap-3">
          <div className="size-9 rounded-full bg-surface-2" />
          <div className="flex-1 space-y-2 pt-1"><div className="h-3 w-1/3 rounded bg-surface-2" /><div className="h-4 w-3/4 rounded bg-surface-2" /></div>
        </div>
      ))}
    </div>
  );
}

function Row({ item, now, focus }: { item: Item; now: number; focus?: boolean }) {
  const [open, setOpen] = useState(!!focus);
  const Icon = ICON[item.type] ?? Megaphone;
  const src = item.source === "digest" ? "From your latest alert" : SOURCE_LABEL[item.source.split(":")[0]] ?? item.source;
  useEffect(() => { if (focus) document.getElementById(`item-${hashOf(item.key)}`)?.scrollIntoView({ block: "center" }); }, [focus, item.key]);
  // One GSM-7 SMS segment: a person WITH signal can text this to someone without, no link to load.
  const share = async () => {
    const text = smsText(item);
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); alert("Copied to clipboard"); }
    } catch { /* cancelled */ }
  };
  return (
    <li id={`item-${hashOf(item.key)}`} className={`fade-up ${focus ? "-mx-2 rounded-xl bg-surface px-2 ring-1 ring-ink/20" : ""}`}>
      <button className="flex w-full items-start gap-3 py-3.5 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full ${SEV_CHIP[item.sev]}`}>
          <Icon className="size-[18px]" strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <span className="font-medium text-ink-2">{TYPE_LABEL[item.type]}</span>
            {item.districts[0] && <><span>·</span><span>{item.districts[0]}</span></>}
            <span className="ml-auto shrink-0 tabular-nums">{ago(item.issuedAt, now)}</span>
          </span>
          <span className="mt-0.5 block text-[16px] font-semibold leading-snug text-ink">{item.title}</span>
          {item.body && <span className={`mt-1 block text-[14px] leading-relaxed text-ink-2 ${open ? "" : "line-clamp-2"}`}>{item.body}</span>}
        </span>
        <ChevronDown className={`mt-1 size-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="fade-up mb-4 ml-12 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
          <span className="text-muted">
            {src} · confirmed {fmtTime(item.lastConfirmedAt)}{item.expiresAt ? ` · until ${fmtDateTime(item.expiresAt)}` : ""}
          </span>
          <span className="flex gap-4">
            {item.lat && item.lon && (
              <a className="inline-flex items-center gap-1 font-medium text-brand" href={`https://maps.apple.com/?ll=${item.lat},${item.lon}&q=${encodeURIComponent(item.title)}`} target="_blank" rel="noreferrer">
                <MapPin className="size-3.5" /> Map
              </a>
            )}
            <a className="inline-flex items-center gap-1 font-medium text-brand" href={item.srcUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3.5" /> Official page
            </a>
            <button className="inline-flex items-center gap-1 font-medium text-brand" onClick={share}>
              <Share2 className="size-3.5" /> Share
            </button>
          </span>
        </div>
      )}
    </li>
  );
}
