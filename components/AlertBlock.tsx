"use client";
import { useEffect } from "react";
import Icon, { type IconName } from "@/components/Icon";
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
  const glyph = danger ? "siren" : "warning";
  const stale = staleLine(item, now);
  useEffect(() => { if (focus) document.getElementById(`item-${hashOf(item.key)}`)?.scrollIntoView({ block: "center" }); }, [focus, item.key]);
  return (
    <section id={`item-${hashOf(item.key)}`} role={danger ? "alert" : undefined} aria-label={p.headline}
      className={`card ${danger ? "bg-danger-bg" : "bg-warn-bg"} ${className ?? "mt-s4"}`}>
      <p className={`flex items-center gap-s2 font-semibold ${compact ? "text-small" : "font-display text-title font-bold"} ${danger ? "text-danger" : "text-warn"}`}>
        <span className={`tile ${danger ? "bg-danger/15" : "bg-warn/15"}`}><Icon name={`${glyph}-fill`} size={compact ? 18 : 20} /></span> {p.word ?? LEVEL_WORD[p.level] ?? "Heads up"}
      </p>
      <h2 className={`${compact ? "mt-s1 text-title font-semibold leading-tight text-ink" : "mt-s2 text-display font-display font-bold leading-tight text-ink"}`}>{p.headline}</h2>
      {p.action && <p className={`mt-s2 text-body text-ink ${compact ? "" : "font-semibold"}`}>{p.action}</p>}
      <p className="mt-s2 text-small text-ink-2 num">{p.until ? `${p.until[0].toUpperCase()}${p.until.slice(1)}. ` : ""}From {p.source}, {fmtClock(lastUpdated(item, now).at, now)}.</p>
      {stale && <p className={`mt-s3 border-t pt-s3 text-small font-semibold text-ink ${danger ? "border-danger/20" : "border-warn/20"}`}>{stale}</p>}
      {children}
      <OfficialWording title={item.title} body={item.body} />
    </section>
  );
}

/** A plain notice in the card shape, for fixed safety text (the 911 line on the report form): a tile, a title, one line. */
export function Notice({ title, children, icon = "first-aid" }: { title: string; children?: React.ReactNode; icon?: IconName }) {
  return (
    <section className="card mt-s4 flex items-start gap-s3 bg-danger-bg py-s4">
      <span className="tile bg-danger/15 text-danger"><Icon name={`${icon}-fill`} size={20} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-body font-semibold text-ink">{title}</span>
        {children && <span className="mt-0.5 block text-body text-ink-2">{children}</span>}
      </span>
    </section>
  );
}
