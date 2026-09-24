"use client";
import { useMemo } from "react";
import Icon from "@/components/Icon";
import Ask from "@/components/Ask";
import { useFeed, useJson, useStoredIsland } from "@/lib/data";
import { dropSuperseded } from "@/lib/feed";
import { plainAlert, rankStorms, type Plain } from "@/lib/plain";
import { ISLAND_POINTS, type StormsSnapshot } from "@/lib/storm";

/**
 * ʻIo as a sheet, opened from the dock on any page. It builds the same context the Now page hands
 * its inline field — the island's items in plain words and the storm lines — so an answer here and
 * an answer on Now are the same answer. Mounted only while the dialog is open, so a page nobody
 * searches from pays for nothing.
 */
export default function AskSheet({ onClose }: { onClose: () => void }) {
  const [stored] = useStoredIsland();
  const island = stored === "state" ? "hawaii" : stored;
  const { ess, snap } = useFeed(island);
  const stormsSnap = useJson<StormsSnapshot>("v1/storms.json");
  const now = ess?.fetchedAt || snap?.fetchedAt || 0;

  const ctx = useMemo(() => {
    const items = dropSuperseded(snap?.data?.items ?? []);
    const plain = new Map(items.map((i) => [i.key, plainAlert(i, now, island)] as [string, Plain]));
    const storms = stormsSnap?.data
      ? rankStorms(stormsSnap.data.storms, ISLAND_POINTS[island]).map((x) => ({ name: x.s.name, short: x.short, s: x.s }))
      : undefined;
    return { items, plain, storms };
  }, [snap, stormsSnap, now, island]);

  return (
    <div className="cs-sheet">
      <div className="cs-sheet-head">
        <span className="cs-label cs-sheet-label">Ask Kilo</span>
        <button type="button" className="cs-sheet-x" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
      </div>
      <Ask island={island} ctx={ctx} now={now} inputId="ask-sheet" autoFocus />
      <p className="cs-meta">Answers come from what your phone already saved, so this works with no signal.</p>
    </div>
  );
}
