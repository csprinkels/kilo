"use client";
import { fmtClock } from "@/lib/brand";

export type FreshnessProps = {
  gen: number;          // when the publisher last produced this data
  checkedAt: number;    // when this phone last tried
  offline: boolean;
  weak?: boolean;       // low-bandwidth mode: only the short version loaded
};

const STALE = 30 * 60_000, VERY_STALE = 12 * 3_600_000;

/** One sentence, same place on every page, that says how fresh this is. Never a dot, never "Live", never "5 min ago". */
export default function Freshness({ gen, checkedAt, offline, weak }: FreshnessProps) {
  let text: string, cls = "text-ink-2";
  if (!gen) text = "Loading…";
  else if (offline) { text = `No signal. Showing what your phone saved at ${fmtClock(gen, checkedAt)}.`; cls = "rounded-card bg-danger-bg px-s3 py-s2 font-semibold text-danger"; }
  else if (checkedAt - gen > VERY_STALE) { text = `No new information since ${fmtClock(gen, checkedAt)}. Something may be wrong on our end.`; cls = "font-semibold text-warn"; }
  else if (checkedAt - gen > STALE) { text = `No new information since ${fmtClock(gen, checkedAt)}.`; cls = "text-ink"; }
  else text = `Checked ${fmtClock(gen, checkedAt)}`;
  if (weak && gen && !offline) text += " Weak signal, short version.";
  return <p role="status" className={`mt-s2 px-1 text-[0.8125rem] num ${cls}`}>{text}</p>;
}
