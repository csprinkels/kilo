// The Now page as a feed: one row per real thing, newest first inside a severity band.
// Pure, so tests/feed.test.ts can pin the order and the collapse without a browser.
//
// Two zones, and the split is what you DO with the thing:
//   pinned  — the hazards that change today. Always at the top of the page.
//   feed    — everything else, worst first, newest inside that.
// A topic summary is not a feed row: Lowell and Karina are two rows, not a "Storms" card.
import type { Island, Item, ItemType } from "./types.ts";
import type { Level, Plain, StormLine } from "./plain.ts";
import type { LatLon } from "./roads.ts";
import { fmtClock } from "./brand.ts";

/** Where the row's picture comes from. Only the things that carry a real position get one. */
export type Mark =
  | { kind: "path"; path: LatLon[] }
  | { kind: "dot"; lat: number; lon: number };

export type FeedRow = {
  key: string;
  at: number;             // issuedAt, for ordering inside a band
  topic: string;          // the .t-* class stem: roads, storms, quakes, volcano, tsunami, reports
  headline: string;
  sub: string;
  source: string;
  when: string;           // clock time. Never "ago" — the banned list, and a clock is unambiguous offline.
  level: Level;
  href: string;
  mark?: Mark;
};

/** A run of rows the page shows in full, plus the count it folded away. */
export type FeedBand = { key: string; label: string; rows: FeedRow[] };

const TOPIC_OF: Partial<Record<ItemType, string>> = {
  road_closure: "roads", traffic: "roads",
  quake: "quakes", volcano: "volcano", tsunami: "tsunami",
  storm: "storms", shelter: "tsunami", evac: "tsunami",
  school: "reports", notice: "reports", outage: "reports",
  advisory: "weather", hazard: "weather",
};
const HREF_OF: Record<string, string> = {
  roads: "/traffic/", quakes: "/quakes/", volcano: "/volcano/",
  tsunami: "/tsunami/", storms: "/storms/", weather: "/weather/", reports: "/report/",
};

/**
 * What belongs in the pinned block. Level 2 alone is far too wide — it is this app's default
 * bucket for anything nobody classified, so a road closure and a notice both land there, and
 * pinning on level alone put twenty-five rows above the fold. The pin is a HAZARD that changes
 * today; a closed road is something that happened, and it reads in the feed.
 */
const ACT_ON: ItemType[] = ["advisory", "storm", "outage", "tsunami", "hazard", "school", "evac", "shelter"];
export const isPinned = (i: Item, p: Plain | undefined): boolean =>
  !!p && (p.level >= 3 || (p.level === 2 && ACT_ON.includes(i.type)));

/** How many of one kind the feed shows before folding the rest behind a count. */
export const RUN_LIMIT = 3;

const markOf = (i: Item): Mark | undefined =>
  i.path?.length ? { kind: "path", path: i.path }
  : i.lat != null && i.lon != null ? { kind: "dot", lat: i.lat, lon: i.lon }
  : undefined;

/** One official item as a row. `sub` is the action when there is one, else the agency's own line. */
function rowOf(i: Item, p: Plain, now: number): FeedRow {
  const topic = TOPIC_OF[i.type] ?? "reports";
  return {
    key: i.key, topic,
    headline: p.headline.endsWith(".") ? p.headline : `${p.headline}.`,
    sub: p.action || "",
    source: p.source ?? "",
    at: i.issuedAt,
    when: fmtClock(i.issuedAt, now),
    level: p.level,
    href: HREF_OF[topic] ?? "/",
    mark: markOf(i),
  };
}

/**
 * Fold a long run of one kind: 33 road closures cannot each be a row. Keeps the first
 * RUN_LIMIT and returns what was dropped, so the page can say the number out loud rather
 * than silently showing a third of the closures.
 */
export function foldRuns(rows: FeedRow[]): { rows: FeedRow[]; folded: Record<string, number> } {
  const seen: Record<string, number> = {}, folded: Record<string, number> = {}, out: FeedRow[] = [];
  for (const r of rows) {
    seen[r.topic] = (seen[r.topic] ?? 0) + 1;
    if (seen[r.topic] <= RUN_LIMIT) out.push(r);
    else folded[r.topic] = (folded[r.topic] ?? 0) + 1;
  }
  return { rows: out, folded };
}

export type FeedInput = {
  items: Item[];
  plain: Map<string, Plain>;
  now: number;
  /** The same storm sentences the page shows. Storms are not items — they live in their own file. */
  storms?: StormLine[];
  island: Exclude<Island, "state">;
};

/**
 * Everything that is NOT pinned, banded by how much it should change what you do and newest
 * first inside a band. Level >= 2 belongs to the pinned block, so it never appears here.
 */
export function buildFeed({ items, plain, now, storms }: FeedInput): FeedBand[] {
  const rows: FeedRow[] = items
    .filter((i) => i.tier !== "community")
    .map((i) => [i, plain.get(i.key)] as const)
    .filter((pair): pair is readonly [Item, Plain] => !!pair[1] && !isPinned(pair[0], pair[1]))
    .map(([i, p]) => rowOf(i, p, now));

  // Storms are their own file, so they are appended rather than filtered out of `items`.
  // One that is genuinely coming has its own card with a real map, and never doubles as a row.
  for (const s of storms ?? []) {
    if (s.approaching) continue;
    rows.push({
      key: `storm:${s.s.id}`, topic: "storms", at: s.s.issuedAt,
      headline: s.short.endsWith(".") ? s.short : `${s.short}.`,
      sub: "", source: "the Hurricane Center", when: fmtClock(s.s.issuedAt, now),
      level: s.level, href: "/storms/",
      mark: { kind: "dot", lat: s.s.lat, lon: s.s.lon },
    });
  }

  // Severity first, then newest — the order asked for. Everything urgent is already pinned,
  // so in practice this band runs from "worth knowing" down to "for the record".
  rows.sort((a, b) => b.level - a.level || b.at - a.at);
  return rows.length ? [{ key: "today", label: "Also happening today", rows }] : [];
}

/** The pinned block: everything that changes what you do today, worst first. */
export function pinned(items: Item[], plain: Map<string, Plain>): Item[] {
  return items
    .filter((i) => i.tier !== "community" && isPinned(i, plain.get(i.key)))
    .sort((a, b) => (plain.get(b.key)!.level - plain.get(a.key)!.level) || (b.issuedAt - a.issuedAt));
}
