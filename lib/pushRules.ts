// Decides whether a warning buzzes now, a few minutes from now, or not at all. Pure so it can be unit-tested.
export const MIN_GAP_MS = 10 * 60_000; // per island, between two buzzes; level 4 ignores it
export const DEDUPE_MS = 6 * 3_600_000; // the agency reissuing the same warning is not news

/** One pushLog row. `kind` and `level` are absent on rows written before they existed; those never dedupe. */
export type LogRow = { at: number; trigger: string; sent: number; kind?: string; level?: number; held?: boolean; until?: number };

/** Did this row buzz the island's phones? A test ping, a moderator note and a send that reached nobody did not. */
export const reached = (r: LogRow) => r.sent > 0 && r.trigger !== "ping" && r.trigger !== "report held";

/**
 * "send" now, "skip" (people already have this one), or the number of ms to hold it.
 * `log` is the island's rows from the last DEDUPE_MS; `waited` is true once a held warning's turn has come.
 */
export function decide(now: number, level: number, kind: string, log: LogRow[], waited = false): "send" | "skip" | number {
  if (level >= 4) return "send"; // life-safety: never held, never deduped
  const real = log.filter(reached);
  if (real.some((r) => r.kind === kind && (r.level ?? 0) >= level && now - r.at < DEDUPE_MS && now < (r.until ?? Infinity))) return "skip"; // `until`: a new warning after the old one expired is news
  const wait = Math.max(...real.map((r) => r.at)) + MIN_GAP_MS - now; // no rows: -Infinity, so send
  return waited || wait <= 0 ? "send" : wait;
}

/** When the gap ends, one push: the most urgent held warning that is still a warning (the first of equals). */
export function worstHeld(held: LogRow[], levelNow: (r: LogRow) => number) {
  return held.map((r) => ({ trigger: r.trigger, level: levelNow(r), at: r.at }))
    .filter((r) => r.level >= 3)
    .sort((a, b) => b.level - a.level || a.at - b.at)[0];
}

/** An item already on the page whose urgency climbs into warning territory is news again (Kīlauea ADVISORY -> WARNING). */
export const escalated = (was: number, is: number) => is >= 3 && is > was;
