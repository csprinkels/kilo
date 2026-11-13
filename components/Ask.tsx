"use client";
import { useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import ItemRow from "@/components/ItemRow";
import { useRoads } from "@/components/RoadMap";
import MiniMap from "@/components/MiniMap";
import StormMap from "@/components/StormMap";
import TideChart from "@/components/TideChart";
import { markOf } from "@/lib/feed";
import { useJson } from "@/lib/data";
import { ISLAND_POINTS } from "@/lib/storm";
import type { Weather } from "@/lib/pages";
import { ask, examples, type AskCtx } from "@/lib/ask";
import type { Island } from "@/lib/types";

type Ctx = Omit<AskCtx, "roads" | "tide" | "island" | "wx" | "town">;
type IslandId = Exclude<Island, "state">;

/**
 * ʻIo: ask Kilo a question in your own words. Everything it searches is already on the phone, so it
 * answers with no signal and costs nothing to run. The road pack is only fetched once someone has
 * actually typed — the Now page must not pay for a search nobody used.
 * One white field with the question mark; the answer arrives as a card under it.
 */
export default function Ask({ island, ctx, now, inputId = "ask", autoFocus }: { island: IslandId; ctx: Ctx; now: number; inputId?: string; autoFocus?: boolean }) {
  const [q, setQ] = useState("");
  const asked = q.trim();
  return (
    <section className="cs-askwrap" aria-label="Ask Kilo">
      <label htmlFor={inputId} className="cs-ask">
        <Icon name="question" size={20} />
        <span className="sr-only">Ask about {island === "hawaii" ? "Hawaiʻi Island" : "your island"}</span>
        <input
          id={inputId} type="search" value={q} autoComplete="off" autoFocus={autoFocus}
          enterKeyHint="search" placeholder={examples(island)[0]}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>
      {asked
        ? <div className="cs-card"><Results island={island} ctx={ctx} q={asked} now={now} onPick={setQ} /></div>
        : <Examples island={island} onPick={setQ} />}
    </section>
  );
}

/** Questions Ask really answers on this island, one tap each: a promise the lexicon can keep. */
function Examples({ island, onPick }: { island: IslandId; onPick: (q: string) => void }) {
  return (
    <div className="cs-pills" style={{ marginTop: 0 }}>
      {examples(island).map((e) => <button key={e} type="button" className="cs-chip cs-chip--link" onClick={() => onPick(e)}>{e}</button>)}
    </div>
  );
}

/**
 * Split out so the island road pack and the weather file are only fetched once a question exists.
 * Weather is already on this page (the card below), so this is a cache read, not a second download.
 */
function Results({ island, ctx, q, now, onPick }: { island: IslandId; ctx: Ctx; q: string; now: number; onPick: (q: string) => void }) {
  const pack = useRoads(island);
  const wx = useJson<Weather>(`v1/${island}/weather.json`);
  // "town" is the Weather page's saved choice. Results only mounts after typing, so never on the server.
  const a = ask(q, { ...ctx, island, roads: pack?.lines, tide: wx?.data?.tide, wx: wx?.data ?? undefined, town: localStorage.getItem("town") ?? undefined, now });

  /*
   * Some answers are a picture. "When is high tide" is a curve, a storm is a track, and a closure
   * is a line on a road — a sentence about any of them is the caption, not the answer. Only ever
   * the app's own drawings of data it already has: there is nothing here to fetch and nothing to
   * invent, so an answer with a picture still works with no signal.
   */
  const tide = a.topic?.key === "tides" ? wx?.data?.tide : undefined;
  const storm = a.storms?.find((s) => s.s)?.s;
  const mark = a.items.length ? markOf(a.items[0]) : undefined;
  const figure =
    tide ? <TideChart tide={tide} />
    : storm ? <div className="cs-figure ask-figure"><StormMap storm={storm} place={ISLAND_POINTS[island]} compact /></div>
    : mark ? <div className="ask-mark"><MiniMap island={island} mark={mark} size={220} /></div>
    : null;

  if (!a.say) {
    return (
      <>
        <p className="cs-body">Kilo has nothing about that. Try one of these.</p>
        <Examples island={island} onPick={onPick} />
      </>
    );
  }
  return (
    <div>
      <h3 className="cs-title">{a.say}</h3>
      {figure}
      {a.items.length > 0 && <ul className="cs-rows">{a.items.map((i) => <ItemRow key={i.key} item={i} now={now} />)}</ul>}
      {a.link && (
        <div className="cs-chiprow">
          <a href={a.link.url} target="_blank" rel="noreferrer" className="cs-chip cs-chip--link">
            {a.link.label} <Icon name="arrow-square-out" size={14} className="cs-ic" />
          </a>
        </div>
      )}
      {!a.link && a.topic && a.href && (
        <div className="cs-chiprow">
          <Link href={a.href} className="cs-chip cs-chip--link">
            {a.topic.label} <Icon name="caret-right" size={14} className="cs-ic" />
          </Link>
        </div>
      )}
    </div>
  );
}
