"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Chips that cut a long page down to the one thing you came for.
 *
 * Kilo's pages answer several questions at once, and the answer you want is usually not the first
 * one. Picking a chip hides the rest, so "when is high tide" is one tap instead of a thumb-drag past
 * the radar, the hourly strip and four days of forecast.
 *
 * One rule this must never break: a filter hides SECTIONS, never WARNINGS.
 *
 * That rule is harder than it looks, because whether a section is a warning depends on its DATA, not
 * on which section it is. The Air card is a fact at category 0 and "unhealthy for everyone, stay
 * inside" at category 3 — same card, same chip. So `show` takes a second argument: the condition
 * under which this section is currently shouting. When it is true the section stays on screen in
 * every filter state, and the chip becomes a way to jump to it rather than a way to lose it.
 */
export type Chip = { id: string; label: string };

export type FilterOpts = {
  label?: string;
  /**
   * Something that changes when the danger does — a level, a status word. A reader parked on one
   * chip when a warning arrives would otherwise stay parked, with the new instructions filtered out
   * of the page. Changing this puts them back on All.
   */
  clearOn?: string | number;
};

/** Under this many choices a filter is just another row to read past. */
const MIN_CHIPS = 3;

export function usePageFilter(chips: Chip[], { label = "Filter this page", clearOn }: FilterOpts = {}) {
  const [only, setOnly] = useState<string | null>(null);

  const seen = useRef(clearOn);
  useEffect(() => {
    if (seen.current !== clearOn) { seen.current = clearOn; setOnly(null); }
  }, [clearOn]);

  // A chip whose section is not on the page today would filter to nothing at all, so pages pass
  // only the chips they actually rendered and this stays honest by construction.
  const enough = chips.length >= MIN_CHIPS;
  const active = enough && only && chips.some((c) => c.id === only) ? only : null;

  const bar: ReactNode = enough ? (
    <div className="no-scrollbar pf-bar" role="group" aria-label={label}>
      <button type="button" className="pf-chip" aria-pressed={active === null} onClick={() => setOnly(null)}>All</button>
      {chips.map((c) => (
        <button key={c.id} type="button" className="pf-chip" aria-pressed={active === c.id}
          // Pressing the lit chip again is the way back, so the row is its own undo.
          onClick={() => setOnly((p) => (p === c.id ? null : c.id))}>
          {c.label}
        </button>
      ))}
    </div>
  ) : null;

  return {
    bar,
    only: active,
    /** `keep` is "this section is carrying a warning right now" — it outranks the filter. */
    show: (id: string, keep = false) => keep || active === null || active === id,
  };
}
