"use client";
import { useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import ItemRow from "@/components/ItemRow";
import { useRoads } from "@/components/RoadMap";
import { ask, type AskCtx } from "@/lib/ask";
import type { Island } from "@/lib/types";

type Ctx = Omit<AskCtx, "roads">;
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

/** Split out so the island road pack is only fetched once a question exists. */
function Results({ island, ctx, q, now }: { island: IslandId; ctx: Ctx; q: string; now: number }) {
  const pack = useRoads(island);
  const a = ask(q, { ...ctx, roads: pack?.lines });

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
