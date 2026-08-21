"use client";
import { useEffect, useState } from "react";
import {
  Activity, CarFront, ChevronDown, CloudRainWind, ExternalLink, MapPin, Megaphone, Mountain, School,
  Share2, Siren, Tent, TrafficCone, TriangleAlert, Waves, Wind, ZapOff, type LucideIcon,
} from "lucide-react";
import OfficialWording from "./OfficialWording";
import { hasVoted, voteReport } from "@/lib/report";
import type { Item, ItemType } from "@/lib/types";
import { hashOf, smsText } from "@/lib/types";
import { LEVEL_WORD, lastUpdated, plainAlert, staleLine } from "@/lib/plain";
import { fmtClock } from "@/lib/brand";

export const ICON: Record<ItemType, LucideIcon> = {
  shelter: Tent, road_closure: TrafficCone, school: School, advisory: CloudRainWind, storm: Wind, tsunami: Waves,
  quake: Activity, volcano: Mountain, notice: Megaphone, evac: Siren, hazard: TriangleAlert, outage: ZapOff, traffic: CarFront,
};
export const LEVEL_TEXT: Record<number, string> = { 4: "text-danger", 3: "text-warn", 2: "text-ink", 1: "text-ink-2", 0: "text-ink-2" };

/** Map + official link + share, shared by both row kinds. Share is one text message's worth; no link to load. */
function Actions({ item }: { item: Item }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const text = smsText(item);
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); setCopied(true); }
    } catch { /* cancelled */ }
  };
  return (
    <p className="mt-s2 flex flex-wrap gap-x-s4 text-small font-semibold">
      {item.lat && item.lon && <a className="inline-flex min-h-11 items-center gap-1 text-brand" href={`https://maps.apple.com/?ll=${item.lat},${item.lon}&q=${encodeURIComponent(item.title)}`} target="_blank" rel="noreferrer"><MapPin className="size-4" aria-hidden /> Open in Maps</a>}
      {item.srcUrl && item.tier !== "community" && <a className="inline-flex min-h-11 items-center gap-1 text-brand" href={item.srcUrl} target="_blank" rel="noreferrer"><ExternalLink className="size-4" aria-hidden /> Read it on their site</a>}
      <button className="inline-flex min-h-11 items-center gap-1 text-brand" onClick={share}><Share2 className="size-4" aria-hidden /> {copied ? "Copied." : "Share"}</button>
    </p>
  );
}

/**
 * One official item: [level word] · plain headline · what to do · who said it. Tap the whole row for the details.
 * Never shows the agency's title unless you open "Official wording".
 */
export default function ItemRow({ item, now, focus, showSource = true }: { item: Item; now: number; focus?: boolean; showSource?: boolean }) {
  if (item.tier === "community") return <NeighborRow item={item} now={now} focus={focus} />;
  return <OfficialRow item={item} now={now} focus={focus} showSource={showSource} />;
}

/** `showSource` is false when every row in the list comes from the same agency (the page says it once instead). */
function OfficialRow({ item, now, focus, showSource }: { item: Item; now: number; focus?: boolean; showSource?: boolean }) {
  const [open, setOpen] = useState(!!focus);
  const p = plainAlert(item, now);
  const stale = staleLine(item, now);
  const Icon = ICON[item.type] ?? Megaphone;
  useEffect(() => { if (focus) document.getElementById(`item-${hashOf(item.key)}`)?.scrollIntoView({ block: "center" }); }, [focus, item.key]);
  return (
    <li id={`item-${hashOf(item.key)}`} className={focus ? "bg-surface-2" : ""}>
      <button className="row items-start" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Icon className={`mt-1 size-6 shrink-0 ${LEVEL_TEXT[p.level]}`} strokeWidth={1.75} aria-hidden />
        <span className="min-w-0 flex-1">
          {(p.word || p.level >= 2) && <span className={`block text-small font-bold ${LEVEL_TEXT[p.level]}`}>{p.word ?? LEVEL_WORD[p.level]}</span>}
          <span className="block text-body font-semibold leading-snug text-ink">{p.headline}</span>
          {p.action && <span className="mt-0.5 block text-body leading-snug text-ink-2">{p.action}</span>}
          <span className="mt-1 block text-small text-ink-2 num">{showSource ? `${p.source[0].toUpperCase() + p.source.slice(1)} · ` : ""}{fmtClock(lastUpdated(item, now).at, now)}</span>
          {stale && <span className="mt-1 block text-small font-semibold text-ink">{stale}</span>}
        </span>
        <ChevronDown className={`mt-2 size-5 shrink-0 text-ink-2 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div className="fade-up mb-s4 pl-9">
          {item.body && <p className="text-body leading-relaxed text-ink-2">{item.body}</p>}
          {item.expiresAt && <p className="mt-s2 text-small text-ink-2 num">Until {fmtClock(item.expiresAt, now)}.</p>}
          <Actions item={item} />
          <OfficialWording title={item.title} body={item.body} />
        </div>
      )}
    </li>
  );
}

/** A neighbor's post: its own surface, a dashed rule, the word "Neighbor" every time, never a level word or colour. */
export function NeighborRow({ item, now, focus }: { item: Item; now: number; focus?: boolean }) {
  const [open, setOpen] = useState(!!focus);
  const rid = item.fields?.rid;
  const [voted, setVoted] = useState<boolean | null>(null);
  const [confirms, setConfirms] = useState(Number(item.fields?.confirms ?? 0));
  const [msg, setMsg] = useState<string | null>(null);
  const votedNow = voted ?? (open && rid ? hasVoted(rid) : false);
  const cast = async (v: "still" | "gone" | "flag") => {
    if (!rid) return;
    const out = await voteReport(rid, v);
    if (out.ok) { setVoted(true); if (v === "still") setConfirms((c) => c + 1); setMsg(v === "still" ? "Thanks. Marked as still there." : v === "gone" ? "Thanks. Marked as gone." : "Thanks. A person will look at it."); }
    else setMsg(out.error ?? "Could not send that right now.");
  };
  useEffect(() => { if (focus) document.getElementById(`item-${hashOf(item.key)}`)?.scrollIntoView({ block: "center" }); }, [focus, item.key]);
  const p = plainAlert(item, now);
  return (
    <li id={`item-${hashOf(item.key)}`} className="border-l-[3px] border-dashed border-ink-2 bg-surface-2">
      <button className="row items-start" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="min-w-0 flex-1">
          <span className="block text-small font-semibold text-ink-2">Neighbor report · not checked</span>
          <span className="block text-body font-semibold leading-snug text-ink">{p.headline}</span>
          <span className="mt-1 block text-small text-ink-2 num">{confirms + 1} {confirms ? "neighbors say it is still there" : "neighbor reported it"} · {fmtClock(item.lastConfirmedAt, now)}</span>
        </span>
        <ChevronDown className={`mt-2 size-5 shrink-0 text-ink-2 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div className="fade-up pb-s4">
          {item.body && <p className="text-body leading-relaxed text-ink-2">{item.body}</p>}
          <p className="mt-s2 text-small text-ink-2">Not checked by anyone official. Call 911 in an emergency.</p>
          {votedNow ? <p className="mt-s3 text-body text-ink-2">{msg ?? "You already weighed in on this one."}</p> : (
            <div className="mt-s3 flex flex-wrap items-center gap-s2">
              <button className="btn" onClick={() => cast("still")}>Still there</button>
              <button className="btn" onClick={() => cast("gone")}>Gone</button>
              <button className="inline-flex min-h-11 items-center px-s2 text-small font-semibold text-ink-2" onClick={() => cast("flag")}>Flag this post</button>
            </div>
          )}
          <Actions item={item} />
        </div>
      )}
    </li>
  );
}
