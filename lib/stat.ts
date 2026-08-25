"use client";
import { API_URL } from "./data";

/**
 * First-party, anonymous usage counts. track("open:storm") adds one to a tally that lives on our own server,
 * added up across everyone — never tied to a phone, a person, or a location. No cookies, no device id, no third party.
 * Buffered and sent with sendBeacon on a timer and when the page is hidden, so it costs the user almost nothing.
 * The moderator's own taps are skipped so they don't skew the numbers.
 */
const buf = new Map<string, number>();
let timer: ReturnType<typeof setTimeout> | undefined;

const muted = () => {
  try {
    if (localStorage.getItem("modKey")) return true;              // the one moderator: don't count yourself
    const p = location.pathname;
    return p.startsWith("/mod") || p.startsWith("/stats");
  } catch { return false; }
};

function flush() {
  timer = undefined;
  if (!buf.size || !API_URL) return;
  const events: Record<string, number> = {};
  for (const [k, n] of buf) events[k] = n;
  buf.clear();
  try {
    const body = new Blob([JSON.stringify({ events })], { type: "text/plain" }); // text/plain → a simple request, no CORS preflight
    if (!(navigator.sendBeacon && navigator.sendBeacon(`${API_URL}/v1/stat`, body)))
      void fetch(`${API_URL}/v1/stat`, { method: "POST", body, keepalive: true }).catch(() => {});
  } catch { /* stats never matter enough to fail anything */ }
}

export function track(event: string) {
  if (typeof window === "undefined" || muted()) return;
  buf.set(event, (buf.get(event) ?? 0) + 1);
  if (!timer) timer = setTimeout(flush, 10_000);
}

let wired = false;
/** Called once from the root: flush whatever is buffered when the app goes to the background or closes. */
export function wireStatFlush() {
  if (wired || typeof document === "undefined") return;
  wired = true;
  addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
  addEventListener("pagehide", flush);
}
