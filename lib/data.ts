"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { Digest, Essentials, Island, Snapshot } from "./types";

// Where the JSON lives. Prod: the R2/CDN domain (same origin as the app). Dev: the Convex HTTP endpoint serving the same bytes.
/**
 * Where the JSON is read from: the CDN mirror when configured (data.kilohi.org), else Convex itself.
 * `||`, never `??`: an unset GitHub Actions variable arrives as "", and an empty base URL silently
 * points every fetch at the app's own origin, where there is no /v1 — a 404 on every poll.
 */
export const DATA_URL = (process.env.NEXT_PUBLIC_DATA_URL || process.env.NEXT_PUBLIC_CONVEX_SITE_URL || "").replace(/\/$/, "");
/** Where writes go (reports, votes, push, moderation): always Convex — the mirror only serves files. */
export const API_URL = (process.env.NEXT_PUBLIC_CONVEX_SITE_URL || "").replace(/\/$/, "");

// Bad-signal policy: fetch the ~1 KB essentials FIRST with a patient timeout; the 30 KB snapshot only when the link is healthy.
const T_ESS = 30_000, T_SNAP = 60_000;
const POLL_NORMAL = 120_000, POLL_LOW = 300_000, BACKOFF_MAX = 600_000;
const SLOW_MS = 5_000, FAST_MS = 1_500;

export type Mode = "normal" | "low";
export type Loaded<T> = { data: T | null; fetchedAt: number; offline: boolean; etag?: string; ms?: number };

const lsKey = (path: string) => `snap:${path}`;
const readCache = <T,>(path: string): Loaded<T> | null => {
  try { const raw = localStorage.getItem(lsKey(path)); return raw ? (JSON.parse(raw) as Loaded<T>) : null; } catch { return null; }
};

/** Same-tab listeners for link quality (mode / online / save-data / reduced motion). */
const linkListeners = new Set<() => void>();
const notifyLink = () => linkListeners.forEach((cb) => cb());
const readMode = (): Mode => (localStorage.getItem("mode") as Mode) || "normal";
/** True when bars are healthy enough for extras (animated weather icons): online, mode normal, no Save-Data, motion allowed. */
export function useWeatherMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      linkListeners.add(cb);
      window.addEventListener("online", cb);
      window.addEventListener("offline", cb);
      window.addEventListener("storage", cb);
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", cb);
      const conn = (navigator as Navigator & { connection?: EventTarget }).connection;
      conn?.addEventListener?.("change", cb);
      return () => {
        linkListeners.delete(cb);
        window.removeEventListener("online", cb);
        window.removeEventListener("offline", cb);
        window.removeEventListener("storage", cb);
        mq.removeEventListener("change", cb);
        conn?.removeEventListener?.("change", cb);
      };
    },
    () => {
      if (!navigator.onLine || readMode() === "low") return false;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
      const c = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
      return !c?.saveData;
    },
    () => false,
  );
}

/** Fetch with ETag; on any failure return the cached copy flagged offline. Never throws. */
export async function load<T>(path: string, timeoutMs = T_SNAP): Promise<Loaded<T>> {
  const cached = readCache<T>(path);
  const t0 = performance.now();
  try {
    const res = await fetch(`${DATA_URL}/${path}`, {
      headers: cached?.etag ? { "If-None-Match": cached.etag } : {},
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    const ms = performance.now() - t0;
    if (res.status === 304 && cached) return { ...cached, fetchedAt: Date.now(), offline: false, ms };
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const out: Loaded<T> = { data: (await res.json()) as T, fetchedAt: Date.now(), offline: false, etag: res.headers.get("etag") ?? undefined, ms };
    try { localStorage.setItem(lsKey(path), JSON.stringify(out)); } catch { /* storage full: still return live data */ }
    return out;
  } catch {
    // fetchedAt = last attempt, so "x min ago" stays truthful while offline
    return cached ? { ...cached, fetchedAt: Date.now(), offline: true } : { data: null, fetchedAt: Date.now(), offline: true };
  }
}

/** Latest push digest for an island, written by the service worker into Cache Storage when a push lands. */
export async function readDigest(island: Island): Promise<Digest | null> {
  try {
    if (!("caches" in window)) return null;
    const c = await caches.open("alerts");
    const r = await c.match(`/alerts/${island}`);
    return r ? ((await r.json()) as Digest) : null;
  } catch { return null; }
}

export type Feed = {
  ess: Loaded<Essentials> | null;
  snap: Loaded<Snapshot> | null;
  digest: Digest | null;
  mode: Mode;
  lastOkAt: number;     // last successful essentials fetch
};

/** Essentials-first polling with link-quality detection, backoff with jitter, and immediate re-poll when connectivity returns. */
export function useFeed(island: Island): Feed {
  const [feed, setFeed] = useState<Feed>({ ess: null, snap: null, digest: null, mode: "normal", lastOkAt: 0 });

  useEffect(() => {
    let alive = true, timer: ReturnType<typeof setTimeout> | undefined, backoff = 0, inFlight = false;
    let mode: Mode = (localStorage.getItem("mode") as Mode) || "normal";
    let lastOkAt = Number(localStorage.getItem("lastOkAt")) || 0;
    const essPath = `v1/${island}/essentials.json`, snapPath = `v1/${island}.json`;

    const schedule = (ms: number) => {
      clearTimeout(timer);
      const jitter = ms * (0.8 + Math.random() * 0.4);
      timer = setTimeout(tick, backoff ? Math.min(backoff, BACKOFF_MAX) : jitter);
    };

    const tick = async () => {
      if (!alive || inFlight) return;
      inFlight = true;
      const ess = await load<Essentials>(essPath, T_ESS);
      if (!alive) return;
      if (!ess.offline && ess.ms != null) {
        lastOkAt = Date.now(); localStorage.setItem("lastOkAt", String(lastOkAt));
        const prev = mode;
        if (ess.ms > SLOW_MS) mode = "low"; else if (ess.ms < FAST_MS) mode = "normal";
        localStorage.setItem("mode", mode);
        if (mode !== prev) notifyLink();
        backoff = 0;
      } else {
        backoff = Math.min((backoff || 15_000) * 2, BACKOFF_MAX);
      }
      let snap = readCache<Snapshot>(snapPath);
      const needSnap = !ess.offline && mode === "normal" && (!snap?.data || (ess.data?.gen ?? 0) > snap.data.gen);
      if (needSnap) { snap = await load<Snapshot>(snapPath, T_SNAP); if (!alive) return; }
      else if (snap) snap = { ...snap, offline: ess.offline };
      setFeed({ ess, snap, digest: await readDigest(island), mode, lastOkAt });
      inFlight = false;
      schedule(mode === "low" ? POLL_LOW : POLL_NORMAL);
    };

    // Stored data first (async so prerendered HTML hydrates), then the network.
    void Promise.resolve().then(async () => {
      if (!alive) return;
      setFeed({ ess: readCache<Essentials>(essPath), snap: readCache<Snapshot>(snapPath), digest: await readDigest(island), mode, lastOkAt });
      return tick();
    });

    // Bars flicker: the moment the OS says we're back, grab the 1 KB file.
    const now = () => { backoff = 0; clearTimeout(timer); timer = setTimeout(tick, 1_000); };
    const onVisible = () => document.visibilityState === "visible" && now();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", now);
    window.addEventListener("focus", now);
    window.addEventListener("pageshow", now);
    return () => { alive = false; clearTimeout(timer); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("online", now); window.removeEventListener("focus", now); window.removeEventListener("pageshow", now); };
  }, [island]);

  return feed;
}

/** Any other published JSON file (e.g. v1/storms.json), same cache + patient-timeout behaviour. */
export function useJson<T>(path: string) {
  const [state, setState] = useState<Loaded<T> | null>(null);
  useEffect(() => {
    let alive = true;
    const tick = async () => { const r = await load<T>(path, T_SNAP); if (alive) setState(r); };
    void Promise.resolve().then(() => { if (alive) setState(readCache<T>(path)); return tick(); });
    const id = setInterval(tick, POLL_NORMAL);
    const onVisible = () => document.visibilityState === "visible" && void tick();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => { alive = false; clearInterval(id); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("online", onVisible); };
  }, [path]);
  return state;
}

// localStorage-backed island choice; server snapshot is the default so prerendered HTML matches.
const islandListeners = new Set<() => void>();
const subscribeIsland = (cb: () => void) => { islandListeners.add(cb); return () => { islandListeners.delete(cb); }; };
const getIsland = () => (localStorage.getItem("island") as Island | null) ?? "hawaii";
/**
 * The evacuation-zone pack (38–130 KB) is the one file that has to already be on the phone when the signal
 * goes. Pull it the moment someone picks an island — that is when they still have bars, and it is a deliberate
 * tap, not a background poll. The service worker files it under a cache that survives app updates.
 */
const warmZones = (i: Island) => { if (i !== "state") void fetch(`/zones/${i}.json`).catch(() => {}); };
export function useStoredIsland(): [Island, (i: Island) => void] {
  const island = useSyncExternalStore(subscribeIsland, getIsland, () => "hawaii" as Island);
  return [island, (i) => {
    try { localStorage.setItem("island", i); } catch { /* storage off: the choice still holds for this visit */ }
    warmZones(i);
    islandListeners.forEach((cb) => cb());
  }];
}
/** Has this phone ever picked an island? Drives the one-screen first run. ("state" counts as not chosen.) */
const getChosen = () => { const v = localStorage.getItem("island"); return !!v && v !== "state"; };
export const useIslandChosen = () => useSyncExternalStore(subscribeIsland, getChosen, () => true);
