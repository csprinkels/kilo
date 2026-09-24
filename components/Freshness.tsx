"use client";
import { fmtClock, fmtDateTime } from "@/lib/brand";

export type FreshnessProps = {
  gen: number;          // when the publisher last produced this data
  checkedAt: number;    // when this phone last tried
  offline: boolean;
  weak?: boolean;       // low-bandwidth mode: only the short version loaded
};

const STALE = 30 * 60_000, VERY_STALE = 12 * 3_600_000;

/** One small line, same place on every page, that says how fresh this is: a dot and a clock time. Never "Live", never "5 min ago". */
export default function Freshness({ gen, checkedAt, offline, weak }: FreshnessProps) {
  let text: string, mod = "";
  if (offline && !gen) { text = "No signal, and nothing saved yet."; mod = "cs-fresh--down"; }
  else if (!gen) { text = "Loading…"; mod = "cs-fresh--wait"; }
  else if (offline) { text = `No signal. Showing what your phone saved at ${fmtClock(gen, checkedAt)}.`; mod = "cs-fresh--down"; }
  else if (checkedAt - gen > VERY_STALE) { text = `No new information since ${fmtClock(gen, checkedAt)}. Something may be wrong on our end.`; mod = "cs-fresh--warn"; }
  else if (checkedAt - gen > STALE) { text = `No new information since ${fmtClock(gen, checkedAt)}.`; mod = "cs-fresh--stale"; }
  else text = `Latest update: ${fmtDateTime(gen)}`;
  if (weak && gen && !offline) text += " Weak signal, short version.";
  return <p role="status" className={`cs-fresh ${mod}`}><span className="cs-fresh-dot" aria-hidden />{text}</p>;
}
