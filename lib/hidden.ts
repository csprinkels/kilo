"use client";
import { useSyncExternalStore } from "react";

/**
 * Neighbours this phone has hidden, by the `by` label the feed publishes with each post.
 * Blocking someone is a promise you keep everywhere at once, so the list lives here and
 * lib/data.ts filters the feed through it — no page gets to forget.
 * It never leaves the phone and is not sent to us: hiding is this reader's choice, not a vote.
 */
const KEY = "hidden";
const EMPTY: ReadonlySet<string> = new Set();

const read = (): string[] => {
  try { const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]"); return Array.isArray(v) ? (v as string[]) : []; }
  catch { return []; }
};

let snap: ReadonlySet<string> | null = null;              // cached: useSyncExternalStore needs a stable reference
const subs = new Set<() => void>();
const current = () => (snap ??= new Set(read()));
const changed = () => { snap = null; for (const cb of subs) cb(); };

/** Hide every post from one neighbour, on this phone, from now on. */
export function hidePoster(by: string) {
  try { localStorage.setItem(KEY, JSON.stringify([...new Set([...read(), by])])); } catch { /* storage full: nothing to hide with */ }
  changed();
}

/** Undo all of it — the only way back, from Settings. */
export function showEveryone() {
  try { localStorage.removeItem(KEY); } catch { /* nothing stored anyway */ }
  changed();
}

export const hiddenCount = () => read().length;

/** The hidden set, re-rendering whatever reads it the moment it changes. */
export function useHidden(): ReadonlySet<string> {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      addEventListener("storage", changed);                // hidden in another tab counts here too
      return () => { subs.delete(cb); removeEventListener("storage", changed); };
    },
    current,
    () => EMPTY,
  );
}
