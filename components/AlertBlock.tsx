"use client";
import { Siren, TriangleAlert } from "lucide-react";
import OfficialWording from "./OfficialWording";
import type { Item } from "@/lib/types";
import { LEVEL_WORD, plainAlert } from "@/lib/plain";
import { fmtClock } from "@/lib/brand";

/**
 * The one coloured block on a page: level word → plain headline → what to do → until when → who said it.
 * Level 4 is announced (role=alert). Never used for neighbor posts.
 */
export default function AlertBlock({ item, now, children }: { item: Item; now: number; children?: React.ReactNode }) {
  const p = plainAlert(item, now);
  const danger = p.level >= 4;
  const Icon = danger ? Siren : TriangleAlert;
  return (
    <section role={danger ? "alert" : undefined} aria-label={p.headline}
      className={`mt-s4 rounded-card border-l-4 px-s4 py-s4 ${danger ? "border-danger bg-danger-bg" : "border-warn bg-warn-bg"}`}>
      <p className={`flex items-center gap-s2 font-display text-title font-bold ${danger ? "text-danger" : "text-warn"}`}><Icon className="size-6" aria-hidden /> {p.word ?? LEVEL_WORD[p.level] ?? "Heads up"}</p>
      <h2 className="mt-s2 text-display font-display font-bold leading-tight text-ink">{p.headline}</h2>
      {p.action && <p className="mt-s2 text-body font-semibold text-ink">{p.action}</p>}
      <p className="mt-s2 text-small text-ink-2 num">{p.until ? `${p.until[0].toUpperCase()}${p.until.slice(1)}. ` : ""}From {p.source}, {fmtClock(item.issuedAt, now)}.</p>
      {children}
      <OfficialWording title={item.title} body={item.body} />
    </section>
  );
}

/** A plain notice in the same shape, for fixed safety text (the 911 line on the report form). */
export function Notice({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <section className="mt-s4 rounded-card border-l-4 border-danger bg-danger-bg px-s4 py-s3">
      <p className="text-body font-semibold text-ink">{title}</p>
      {children && <p className="mt-1 text-body text-ink-2">{children}</p>}
    </section>
  );
}
