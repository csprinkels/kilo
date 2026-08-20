"use client";
import { useEffect, useState } from "react";
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
    return cached ? { ...cached, offline: true } : { data: null, fetchedAt: 0, offline: true };
  }
}

/** Snapshot for one island + the manifest, refreshed on an interval and whenever the tab comes back. */
export function useFeed(island: Island) {
  // Start empty so the prerendered HTML matches; cached data arrives in the effect (no hydration mismatch).
  const [snap, setSnap] = useState<Loaded<Snapshot> | null>(null);
  const [manifest, setManifest] = useState<Loaded<Manifest> | null>(null);

  useEffect(() => {
    let alive = true;
    setSnap(readCache<Snapshot>(`v1/${island}.json`));
    setManifest(readCache<Manifest>("v1/manifest.json"));
    const tick = async () => {
      const [s, m] = await Promise.all([load<Snapshot>(`v1/${island}.json`), load<Manifest>("v1/manifest.json")]);
      if (!alive) return;
      setSnap(s); setManifest(m);
    };
    void tick();
    const id = setInterval(tick, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void tick();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => { alive = false; clearInterval(id); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("online", onVisible); };
  }, [island]);

  return { snap, manifest };
}

export function useStoredIsland(): [Island, (i: Island) => void] {
  const [island, set] = useState<Island>("hawaii");
  useEffect(() => {
    const saved = localStorage.getItem("island") as Island | null;
    if (saved) set(saved);
  }, []);
  return [island, (i) => { localStorage.setItem("island", i); set(i); }];
}
