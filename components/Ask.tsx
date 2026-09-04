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
import { ask, type AskCtx } from "@/lib/ask";
import type { Island } from "@/lib/types";

type Ctx = Omit<AskCtx, "roads" | "tide">;
type IslandId = Exclude<Island, "state">;

/**
 * ʻIo: ask Kilo a question in your own words. Everything it searches is already on the phone, so it
 * answers with no signal and costs nothing to run. The road pack is only fetched once someone has
 * actually typed — the Now page must not pay for a search nobody used.
 */
export default function Ask({ island, ctx, now }: { island: IslandId; ctx: Ctx; now: number }) {
  const [q, setQ] = useState("");
  const asked = q.trim();
  return (
    <section className="cs-card" aria-label="Ask Kilo">
      <label htmlFor="ask" className="cs-label">Ask about {island === "hawaii" ? "Hawaiʻi Island" : "your island"}</label>
      <input
        id="ask" className="rp-field mt-s2" type="search" value={q} autoComplete="off"
        enterKeyHint="search" placeholder="Is Saddle Road open?"
        onChange={(e) => setQ(e.target.value)}
      />
      {asked
        ? <Results island={island} ctx={ctx} q={asked} now={now} />
        : <p className="cs-meta mt-s2">Answers come from what your phone already saved, so this works with no signal.</p>}
    </section>
  );
}

/**
 * Split out so the island road pack and the weather file are only fetched once a question exists.
 * Weather is already on this page (the card below), so this is a cache read, not a second download.
 */
function Results({ island, ctx, q, now }: { island: IslandId; ctx: Ctx; q: string; now: number }) {
  const pack = useRoads(island);
  const wx = useJson<Weather>(`v1/${island}/weather.json`);
  const a = ask(q, { ...ctx, roads: pack?.lines, tide: wx?.data?.tide, now });

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
      <p className="cs-body mt-s3">
        Kilo has nothing about that. Try a road name, a town, or a word like storm, school or power.
      </p>
    );
  }
  return (
    <div className="mt-s3">
      <h3 className="cs-title">{a.say}</h3>
      {figure}
      {a.items.length > 0 && <ul className="hm-rows">{a.items.map((i) => <ItemRow key={i.key} item={i} now={now} />)}</ul>}
      {a.topic && a.href && (
        <div className="cs-chiprow">
          <Link href={a.href} className="cs-chip cs-chip--link">
            {a.topic.label} <Icon name="caret-right" size={14} className="cs-ic" />
          </Link>
        </div>
      )}
    </div>
  );
}
