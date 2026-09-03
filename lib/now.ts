// What the Now page says, as pure functions: the one-line story at the top and the one line per topic.
// No React here so tests/now.test.ts can pin the sentences.
import type { Island, Item } from "./types.ts";
import type { Plain, StormLine } from "./plain.ts";
import { fmtClock } from "./brand.ts";

export type Row = { key: string; label: string; text: string; href: string; quiet: boolean };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The hero sentence: the storm if one is coming, else the lead warning, else a shelter, else the roads, else "ordinary day". */
export function nowStory({ storm, roads, shelterPlain, leadPlain, nextPlain, island }: {
  storm?: StormLine;
  roads: Row;
  shelterPlain?: Plain;
  leadPlain?: Plain;
  /** The worst level-2 hazard: a watch, a warning that is not yet life-safety. Without it the headline
   *  printed "Nothing urgent" through a live tsunami watch, which no other surface on the page carried. */
  nextPlain?: Plain;
  island: string;
}): { title: string; sub: string } {
  const extra = [
    !roads.quiet ? roads.text.replace(/\s+\d+ more\.$/, "") : "",
    shelterPlain?.headline ?? "",
  ].filter(Boolean).join(" ");
  if (storm) {
    const weekend = /Saturday|Sunday/i.test(storm.text);
    return { title: weekend ? "A storm is coming this weekend." : `${storm.s.name} is headed this way.`, sub: extra || storm.text };
  }
  if (leadPlain) return { title: leadPlain.headline + (leadPlain.headline.endsWith(".") ? "" : "."), sub: extra || leadPlain.action };
  if (shelterPlain) return { title: shelterPlain.headline + (shelterPlain.headline.endsWith(".") ? "" : "."), sub: extra && extra !== shelterPlain.headline ? extra : (shelterPlain.action || "") };
  // A watch outranks a closed road: it is the thing you opened the app to find out about.
  if (nextPlain) return { title: nextPlain.headline + (nextPlain.headline.endsWith(".") ? "" : "."), sub: extra || nextPlain.action };
  if (!roads.quiet) return { title: roads.text.replace(/\s+\d+ more\.$/, ""), sub: "The rest of the island looks ordinary." };
  return { title: `Here's what's on ${island} today.`, sub: "Nothing urgent. Roads and weather are below." };
}

/** The agency's own text, only when the plain headline did not already say it. */
export function officialExtra(item: Item, headline: string): string | undefined {
  const body = item.body?.trim();
  if (body && !headline.includes(body.slice(0, 40))) return body;
  const title = item.title?.trim();
  if (title && title !== headline && !headline.includes(title) && !title.includes(headline.slice(0, 24))) return title;
  return undefined;
}

/** One row per topic. `quiet` rows collapse into the "Also today" grid; loud ones get their own card. */
export function topicRows(
  items: Item[],
  plain: Map<string, Plain>,
  island: Exclude<Island, "state">,
  now: number,
  /** undefined = the storms file did not load. Never say "none" for a file we never read. */
  stormTexts: string[] | undefined,
  tsunamiAbove: boolean,
  quakeText?: string,
): Row[] {
  const of = (f: (i: Item) => boolean) => items.filter((i) => i.tier !== "community" && f(i));
  const roads = of((i) => i.type === "road_closure" && i.source !== "hdot");
  const traffic = of((i) => i.type === "traffic");
  const roadwork = of((i) => i.source === "hdot").length;
  const community = items.filter((i) => i.tier === "community");
  const quakes = of((i) => i.type === "quake");
  const volcano = of((i) => i.type === "volcano");
  const tsunami = of((i) => i.type === "tsunami");

  let roadsText = "No crashes or closures reported.";
  if (roads.length || traffic.length) {
    const first = plain.get((roads[0] ?? traffic[0]).key)!.headline;
    const more = roads.length + traffic.length - 1;
    roadsText = `${first}.${more ? ` ${more} more.` : ""}`;
  } else if (roadwork) roadsText = `No crashes or closures reported. ${plural(roadwork, "roadwork site")} today.`;

  // Fallback when the quake file has not loaded: the island snapshot only keeps 3 days, so say less rather than wrong.
  if (!quakeText) {
    const biggest = quakes.reduce<Item | undefined>((a, b) => (!a || Number(b.fields?.mag) > Number(a.fields?.mag) ? b : a), undefined);
    const mag = Number(biggest?.fields?.mag) || 0;
    quakeText = biggest && mag >= 3 ? `A ${mag.toFixed(1)} near ${/\bof\s+([^,]+)/.exec(biggest.title)?.[1]?.trim() ?? "here"} ${fmtClock(biggest.issuedAt, now)}. No tsunami.` : "Nothing big in the last few days.";
  }

  // Quiet when nothing is going on, not when the feed is silent: HVO publishes a status every day,
  // and "Kīlauea is quiet" (level 0) is a tile line, never a card of its own.
  const volcanoQuiet = !volcano.some((v) => (plain.get(v.key)?.level ?? 0) >= 1);
  const volcanoText = volcanoQuiet ? "Kīlauea is taking a rest." : volcano.map((v) => plain.get(v.key)!.headline).join(". ") + ".";
  // A watch is level 2, and it used to leave this row quiet and printing "The ocean is fine." while one was
  // in effect. Level 0 is the "no danger for Hawaiʻi" record, so anything above it speaks for itself.
  const worstTsunami = tsunami.slice().sort((a, b) => plain.get(b.key)!.level - plain.get(a.key)!.level)[0];
  const tsunamiHot = !!worstTsunami && plain.get(worstTsunami.key)!.level >= 2;
  const tsunamiText = tsunamiAbove ? "See the warning above." : tsunamiHot ? plain.get(worstTsunami.key)!.headline : "The ocean is fine.";
  const neighborsText = community.length ? `${plural(community.length, "report")} today. Latest: ${plain.get(community[0].key)!.headline}.` : "Nobody posted today.";

  const quakeQuiet = quakeText.startsWith("Nothing big") || (!/\b\d\.\d\b/.test(quakeText) && !/shook|felt/i.test(quakeText));

  const rows: Row[] = [
    { key: "roads", label: "Roads", text: roadsText, href: "/traffic/", quiet: !(roads.length || traffic.length) },
    // A named storm in the basin is worth a card even when it is not coming here. People track them for days
    // before they matter, and "not expected to come near" is the answer they are looking for, not a reason to hide it.
    // An unread file is never an all-clear: on one bar during a storm, "None near Hawaiʻi" was the worst possible lie.
    { key: "storms", label: "Storms", href: "/storms/",
      text: !stormTexts ? "Storm list did not load. Tap to try again." : stormTexts.length ? stormTexts.join(" ") : "None near Hawaiʻi.",
      quiet: !!stormTexts && stormTexts.length === 0 },
    { key: "quakes", label: "Earthquakes", text: quakeText, href: "/quakes/", quiet: quakeQuiet },
    { key: "volcano", label: "Volcano", text: volcanoText, href: "/volcano/", quiet: volcanoQuiet },
    { key: "tsunami", label: "Tsunami", text: tsunamiText, href: "/tsunami/", quiet: !tsunamiHot && !tsunamiAbove },
  ];
  if (island === "hawaii") {
    rows.push({ key: "neighbors", label: "Reports", text: neighborsText, href: "/report/", quiet: community.length === 0 });
  }
  return rows;
}
