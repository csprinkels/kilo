"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { Island, Item } from "@/lib/types";
import { ISLANDS } from "@/lib/types";
import { useFeed, useStoredIsland } from "@/lib/data";
import { APP_NAME, COUNTY_ALERTS, ISLAND_LABEL, SEV_SECTION, SOURCE_LABEL, TYPE_LABEL, ago, fmtDateTime, fmtTime } from "@/lib/brand";

const STALE_MS = 30 * 60_000;

const SEV_STYLE: Record<number, string> = {
  4: "border-red-600 bg-red-50 dark:bg-red-950/40",
  3: "border-orange-500 bg-orange-50 dark:bg-orange-950/40",
  2: "border-amber-400 bg-card",
  1: "border-border bg-card",
};

export default function Home() {
  const [island, setIsland] = useStoredIsland();
  const { snap, manifest } = useFeed(island);
  const now = snap?.fetchedAt || 0; // "x min ago" is relative to the last fetch; refreshed every poll
  const gen = snap?.data?.gen ?? 0;
  const sections = useMemo(() => {
    const by: Record<number, Item[]> = { 4: [], 3: [], 2: [], 1: [] };
    for (const i of snap?.data?.items ?? []) by[i.sev].push(i);
    return ([4, 3, 2, 1] as const).filter((s) => by[s].length).map((s) => ({ sev: s, items: by[s] }));
  }, [snap]);
  const empty = !!snap?.data && sections.length === 0;

  const offline = !!snap?.offline;
  const stale = gen > 0 && now - gen > STALE_MS;
  const watch = manifest?.data?.mode === "watch";

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-16">
      <header className="sticky top-0 z-10 -mx-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold tracking-tight">{APP_NAME}</h1>
          <select
            aria-label="Island"
            className="rounded-lg border border-border bg-card px-3 py-2 text-base"
            value={island}
            onChange={(e) => setIsland(e.target.value as Island)}
          >
            {ISLANDS.map((i) => <option key={i} value={i}>{ISLAND_LABEL[i]}</option>)}
          </select>
        </div>
        <p className="mt-1 text-sm text-muted">
          {gen ? <>Updated {fmtTime(gen)} HST · {ago(gen, now)}</> : snap === null ? "Loading…" : "No data yet"}
        </p>
      </header>

      {offline && (
        <Banner tone="red">
          Offline — showing saved data{gen ? ` from ${fmtDateTime(gen)} HST` : ""}. Call 911 for emergencies; tune to AM/FM radio for Civil Defense messages.
        </Banner>
      )}
      {!offline && stale && (
        <Banner tone="amber">Feed updates paused — last update {ago(gen, now)}. Treat everything below as possibly out of date.</Banner>
      )}
      {watch && (
        <Banner tone="red">A hurricane, tropical storm, or tsunami watch/warning is in effect for Hawaiʻi. Check your county alerts and the items below.</Banner>
      )}

      {!snap?.data && !offline && <p className="py-10 text-center text-muted">Loading…</p>}
      {empty && (
        <p className="py-10 text-center text-muted">Nothing active for {ISLAND_LABEL[island]} right now.</p>
      )}

      {sections.map(({ sev, items }) => (
        <section key={sev} className="mt-5">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{SEV_SECTION[sev]} · {items.length}</h2>
          <ul className="space-y-3">{items.map((i) => <ItemCard key={i.key} item={i} now={now} />)}</ul>
        </section>
      ))}

      {island !== "state" && (
        <section className="mt-8 rounded-xl border border-border bg-card p-4 text-sm">
          <p className="font-semibold">Get your county&apos;s official alerts</p>
          <p className="mt-1 text-muted">{COUNTY_ALERTS[island].label}: <strong className="text-foreground">{COUNTY_ALERTS[island].how}</strong></p>
          <a className="mt-2 inline-block underline" href={COUNTY_ALERTS[island].url} target="_blank" rel="noreferrer">Sign-up page ↗</a>
        </section>
      )}

      <footer className="mt-8 text-center text-xs text-muted">
        Information only, compiled from official sources. Not an emergency service. <Link className="underline" href="/sources/">Sources &amp; about</Link>
      </footer>
    </main>
  );
}

function Banner({ tone, children }: { tone: "red" | "amber"; children: React.ReactNode }) {
  const cls = tone === "red" ? "bg-red-600 text-white" : "bg-amber-400 text-black";
  return <div role="status" className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ${cls}`}>{children}</div>;
}

function ItemCard({ item, now }: { item: Item; now: number }) {
  const [open, setOpen] = useState(false);
  const src = SOURCE_LABEL[item.source.split(":")[0]] ?? item.source;
  const share = async () => {
    const text = `${item.title}\n${item.body.slice(0, 300)}\nSource: ${src} ${fmtDateTime(item.lastConfirmedAt)} HST\n${item.srcUrl}`.slice(0, 480);
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); alert("Copied"); }
    } catch { /* user cancelled */ }
  };
  return (
    <li className={`rounded-xl border-l-4 p-3 shadow-sm ${SEV_STYLE[item.sev]}`}>
      <button className="w-full text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span className="rounded bg-foreground/10 px-1.5 py-0.5 font-medium text-foreground">{TYPE_LABEL[item.type] ?? item.type}</span>
          {item.districts.map((d) => <span key={d}>{d}</span>)}
          <span className="ml-auto">{ago(item.issuedAt, now)}</span>
        </div>
        <p className="mt-1 text-base font-semibold leading-snug">{item.title}</p>
        {item.body && <p className={`mt-1 text-sm text-foreground/80 ${open ? "" : "line-clamp-2"}`}>{item.body}</p>}
      </button>
      {open && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-2 text-xs text-muted">
          <span>{src} · confirmed {fmtTime(item.lastConfirmedAt)}{item.expiresAt ? ` · until ${fmtDateTime(item.expiresAt)}` : ""}</span>
          {item.lat && item.lon && (
            <a className="underline" href={`https://maps.apple.com/?ll=${item.lat},${item.lon}&q=${encodeURIComponent(item.title)}`} target="_blank" rel="noreferrer">Map ↗</a>
          )}
          <a className="underline" href={item.srcUrl} target="_blank" rel="noreferrer">Official page ↗</a>
          <button className="underline" onClick={share}>Share</button>
        </div>
      )}
    </li>
  );
}
