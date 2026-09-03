// ʻIo — asking Kilo a question in your own words. No network and no model: a lexicon over the same
// snapshot the page is already rendering, so an answer is always something the app can already show.
// That is the point. A search that needs signal is useless in the storm it was built for, and a
// search that writes its own sentences can say something the feed never said.
//
// Every sentence a user reads here is either plain.ts's wording for a real item, or one of the fixed
// lines below. Nothing is generated.
import type { Item, ItemType } from "./types.ts";
import type { Plain } from "./plain.ts";
import { fold } from "./places.ts";
import { districtsFor } from "./places.ts";
import { roadWords, type RoadLine } from "./roads.ts";

/** A topic is named by its nouns and described by its words: "school" identifies, "closed" only colours. */
export type Topic = { key: string; label: string; href: string; types: ItemType[]; nouns: string[]; words: string[] };

/** The whole of ʻIo's "understanding": which words mean which corner of the app. */
export const TOPICS: Topic[] = [
  { key: "roads", label: "Roads", href: "/traffic/", types: ["road_closure", "traffic"],
    nouns: ["road", "roads", "highway", "highways", "hwy", "street", "avenue", "freeway", "traffic", "detour", "route"],
    words: ["closed", "closure", "closures", "open", "blocked", "lane", "crash", "accident", "wreck", "driving", "drive", "through", "pass", "stuck"] },
  { key: "storms", label: "Storms", href: "/storms/", types: ["storm"],
    nouns: ["storm", "storms", "hurricane", "hurricanes", "cyclone", "tropical", "depression"],
    words: ["coming", "track", "cone", "landfall", "brewing"] },
  { key: "quakes", label: "Earthquakes", href: "/quakes/", types: ["quake"],
    nouns: ["earthquake", "earthquakes", "quake", "quakes", "tremor", "aftershock"],
    words: ["shake", "shaking", "shook", "felt", "magnitude"] },
  { key: "volcano", label: "Volcano", href: "/volcano/", types: ["volcano"],
    nouns: ["volcano", "lava", "eruption", "vog", "kilauea", "mauna", "caldera", "crater", "fissure"],
    words: ["volcanic", "erupting", "erupt", "loa", "sulfur", "summit", "smoke"] },
  { key: "tsunami", label: "Tsunami", href: "/tsunami/", types: ["tsunami", "evac"],
    nouns: ["tsunami", "evacuation", "siren", "sirens", "zone", "zones", "inundation"],
    words: ["evacuate", "evacuating", "leave", "inland", "uphill", "coast", "shoreline"] },
  { key: "shelters", label: "Shelters", href: "/", types: ["shelter"],
    nouns: ["shelter", "shelters", "refuge"],
    words: ["cot", "cots", "sheltering", "stay", "open"] },
  { key: "weather", label: "Weather", href: "/weather/", types: ["advisory"],
    nouns: ["weather", "rain", "wind", "surf", "swell", "forecast", "flood", "heat", "temperature"],
    words: ["raining", "rainy", "windy", "wave", "waves", "flooding", "hot", "sunny", "sunrise", "sunset", "humid", "fog", "cold"] },
  { key: "school", label: "Schools", href: "/", types: ["school"],
    nouns: ["school", "schools", "class", "classes", "campus"],
    words: ["kids", "students", "teacher", "closed", "cancelled", "canceled"] },
  { key: "outage", label: "Power and water", href: "/", types: ["outage"],
    nouns: ["power", "outage", "outages", "electricity", "water"],
    words: ["electric", "lights", "boil", "utility", "off", "out"] },
  { key: "reports", label: "Reports", href: "/report/", types: [],
    nouns: ["neighbor", "neighbors", "report", "reports"],
    words: ["posted", "anyone", "somebody", "someone", "saying"] },
];

const STOP = new Set(["is", "are", "the", "a", "an", "my", "i", "it", "to", "in", "on", "at", "of", "for", "do", "does", "did", "can", "we", "you", "there", "any", "what", "whats", "how", "when", "where", "wheres", "was", "were", "be", "been", "and", "or", "if", "me", "near", "by", "still", "right", "now", "today", "tonight", "need", "should", "will", "have", "has", "about", "with", "from", "up", "down", "out", "over", "this", "that", "s", "t"]);

const tokens = (q: string) => fold(q).split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !STOP.has(w));

/** Words several topics share ("open" is roads and shelters) decide nothing on their own. */
const SHARED = new Set(TOPICS.flatMap((t) => t.words).filter((w, _, all) => all.indexOf(w) !== all.lastIndexOf(w)));

/** "Highway 19", "route 11" -> [19, 11]. Bare numbers are ignored: "11" alone is not a road. */
const routeNums = (q: string) => [...q.matchAll(/\b(?:highway|hwy|route|rte|sr)\.?\s*(\d{1,3})\b/gi)].map((m) => Number(m[1]));

export type Answer = {
  /** One sentence. Either plain.ts's wording for a real item, or a fixed line from this file. */
  say: string;
  items: Item[];
  topic?: Topic;
  href?: string;
  /** True when we are confident nothing is happening, rather than confident we found nothing. */
  allClear: boolean;
};

export type AskCtx = {
  items: Item[];
  plain: Map<string, Plain>;
  /** The island's offline road pack, so a road we know about can be answered for by name. */
  roads?: RoadLine[];
  /**
   * The same storm sentences the Now page shows. Storms are not `items` — they live in their own
   * file — so without this "hurricane" would find nothing in the snapshot and wrongly answer
   * "no storms near Hawaiʻi" with two of them in the basin. `undefined` means the file has not
   * loaded, which is never an all-clear.
   */
  storms?: { name: string; short: string }[];
};

/** Which topic a question is about. A word unique to one topic outweighs one several topics share. */
function topicFor(qt: string[], stormNames: string[]): Topic | undefined {
  if (qt.some((w) => stormNames.includes(w))) return TOPICS.find((t) => t.key === "storms");
  let best: Topic | undefined, bestN = 0;
  for (const t of TOPICS) {
    const n = qt.reduce((s, w) => s + (t.nouns.includes(w) ? 4 : t.words.includes(w) ? (SHARED.has(w) ? 1 : 2) : 0), 0);
    if (n > bestN) { best = t; bestN = n; }
  }
  return best;
}

/** A road the question names: what to call it, and every name that counts as that road. */
export type RoadMatch = { label: string; names: string[][] };

/**
 * The road from the island pack that the question names. A road matches when every distinctive word
 * of its name is in the question: "saddle road open" finds Saddle Rd and nothing else, so we can
 * answer for that road instead of listing whatever closure happens to rank highest.
 * A route number covers all its segments, because "Highway 11" is one road to the person asking.
 */
/** Some county packs shout ("KALANIANAOLE HWY"); nothing the app says to a person is in caps. */
const roadLabel = (n: string) => (n === n.toUpperCase() ? n.replace(/\b[A-Z]{2,}\b/g, (w) => w[0] + w.slice(1).toLowerCase()) : n);

function roadFor(q: string, qt: string[], roads: RoadLine[]): RoadMatch | undefined {
  const wordLists = (ls: RoadLine[]) => [...new Map(ls.map((l) => [l.n, roadWords(l.n)])).values()].filter((w) => w.length);
  const nums = routeNums(q);
  if (nums.length) {
    const seg = roads.filter((l) => l.r && nums.includes(l.r));
    if (seg.length) return { label: `Highway ${nums[0]}`, names: wordLists(seg) };
  }
  const hits = roads.filter((l) => {
    const lw = roadWords(l.n);
    return lw.length > 0 && lw.every((w) => qt.includes(w));
  });
  if (!hits.length) return undefined;
  const best = hits.sort((a, b) => roadWords(b.n).length - roadWords(a.n).length)[0];
  return { label: roadLabel(best.n), names: [roadWords(best.n)] };
}

const haystack = (i: Item) => fold([i.title, i.body, i.status ?? "", i.districts.join(" ")].join(" "));

/** Ask Kilo a question. Pure, synchronous, offline: it only ever points at items already on the phone. */
export function ask(q: string, ctx: AskCtx): Answer {
  const qt = tokens(q);
  if (!qt.length) return { say: "", items: [], allClear: false };

  const stormNames = (ctx.storms ?? []).map((s) => fold(s.name));
  const topic = topicFor(qt, stormNames);

  // Storms answer from the storms file, never from the snapshot, and never claim an all-clear
  // for a file that has not loaded.
  if (topic?.key === "storms") {
    if (!ctx.storms) return { say: "The storm list has not loaded yet.", items: [], topic, href: topic.href, allClear: false };
    const named = ctx.storms.filter((s) => qt.includes(fold(s.name)));
    const show = named.length ? named : ctx.storms;
    if (show.length) return { say: show.map((s) => s.short).join(" "), items: [], topic, href: topic.href, allClear: false };
    return { say: NOTHING.storms, items: [], topic, href: topic.href, allClear: true };
  }

  const districts = districtsFor(q);
  const road = ctx.roads?.length ? roadFor(q, qt, ctx.roads) : undefined;

  // When the question names a road we know, only that road can answer it. Matched on the item's own
  // title, never its body: a closure elsewhere routinely names this road as the way around, and that
  // is not the road being closed.
  const onRoad = (i: Item) => road!.names.some((nm) => nm.every((w) => fold(i.title).includes(w)));
  const pool = road ? ctx.items.filter(onRoad) : ctx.items;

  const scored = pool.map((item) => {
    const hay = haystack(item);
    let score = road ? 6 : 0;
    if (topic?.types.includes(item.type)) score += 4;
    for (const w of qt) if (w.length > 2 && hay.includes(w)) score += 2;
    if (districts.length && districts.some((d) => item.districts.includes(d))) score += 3;
    score += (ctx.plain.get(item.key)?.level ?? 0) * 0.5;
    return { item, score };
  }).filter((h) => h.score >= 6).sort((a, b) => b.score - a.score || b.item.issuedAt - a.item.issuedAt);

  const items = scored.slice(0, 6).map((h) => h.item);
  if (items.length) {
    const p = ctx.plain.get(items[0].key);
    return {
      say: p ? p.headline + (p.headline.endsWith(".") ? "" : ".") : items[0].title,
      items, topic, href: topic?.href, allClear: false,
    };
  }

  // Nothing matched. Saying so precisely is the most useful thing a search over a closed set can do:
  // we know every road in the pack, so "nothing reported on Saddle Rd" is a fact, not a shrug.
  if (road) return { say: `No closure reported on ${road.label}.`, items: [], topic: TOPICS[0], href: "/traffic/", allClear: true };
  if (topic) return { say: NOTHING[topic.key] ?? "Nothing reported.", items: [], topic, href: topic.href, allClear: true };
  return { say: "", items: [], allClear: false };
}

/** The all-clear line per topic. Fixed wording, no agency words, safe to show when we found nothing. */
const NOTHING: Record<string, string> = {
  roads: "No crashes or closures reported.",
  storms: "No storms near Hawaiʻi right now.",
  quakes: "No earthquake big enough to feel.",
  volcano: "No volcano notice right now.",
  tsunami: "No tsunami warning right now.",
  shelters: "No shelters are open right now.",
  weather: "No weather warning right now.",
  school: "No school closures reported.",
  outage: "No power or water problems reported.",
  reports: "Nobody has posted a report today.",
};
