// Decides when the owner gets told the backend is quietly broken. Pure so it can be unit-tested.
export type WatchState = { source: string; failsInRow: number; lastOk: number; lastAlertAt: number };

export const FAILS_TO_ALERT = 3;
export const ALERT_GAP_MS = 6 * 3_600_000;
export const STALE_MS = 15 * 60_000;
export const SNAPSHOT = "__snapshot";

export function fresh(source: string, now: number): WatchState {
  return { source, failsInRow: 0, lastOk: now, lastAlertAt: 0 };
}

/** One observation of a source: returns the next row and an alert text if the owner should hear about it now. */
export function step(prev: WatchState, ok: boolean, now: number, text: { down: string; back: string }, threshold = FAILS_TO_ALERT) {
  const recent = prev.lastAlertAt > 0 && now - prev.lastAlertAt < ALERT_GAP_MS; // 0 = never alerted
  if (ok) {
    const next = { ...prev, failsInRow: 0, lastOk: now };
    // Only say "back" once: failsInRow resets, so the next ok run is quiet.
    return { next, alert: prev.failsInRow >= threshold && recent ? text.back : undefined };
  }
  const next = { ...prev, failsInRow: prev.failsInRow + 1 };
  if (next.failsInRow >= threshold && !recent) return { next: { ...next, lastAlertAt: now }, alert: text.down };
  return { next, alert: undefined };
}

export function sourceStep(prev: WatchState, ok: boolean, error: string | undefined, now: number) {
  const n = prev.failsInRow + 1;
  return step(prev, ok, now, { down: `${prev.source} has failed ${n} times in a row: ${error ?? "unknown error"}`, back: `${prev.source} is back` });
}

/** The manifest's gen is the heartbeat of the whole pipeline; one miss is enough to speak up. */
export function snapshotStep(prev: WatchState, gen: number, now: number) {
  const mins = Math.round((now - gen) / 60_000);
  return step(prev, now - gen < STALE_MS, now, { down: `Kilo has not updated for ${mins} minutes`, back: "Kilo is updating again" }, 1);
}
