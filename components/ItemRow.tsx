"use client";
import { useEffect, useState } from "react";
import {
  Activity, CarFront, ChevronDown, CloudRainWind, ExternalLink, MapPin, Megaphone, Mountain, School,
  Share2, Siren, Tent, TrafficCone, TriangleAlert, Waves, Wind, ZapOff, type LucideIcon,
} from "lucide-react";
import type { Item, ItemType } from "@/lib/types";
import { hashOf, smsText } from "@/lib/types";
import { SOURCE_LABEL, TYPE_LABEL, ago, fmtDateTime, fmtTime } from "@/lib/brand";

export const ICON: Record<ItemType, LucideIcon> = {
  shelter: Tent, road_closure: TrafficCone, school: School, advisory: CloudRainWind, storm: Wind, tsunami: Waves,
  quake: Activity, volcano: Mountain, notice: Megaphone, evac: Siren, hazard: TriangleAlert, outage: ZapOff, traffic: CarFront,
};
export const SEV_TEXT: Record<number, string> = { 4: "text-sev4", 3: "text-sev3", 2: "text-sev2", 1: "text-sev1" };
export const SEV_CHIP: Record<number, string> = { 4: "bg-sev4-bg text-sev4", 3: "bg-sev3-bg text-sev3", 2: "bg-sev2-bg text-sev2", 1: "bg-surface-2 text-ink-2" };

export default function ItemRow({ item, now, focus }: { item: Item; now: number; focus?: boolean }) {
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
