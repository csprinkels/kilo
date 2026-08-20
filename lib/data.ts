"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { Island, Manifest, Snapshot } from "./types";

// Where the JSON lives. Prod: the R2/CDN domain. Dev: the Convex HTTP endpoint serving the same bytes.
export const DATA_URL = (process.env.NEXT_PUBLIC_DATA_URL ?? process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "").replace(/\/$/, "");

const POLL_MS = 120_000;

export type Loaded<T> = { data: T | null; fetchedAt: number; offline: boolean; etag?: string };

const lsKey = (path: string) => `snap:${path}`;

function readCache<T>(path: string): Loaded<T> | null {
  try {
    const raw = localStorage.getItem(lsKey(path));
    return raw ? (JSON.parse(raw) as Loaded<T>) : null;
  } catch { return null; }
}

/** Fetch with ETag; on any failure return the cached copy flagged offline. Never throws. */
export async function load<T>(path: string): Promise<Loaded<T>> {
  const cached = readCache<T>(path);
  try {
    const res = await fetch(`${DATA_URL}/${path}`, {
      headers: cached?.etag ? { "If-None-Match": cached.etag } : {},
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (res.status === 304 && cached) return { ...cached, fetchedAt: Date.now(), offline: false };
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const out: Loaded<T> = { data: (await res.json()) as T, fetchedAt: Date.now(), offline: false, etag: res.headers.get("etag") ?? undefined };
    try { localStorage.setItem(lsKey(path), JSON.stringify(out)); } catch { /* storage full: still return live data */ }
    return out;
  } catch {
    // fetchedAt = last attempt, so "x min ago" stays truthful while offline
    return cached ? { ...cached, fetchedAt: Date.now(), offline: true } : { data: null, fetchedAt: Date.now(), offline: true };
  }
}

/** Snapshot for one island + the manifest, refreshed on an interval and whenever the tab comes back. */
export function useFeed(island: Island) {
  // Start empty so the prerendered HTML matches; cached data arrives in the effect (no hydration mismatch).
  const [snap, setSnap] = useState<Loaded<Snapshot> | null>(null);
  const [manifest, setManifest] = useState<Loaded<Manifest> | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const [s, m] = await Promise.all([load<Snapshot>(`v1/${island}.json`), load<Manifest>("v1/manifest.json")]);
      if (!alive) return;
      setSnap(s); setManifest(m);
    };
    // Show the saved copy immediately, then refresh. (Async so the prerendered HTML hydrates first.)
    void Promise.resolve().then(() => {
      if (!alive) return;
      setSnap(readCache<Snapshot>(`v1/${island}.json`));
      setManifest(readCache<Manifest>("v1/manifest.json"));
      return tick();
    });
    const id = setInterval(tick, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void tick();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => { alive = false; clearInterval(id); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("online", onVisible); };
  }, [island]);

  return { snap, manifest };
}

// localStorage-backed island choice; server snapshot is the default so prerendered HTML matches.
const islandListeners = new Set<() => void>();
const subscribeIsland = (cb: () => void) => { islandListeners.add(cb); return () => { islandListeners.delete(cb); }; };
const getIsland = () => (localStorage.getItem("island") as Island | null) ?? "hawaii";
export function useStoredIsland(): [Island, (i: Island) => void] {
  const island = useSyncExternalStore(subscribeIsland, getIsland, () => "hawaii" as Island);
  return [island, (i) => { localStorage.setItem("island", i); islandListeners.forEach((cb) => cb()); }];
}
