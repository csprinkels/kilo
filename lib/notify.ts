// What a warning says on the lock screen. Pure, so tests/notify.test.ts can pin the words.
//
// The lock screen gives a title of about one line and a body of about three. The agency's own text
// does not fit that ("* LOCATIONS AFFECTED - Kamuela - Hawi - Honokaa * WIND - LATEST LOCAL…"),
// and its zone names are forecast zones nobody uses ("Big Island North"). So:
//   title — an emoji for the kind of thing, then what is happening, in the app's plain words.
//   body  — where, as the towns people know, then what to do, then until when.
// The agency's full text still rides in the web payload's digest and is one tap away in the app.
import type { Island, Item, ItemType } from "./types.ts";
import { placeOf, plainAlert } from "./plain.ts";
import { islandName } from "./brand.ts";

export type PushText = { title: string; body: string; kind: string };

/** An emoji per kind of thing. NWS events are matched first, by the words in the event's name. */
const EVENT_EMOJI: [RegExp, string][] = [
  [/hurricane|tropical storm|tropical cyclone/i, "🌀"],
  [/tsunami/i, "🌊"],
  [/flash flood|flood/i, "🌧️"],
  [/surf|marine|small craft|rip current/i, "🌊"],
  [/wind/i, "💨"],
  [/red flag|fire/i, "🔥"],
  [/heat/i, "🥵"],
  [/thunder|lightning/i, "⛈️"],
  [/winter|snow|ice/i, "❄️"],
];
const TYPE_EMOJI: Partial<Record<ItemType, string>> = {
  shelter: "🏠", evac: "🚨", tsunami: "🌊", storm: "🌀", quake: "🫨", volcano: "🌋",
  road_closure: "🚧", traffic: "🚗", school: "🏫", outage: "⚡", hazard: "⚠️", advisory: "⚠️", notice: "📣",
};
const emojiFor = (i: Item) => {
  const ev = i.fields?.event ?? "";
  if (ev) for (const [re, e] of EVENT_EMOJI) if (re.test(ev)) return e;
  if (i.type === "outage" && i.fields?.kind) return "💧"; // water notices, not power
  return TYPE_EMOJI[i.type] ?? "⚠️";
};

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const dot = (s: string) => (!s || /[.!?]$/.test(s) ? s : `${s}.`);
const listWords = (xs: string[]) => (xs.length < 2 ? xs[0] ?? "" : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

/** "* LOCATIONS AFFECTED - Kamuela - Hawi - Honokaa *" → ["Kamuela", "Hawi", "Honokaa"]. */
export function townsOf(i: Item): string[] {
  const m = /LOCATIONS AFFECTED\s*-\s*([\s\S]*?)(?:\*|\n\n|$)/i.exec(i.body ?? "");
  if (!m) return [];
  return m[1].split(/\s+-\s+/).map((t) => t.replace(/\s+/g, " ").trim()).filter((t) => t && t.length <= 30);
}

/** Things of one kind that the agency sent as separate items, one per zone: say them once. */
const kindOf = (i: Item) =>
  i.fields?.event ? `${i.type}|${i.fields.event}`
  : i.type === "school" ? "school"
  : i.type === "shelter" ? `shelter|${(i.status ?? "").toLowerCase()}`
  : i.key;

/**
 * The lock-screen words for `trigger`, given everything else on the island right now. Siblings of
 * the same kind (the other zones of one Hurricane Watch) are folded in, so the towns cover all of
 * them and the notification replaces, rather than stacks on, the one before it.
 */
export function pushText(trigger: Item, items: Item[], island: Exclude<Island, "state">, now: number): PushText {
  const p = plainAlert(trigger, now, island);
  const kind = kindOf(trigger);
  const siblings = items.filter((i) => kindOf(i) === kind);
  const all = siblings.some((i) => i.key === trigger.key) ? siblings : [trigger, ...siblings];
  const emoji = emojiFor(trigger);

  if (trigger.type === "shelter") {
    const city = trigger.fields?.city?.trim();
    const name = trigger.title.replace(/^Shelter\s+\w+:\s*/i, "").trim();
    const where = [name, trigger.fields?.address?.trim()].filter(Boolean).join(", ");
    return { kind, title: `${emoji} ${p.word ?? "Shelter open"}${city ? ` in ${city}` : ""}`, body: [dot(where), p.action].filter(Boolean).join(" ") };
  }
  if (trigger.type === "school") {
    const n = all.length;
    return { kind, title: `${emoji} ${n > 1 ? `${n} schools closed` : "School closed"}`, body: [dot(n > 1 ? `Including ${trigger.title.replace(/^Schools?\s+closed:\s*/i, "")}` : trigger.title.replace(/^Schools?\s+closed:\s*/i, "")), p.action].filter(Boolean).join(" ") };
  }

  // Anything that is not a weather event keeps its whole headline: a road closure's place IS the news.
  if (!trigger.fields?.event) return { kind, title: `${emoji} ${cap(p.headline)}`, body: p.action || "Open Kilo for the details." };

  // What is happening: the plain headline without its forecast-zone place, which the body says better.
  const place = placeOf(trigger, island);
  const what = cap(p.headline.replace(place, "").replace(/\s{2,}/g, " ").trim()) || cap(p.headline);

  // Where: the towns the agency listed across every zone, else the plain place, else the island.
  const towns = [...new Set(all.flatMap(townsOf))];
  const where = towns.length > 4 ? `${towns.slice(0, 3).join(", ")} and ${towns.length - 3} more places`
    : towns.length ? listWords(towns)
    : all.length > 1 ? `Across ${islandName(island)}`
    : cap(place.replace(/^(in|on)\s+/, ""));

  const until = p.until && !what.includes(p.until) ? cap(p.until) : "";
  return { kind, title: `${emoji} ${what}`, body: [dot(where), p.action, dot(until)].filter(Boolean).join(" ") };
}
