"use client";
import { useEffect } from "react";
import { Siren, TriangleAlert } from "lucide-react";
import OfficialWording from "./OfficialWording";
import { hashOf, type Item } from "@/lib/types";
import { LEVEL_WORD, lastUpdated, plainAlert, staleLine } from "@/lib/plain";
import { fmtClock } from "@/lib/brand";

/**
 * The one tinted card on a page: level word → plain headline → what to do → until when → who said it.
 * Level 4 is announced (role=alert). `compact` is the shelter/notice size (serif title instead of display). Never used for neighbor posts.
 */
export default function AlertBlock({ item, now, children, className, compact, focus }: { item: Item; now: number; children?: React.ReactNode; className?: string; compact?: boolean; focus?: boolean }) {
  const p = plainAlert(item, now);
  const danger = p.level >= 4;
  const Icon = danger ? Siren : TriangleAlert;
  const stale = staleLine(item, now);
  useEffect(() => { if (focus) document.getElementById(`item-${hashOf(item.key)}`)?.scrollIntoView({ block: "center" }); }, [focus, item.key]);
  return (
    <section id={`item-${hashOf(item.key)}`} role={danger ? "alert" : undefined} aria-label={p.headline}
      className={`card pl-6 ${danger ? "bg-danger-bg shadow-[inset_4px_0_0_var(--danger),var(--card-shadow)]" : "bg-warn-bg shadow-[inset_4px_0_0_var(--warn),var(--card-shadow)]"} ${className ?? "mt-s4"}`}>
      <p className={`flex items-center gap-s2 font-semibold ${compact ? "text-small" : "font-display text-title font-bold"} ${danger ? "text-danger" : "text-warn"}`}><Icon className={compact ? "size-5" : "size-6"} aria-hidden /> {p.word ?? LEVEL_WORD[p.level] ?? "Heads up"}</p>
      <h2 className={`${compact ? "h-title mt-s1" : "mt-s2 text-display font-display font-bold leading-tight text-ink"}`}>{p.headline}</h2>
      {p.action && <p className={`mt-s2 text-body text-ink ${compact ? "" : "font-semibold"}`}>{p.action}</p>}
      <p className="mt-s2 text-small text-ink-2 num">{p.until ? `${p.until[0].toUpperCase()}${p.until.slice(1)}. ` : ""}From {p.source}, {fmtClock(lastUpdated(item, now).at, now)}.</p>
      {stale && <p className={`mt-s3 border-t pt-s3 text-small font-semibold text-ink ${danger ? "border-danger/20" : "border-warn/20"}`}>{stale}</p>}
      {children}
      <OfficialWording title={item.title} body={item.body} />
    </section>
  );
}

/** A plain notice in the same shape, for fixed safety text (the 911 line on the report form). */
export function Notice({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <section className="card mt-s4 bg-danger-bg py-s3 pl-6 shadow-[inset_4px_0_0_var(--danger),var(--card-shadow)]">
      <p className="text-body font-semibold text-ink">{title}</p>
      {children && <p className="mt-1 text-body text-ink-2">{children}</p>}
    </section>
  );
}
