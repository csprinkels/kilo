"use client";
import { useEffect, useState } from "react";
import {
  Activity, CarFront, ChevronDown, CloudRainWind, ExternalLink, Flag, MapPin, Megaphone, Mountain, School,
  Share2, Siren, Tent, ThumbsUp, TrafficCone, TriangleAlert, Users, Waves, Wind, X, ZapOff, type LucideIcon,
} from "lucide-react";
import { hasVoted, voteReport } from "@/lib/report";
import type { Item, ItemType } from "@/lib/types";
import { hashOf, smsText } from "@/lib/types";
import { SOURCE_LABEL, TYPE_LABEL, ago, fmtDateTime, fmtTime } from "@/lib/brand";

export const ICON: Record<ItemType, LucideIcon> = {
  shelter: Tent, road_closure: TrafficCone, school: School, advisory: CloudRainWind, storm: Wind, tsunami: Waves,
  quake: Activity, volcano: Mountain, notice: Megaphone, evac: Siren, hazard: TriangleAlert, outage: ZapOff, traffic: CarFront,
};
export const SEV_TEXT: Record<number, string> = { 4: "text-sev4", 3: "text-sev3", 2: "text-sev2", 1: "text-sev1" };
export const SEV_CHIP: Record<number, string> = { 4: "bg-sev4-bg text-sev4", 3: "bg-sev3-bg text-sev3", 2: "bg-sev2-bg text-sev2", 1: "bg-surface-2 text-ink-2" };

/** `compact`: title + age only (for collapsed groups); type, place and body appear on tap. */
export default function ItemRow({ item, now, focus, compact }: { item: Item; now: number; focus?: boolean; compact?: boolean }) {
  const [open, setOpen] = useState(!!focus);
  const Icon = ICON[item.type] ?? Megaphone;
  const community = item.tier === "community";
  const rid = item.fields?.rid;
  // Vote state is read lazily on expand (localStorage isn't available during prerender).
  const [voted, setVoted] = useState<boolean | null>(null);
  const [confirms, setConfirms] = useState(Number(item.fields?.confirms ?? 0));
  const [voteMsg, setVoteMsg] = useState<string | null>(null);
  const votedNow = voted ?? (open && rid ? hasVoted(rid) : false);
  const cast = async (v: "still" | "gone" | "flag") => {
    if (!rid) return;
    const out = await voteReport(rid, v);
    if (out.ok) { setVoted(true); if (v === "still") setConfirms((c) => c + 1); setVoteMsg(v === "still" ? "Thanks — marked still there." : v === "gone" ? "Thanks — marked as cleared." : "Reported for review."); }
    else setVoteMsg(out.error ?? "Couldn't send that right now.");
  };
  const src = community ? "Neighbour report" : item.source === "digest" ? "From your latest alert" : SOURCE_LABEL[item.source.split(":")[0]] ?? item.source;
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
    <li id={`item-${hashOf(item.key)}`} className={`fade-up ${focus ? "-mx-2 rounded-card bg-surface px-2 ring-1 ring-ink/20" : ""}`}>
      <button className={`flex w-full items-start gap-s3 text-left ${compact ? "min-h-12 py-s2" : "min-h-14 py-s3"}`} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {!compact && (
          <span className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full ${SEV_CHIP[item.sev]}`}>
            <Icon className="size-5" strokeWidth={2} />
          </span>
        )}
        <span className="min-w-0 flex-1">
          {!compact && (
            <span className="flex items-center gap-1.5 text-label text-muted num">
              {community && <span className="rounded bg-surface-2 px-1.5 py-0.5 font-semibold uppercase tracking-wide text-ink-2">Unverified</span>}
              <span className="font-medium text-ink-2">{TYPE_LABEL[item.type]}</span>
              {item.districts[0] && <><span>·</span><span>{item.districts[0]}</span></>}
              <span className="ml-auto shrink-0 num">{ago(item.issuedAt, now)}</span>
            </span>
          )}
          <span className={`block leading-snug text-ink ${compact ? "text-body font-medium" : "mt-0.5 text-body font-semibold"}`}>{item.title}</span>
          {compact && !open && <span className="block text-label text-muted num">{item.districts[0] ? `${item.districts[0]} · ` : ""}{ago(item.issuedAt, now)}</span>}
          {item.body && (open || !compact) && <span className={`mt-1 block text-body leading-snug text-ink-2 ${open ? "" : "line-clamp-2"}`}>{item.body}</span>}
        </span>
        <ChevronDown className={`mt-1 size-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className={`fade-up mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-micro ${compact ? "" : "ml-12"}`}>
          <span className="text-muted">
            {compact ? `${TYPE_LABEL[item.type]}${item.districts[0] ? ` · ${item.districts[0]}` : ""} · ` : ""}{src} · {community ? <><Users className="inline size-3.5 align-text-bottom" /> {confirms + 1} {confirms ? "say still there" : "reported"} · last {fmtTime(item.lastConfirmedAt)}</> : <>confirmed {fmtTime(item.lastConfirmedAt)}</>}{item.expiresAt ? ` · until ${fmtDateTime(item.expiresAt)}` : ""}
          </span>
          {community && (
            <span className="flex w-full flex-wrap items-center gap-2">
              {votedNow ? <span className="text-muted">{voteMsg ?? "You've weighed in on this one."}</span> : (
                <>
                  <button className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1 font-medium" onClick={() => cast("still")}><ThumbsUp className="size-3.5" /> Still there</button>
                  <button className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1 font-medium" onClick={() => cast("gone")}><X className="size-3.5" /> Gone</button>
                  <button className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1 font-medium text-muted" onClick={() => cast("flag")}><Flag className="size-3.5" /> Report</button>
                </>
              )}
              <span className="basis-full text-micro text-muted">Unverified neighbour report. Call 911 for emergencies.</span>
            </span>
          )}
          <span className="flex gap-4">
            {item.lat && item.lon && (
              <a className="inline-flex items-center gap-1 font-medium text-brand" href={`https://maps.apple.com/?ll=${item.lat},${item.lon}&q=${encodeURIComponent(item.title)}`} target="_blank" rel="noreferrer">
                <MapPin className="size-3.5" /> Map
              </a>
            )}
            {item.srcUrl && (
              <a className="inline-flex items-center gap-1 font-medium text-brand" href={item.srcUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-3.5" /> Official page
              </a>
            )}
            <button className="inline-flex items-center gap-1 font-medium text-brand" onClick={share}>
              <Share2 className="size-3.5" /> Share
            </button>
          </span>
        </div>
      )}
    </li>
  );
}
