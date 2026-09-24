"use client";
import { useEffect } from "react";
import Icon, { type IconName } from "@/components/Icon";
import OfficialWording from "./OfficialWording";
import { hashOf, type Item } from "@/lib/types";
import { LEVEL_WORD, lastUpdated, plainAlert, staleLine } from "@/lib/plain";
import { fmtClock } from "@/lib/brand";

/**
 * The one tinted card on a page, in the hero's language: the warm ground at "get ready", the brick tint at
 * "act now" — never a coloured edge. A severity tile and the level word as a pill, then the plain headline,
 * what to do, and who said it. Level 4 is announced (role=alert). `compact` is the shelter/notice size
 * (the card title instead of the hero title). Never used for neighbor posts.
 */
export default function AlertBlock({ item, now, children, className, compact, focus }: { item: Item; now: number; children?: React.ReactNode; className?: string; compact?: boolean; focus?: boolean }) {
  const p = plainAlert(item, now);
  const danger = p.level >= 4;
  const glyph = danger ? "siren" : "warning";
  const stale = staleLine(item, now);
  useEffect(() => { if (focus) document.getElementById(`item-${hashOf(item.key)}`)?.scrollIntoView({ block: "center" }); }, [focus, item.key]);
  return (
    <section id={`item-${hashOf(item.key)}`} role={danger ? "alert" : undefined} aria-label={p.headline}
      className={`cs-card cs-hero ${danger ? "cs-hero--danger" : "cs-hero--warn"} ${className ?? "mt-s4"}`}>
      <div className="cs-tophead">
        <span className={`cs-ictile ${danger ? "cs-ictile--danger" : "cs-ictile--warn"}`}><Icon name={`${glyph}-fill`} size={18} /></span>
        <span className={`cs-pill ${danger ? "cs-pill--danger" : "cs-pill--warn"}`}>{p.word ?? LEVEL_WORD[p.level] ?? "Heads up"}</span>
      </div>
      <h2 className={`cs-display ${compact ? "cs-display--card" : "cs-display--hero"}`}>{p.headline}</h2>
      {p.action && <p className="cs-body cs-body--hero">{p.action}</p>}
      <p className="cs-source num">{p.until ? `${p.until[0].toUpperCase()}${p.until.slice(1)}. ` : ""}From {p.source}, {fmtClock(lastUpdated(item, now).at, now)}.</p>
      {stale && <p className="cs-source num"><b>{stale}</b></p>}
      {children}
      <OfficialWording title={item.title} body={item.body} />
    </section>
  );
}

/** A plain notice in the card shape, for fixed safety text (the 911 line on the report form): a tile, a title, one line. */
export function Notice({ title, children, icon = "first-aid" }: { title: string; children?: React.ReactNode; icon?: IconName }) {
  return (
    <section className="cs-card mt-s4">
      <div className="cs-lead">
        <span className="cs-ictile cs-ictile--brick"><Icon name={`${icon}-fill`} size={18} /></span>
        <span className="cs-lead-t">
          <span className="cs-lead-h">{title}</span>
          {children && <span className="cs-lead-p">{children}</span>}
        </span>
      </div>
    </section>
  );
}
