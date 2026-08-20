// Plain language for every item: what is happening, what to do, how urgent — never what the agency called it.
// The official wording stays in item.title/body and is shown only behind "Official wording".
// Rules: ≤ 20 words a sentence, 6th-grade words, clock times only, no acronyms, never invent a fact the feed didn't give.
import type { Island, Item } from "./types.ts";
import { ISLAND_LABEL, fmtDateTime, fmtDayTime, fmtTime } from "./brand.ts";
import type { Quake, Quakes } from "./pages.ts";
import { bearingDeg, distanceNm, ktToMph, nmToMi, outlookFor, type Storm } from "./storm.ts";

export type Level = 0 | 1 | 2 | 3 | 4;
export const LEVEL_WORD: Record<number, string> = { 4: "Act now", 3: "Get ready", 2: "Heads up" };

export type Plain = {
  headline: string;   // "Roads may flood in Puna until 9 PM"
  action: string;     // "Do not drive through water on the road." ("" when there is nothing to do)
  level: Level;       // 0 = not worth a row; 4 = life-safety
  word?: string;      // replaces the level word when a kind has a better one ("Shelter open")
  until?: string;     // "until 9 PM"
  source: string;     // "the National Weather Service"
  official: string;   // the agency's own title, for the disclosure
};

export const SOURCE_NAME: Record<string, string> = {
  nws: "the National Weather Service", hccda: "Hawaiʻi County Civil Defense", hdot: "the state highways department",
  hiema: "the state emergency agency", hpd: "Hawaiʻi Police", hnl: "Honolulu 911 dispatch", usgs: "the USGS",
  hvo: "the USGS Hawaiian Volcano Observatory", ptwc: "the Pacific Tsunami Warning Center", cphc: "the Central Pacific Hurricane Center",
  community: "a neighbor", digest: "your last notification",
};
export const sourceName = (source: string) => SOURCE_NAME[source.split(":")[0]] ?? "an official source";

const HST = "Pacific/Honolulu";
const dayKey = (ms: number) => new Intl.DateTimeFormat("en-US", { timeZone: HST, weekday: "short", day: "numeric" }).format(ms);
const clock = (ms: number) => new Intl.DateTimeFormat("en-US", { timeZone: HST, hour: "numeric", minute: "2-digit" }).format(ms).replace(":00", "");
const weekday = (ms: number) => new Intl.DateTimeFormat("en-US", { timeZone: HST, weekday: "long" }).format(ms);

/** "until 9 PM" today; "until Thursday 9 PM" later; nothing if unknown or already past. */
export function fmtUntil(ms: number | undefined, now = Date.now()): string | undefined {
  if (!ms || ms <= now) return undefined;
  if (dayKey(ms) === dayKey(now)) return `until ${clock(ms)}`;
  if (dayKey(ms) === dayKey(now + 86_400_000)) return `until tomorrow ${clock(ms)}`;
  return `until ${weekday(ms)} ${clock(ms)}`;
}

/** How it felt, by magnitude (USGS "Did You Feel It" words); magnitude itself is for the official line. */
export function shakingWord(mag: number): string {
  return mag < 3 ? "Small" : mag < 3.5 ? "Weak" : mag < 4.5 ? "Light" : mag < 5.5 ? "Moderate" : mag < 6.5 ? "Strong" : "Very strong";
}
export const shakingVerb = (mag: number) => (mag < 3.5 ? "was barely felt" : mag < 4.5 ? "shook lightly" : mag < 5.5 ? "shook" : "shook hard");

/** Where, in words people say: "in Puna" (district or a short NWS area name) or "on Oʻahu" (whole island). */
export function placeOf(item: Item, island?: Island): string {
  if (item.districts[0]) return `in ${item.districts[0]}`;
  const area = item.fields?.areaDesc?.trim();
  if (area && !/[;,]/.test(area) && area.length <= 30 && !/^(Oahu|Maui|Kauai|Hawaii|Niihau|Molokai|Lanai)$/i.test(area)) return `${/summit|mountain|slope|shore|coast|side|windward|leeward/i.test(area) ? "on" : "in"} ${area.replace(/^Big Island /, "")}`;
  const isl = island && island !== "state" ? island : item.islands.find((i) => i !== "state");
  return isl ? `on ${ISLAND_LABEL[isl].split(" · ")[0]}` : "in Hawaiʻi";
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const highway = (s: string) =>
  /highway/i.test(s) ? s.replace(/\b(Route|Rte\.?|Hwy\.?)\s*(\d+)/i, "$2") : s.replace(/\b(Route|Rte\.?|Hwy\.?|State Route|SR)\s*(H-?\d+|\d+)/i, (_, __, n: string) => (/^H/i.test(n) ? `the ${n.toUpperCase()}` : `Highway ${n}`));

// ---------- NWS events ----------
type T = (p: string, until: string) => string;
const NWS: Record<string, { h: T; a: string; level?: Level }> = {
  "Hurricane Warning": { h: (p) => `Hurricane expected ${p}`, a: "Finish getting ready today. If Civil Defense says leave, leave.", level: 4 },
  "Hurricane Watch": { h: (p) => `Hurricane possible ${p}`, a: "Get ready now. Know where you would go.", level: 3 },
  "Tropical Storm Warning": { h: (p) => `Strong winds expected ${p}`, a: "Bring in anything loose. Charge your phone. Stay off the roads once the wind starts.", level: 3 },
  "Tropical Storm Watch": { h: (p) => `Strong winds possible ${p}`, a: "Bring in anything loose. Charge your phone.", level: 2 },
  "Tropical Cyclone Local Statement": { h: (p) => `Storm update ${p}`, a: "", level: 1 },
  "Flash Flood Warning": { h: (p, u) => `Flooding now ${p} ${u}`.trim(), a: "Do not drive through water. Move to higher ground if water is rising.", level: 4 },
  "Flash Flood Watch": { h: (p) => `Heavy rain could flood roads ${p}`, a: "Do not drive through water on the road.", level: 2 },
  "Flood Watch": { h: (p) => `Heavy rain could flood roads ${p}`, a: "Do not drive through water on the road.", level: 2 },
  "Flood Advisory": { h: (p, u) => `Roads may flood ${p} ${u}`.trim(), a: "Do not drive through water on the road.", level: 2 },
  "Flood Warning": { h: (p, u) => `Flooding ${p} ${u}`.trim(), a: "Do not drive through water. Stay away from streams.", level: 3 },
  "High Wind Warning": { h: (p, u) => `Dangerous wind ${p} ${u}`.trim(), a: "Stay away from trees and power lines. Stay inside when it is worst.", level: 3 },
  "Wind Advisory": { h: (p, u) => `Strong wind ${p} ${u}`.trim(), a: "Tie down anything loose. Drive carefully in tall vehicles.", level: 2 },
  "High Surf Warning": { h: (p, u) => `Very dangerous waves ${p} ${u}`.trim(), a: "Stay off the rocks and out of the water there.", level: 3 },
  "High Surf Advisory": { h: (p, u) => `Big waves ${p} ${u}`.trim(), a: "Stay off the rocks and out of the water there.", level: 2 },
  "Red Flag Warning": { h: (p) => `Fire danger ${p}`, a: "No outdoor burning. Report smoke right away.", level: 3 },
  "Heat Advisory": { h: (p) => `Dangerous heat ${p}`, a: "Drink water. Check on kūpuna and pets.", level: 2 },
  "Excessive Heat Warning": { h: (p) => `Dangerous heat ${p}`, a: "Drink water. Stay in the shade or inside. Check on kūpuna and pets.", level: 3 },
  "Brown Water Advisory": { h: (p) => `Dirty water at beaches ${p}`, a: "Stay out of brown water near stream mouths.", level: 2 },
  "Winter Weather Advisory": { h: () => "Snow and ice on the summits", a: "Summit roads may close.", level: 1 },
  "Winter Storm Warning": { h: () => "Heavy snow and ice on the summits", a: "Summit roads will close.", level: 1 },
  "Small Craft Advisory": { h: () => "Rough seas for small boats", a: "", level: 1 },
  "Gale Warning": { h: () => "Dangerous seas for boats", a: "Stay in port.", level: 1 },
  "Tsunami Warning": { h: () => "Tsunami warning", a: "Leave the evacuation zone now. Go inland or to the 4th floor or higher.", level: 4 },
  "Tsunami Advisory": { h: () => "Dangerous waves at the shore", a: "Stay out of the water and off the beach.", level: 3 },
  "Tsunami Watch": { h: () => "A tsunami may be coming", a: "Get ready to leave the coast. Keep your phone on.", level: 2 },
  "Special Weather Statement": { h: (p) => `Weather note ${p}`, a: "", level: 1 },
};

// ---------- per type ----------
function nws(item: Item, now: number, island?: Island): Plain | undefined {
  const ev = item.fields?.event;
  const t = ev ? NWS[ev] : undefined;
  if (!t) return undefined;
  const until = fmtUntil(item.expiresAt, now);
  return { headline: t.h(placeOf(item, island), until ?? ""), action: t.a, level: t.level ?? item.sev, until, source: sourceName(item.source), official: item.title };
}

function shelter(item: Item): Plain {
  const name = item.title.replace(/^Shelter\s+\w+:\s*/i, "");
  const st = (item.status ?? "").toLowerCase();
  const pets = /yes|pet|allowed/i.test(item.fields?.animals ?? "") ? " Pets are allowed." : " Pets only if it says pet-friendly.";
  if (/full/.test(st)) return { headline: `${name} is full`, action: "Go to another shelter. Civil Defense lists the open ones.", level: 3, word: "Shelter full", source: sourceName(item.source), official: item.title };
  if (/clos/.test(st)) return { headline: `${name} is closed`, action: "", level: 1, word: "Shelter closed", source: sourceName(item.source), official: item.title };
  return { headline: `${name} is open`, action: `Bring medicine, ID, food and bedding.${pets}`, level: 3, word: "Shelter open", source: sourceName(item.source), official: item.title };
}

function school(item: Item, now: number): Plain {
  const name = item.title.replace(/^Schools?\s+closed:\s*/i, "");
  const until = fmtUntil(item.expiresAt, now);
  return { headline: `${name} is closed${until ? " " + until : ""}`, action: "Keep kids home.", level: 2, until, source: sourceName(item.source), official: item.title };
}

function road(item: Item, now: number): Plain {
  const src = item.source.split(":")[0];
  const until = fmtUntil(item.expiresAt, now);
  if (src === "hdot") {
    const route = highway(item.title.split(":")[0].replace(/_.*$/, "").trim());
    const what = /shoulder/i.test(item.title) ? "Shoulder closed" : /ramp/i.test(item.title) ? "Ramp closed" : /road closure/i.test(item.title) ? "Road closed" : "One lane";
    const near = item.body.split("→")[0].split(".")[0].trim();
    // HDOT gives a category, not a clock: Overnight / Daily / 24Hrs. Say the usual window and whether that is now.
    const hours = (item.fields?.hours ?? "").toLowerCase();
    const hstHour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Pacific/Honolulu", hour: "numeric", hour12: false }).format(now)) % 24;
    const weekday = !/Sat|Sun/.test(new Intl.DateTimeFormat("en-US", { timeZone: "Pacific/Honolulu", weekday: "short" }).format(now));
    const win = hours.includes("overnight") ? { text: "Overnight work, usually after 7 PM.", on: hstHour >= 19 || hstHour < 5 }
      : hours.includes("daily") || hours.includes("day") ? { text: "Daytime work, usually 8:30 AM to 3:30 PM on weekdays.", on: weekday && hstHour >= 8 && hstHour < 16 }
      : hours.includes("24") ? { text: "Around the clock.", on: true } : { text: "", on: false };
    const base = what === "Road closed" ? "Find another way." : "Expect a wait.";
    const action = win.text ? `${win.text} ${win.on ? base.replace(".", " right now.") : "Probably clear right now."}` : base;
    return { headline: `${what} on ${route}${near ? ` near ${near}` : ""}`, action, level: 1, until, source: sourceName(item.source), official: item.title };
  }
  if (item.tier === "community") {
    const kind = item.status === "road_flooded" || /flood/i.test(item.title) ? "Road flooded" : "Road blocked";
    return { headline: `${kind} near ${item.title.split("—").pop()?.trim() || placeOf(item)}`, action: "Not checked by anyone official. Check before you go.", level: Math.min(item.sev, 2) as Level, source: sourceName(item.source), official: item.title };
  }
  const [roadName] = item.title.split(" — ");
  const st = (item.status ?? "").toLowerCase();
  const place = item.districts[0] ? ` in ${item.districts[0]}` : "";
  const src2 = sourceName(item.source);
  if (/alternate|detour/.test(st)) return { headline: `${highway(roadName)} is open as a detour${place}`, action: "", level: 1, until, source: src2, official: item.title };
  if (/other/.test(st)) {
    const why = item.body.split(/[.;]/)[0].trim().toLowerCase();
    const useful = why.split(" ").length >= 3 && !/^(mm|mile|mp)\b/.test(why);
    return { headline: `${highway(roadName)}${place}: ${useful ? why : "check before you go"}`, action: "", level: Math.min(item.sev, 2) as Level, until, source: src2, official: item.title };
  }
  const how = /both/.test(st) ? "closed both ways" : /one lane|partial/.test(st) ? "down to one lane" : /open/.test(st) && !/clos/.test(st) ? "open again" : "closed";
  const alt = item.fields?.alternate?.trim().replace(/\s+/g, " ");
  const detour = !alt ? "No way around listed yet." : alt.split(" ").length <= 4 ? `Use ${highway(alt)} instead.` : `Detour: ${cap(alt.toLowerCase())}.`;
  return {
    headline: `${highway(roadName)} ${how}${place}`,
    action: how === "open again" ? "" : detour,
    level: how === "open again" ? 1 : (item.sev >= 3 ? 3 : 2),
    until, source: src2, official: item.title,
  };
}

function traffic(item: Item): Plain {
  const where = item.title.split(/:|—/).slice(1).join(" ").trim() || placeOf(item);
  const st = item.status ?? "";
  const community = item.tier === "community";
  const kind = /signal/.test(st) ? "Traffic light out" : /crash/.test(st) ? "Crash" : /stall|hazard/.test(st) ? "Stalled car" : "Traffic trouble";
  return {
    headline: `${kind} at ${where}`,
    action: community ? "Not checked by anyone official. Drive carefully." : /signal/.test(st) ? "Treat it as a four-way stop." : "Leave extra time or go another way.",
    level: Math.min(item.sev, 2) as Level, source: sourceName(item.source), official: item.title,
  };
}

function quake(item: Item): Plain {
  const mag = Number(item.fields?.mag) || Number(/M\s*([\d.]+)/.exec(item.title)?.[1]) || 0;
  const place = /\bof\s+([^,]+)/.exec(item.title)?.[1]?.trim() || placeOf(item);
  const head = mag < 3 ? `Small quake near ${place}` : `${shakingWord(mag)} shaking near ${place}`;
  return {
    headline: head,
    action: mag >= 6 ? "If it was hard to stand near the coast, go inland now." : mag >= 3 ? "No tsunami expected. Aftershocks are normal." : "",
    level: mag >= 6 ? 4 : mag >= 5 ? 2 : mag >= 3 ? 1 : 0,
    source: sourceName(item.source), official: item.title,
  };
}

function volcano(item: Item): Plain {
  const name = item.title.split(":")[0].trim();
  const lvl = (item.fields?.alertLevel ?? "").toUpperCase();
  const src = sourceName(item.source);
  if (lvl === "WARNING") return { headline: `${name}: dangerous eruption`, action: "Follow Civil Defense instructions now.", level: 4, source: src, official: item.title };
  if (lvl === "WATCH") return { headline: `${name} is active`, action: "Check the Volcano page for where and what it means.", level: 1, source: src, official: item.title };
  return { headline: `${name} is quiet`, action: "", level: 0, source: src, official: item.title };
}

function tsunami(item: Item, now: number): Plain {
  const t = item.title.toUpperCase();
  const src = sourceName(item.source);
  const until = fmtUntil(item.expiresAt, now);
  if (/WARNING/.test(t)) return { headline: "Tsunami warning", action: "Leave the evacuation zone now. Go inland or to the 4th floor or higher.", level: 4, until, source: src, official: item.title };
  if (/ADVISORY/.test(t)) return { headline: "Dangerous waves at the shore", action: "Stay out of the water and off the beach.", level: 3, until, source: src, official: item.title };
  if (/WATCH/.test(t)) return { headline: "A tsunami may be coming", action: "Get ready to leave the coast. Keep your phone on.", level: 2, until, source: src, official: item.title };
  return { headline: "An earthquake happened far away. No tsunami danger for Hawaiʻi.", action: "", level: 0, source: src, official: item.title };
}

/** The plain version of any item. Never throws; unknown shapes keep their own title and get the type's default action. */
export function plainAlert(item: Item, now = Date.now(), island?: Island): Plain {
  const src = sourceName(item.source);
  const fallback = (action: string, level: Level = item.sev): Plain => ({ headline: cap(item.title), action, level, until: fmtUntil(item.expiresAt, now), source: src, official: item.title });
  switch (item.type) {
    case "advisory": case "storm": return nws(item, now, island) ?? fallback("");
    case "tsunami": return item.source.startsWith("nws") ? (nws(item, now, island) ?? tsunami(item, now)) : tsunami(item, now);
    case "shelter": return shelter(item);
    case "school": return school(item, now);
    case "road_closure": return road(item, now);
    case "traffic": return traffic(item);
    case "quake": return quake(item);
    case "volcano": return volcano(item);
    case "evac": return { ...fallback("Follow Civil Defense. Take medicine and pets.", 4), headline: item.title.replace(/^Evacuation\s*(order)?:?\s*/i, (m) => (m ? "Leave now: " : "")) };
    case "outage":
      if (item.tier === "community") return { ...fallback("Not checked by anyone official.", Math.min(item.sev, 2) as Level), headline: `Power or water out near ${item.title.split("—").pop()?.trim() || placeOf(item)}` };
      return fallback("Keep fridges shut. Check on neighbors who use medical equipment.", 2);
    case "hazard": return fallback("Stay away from the area.", item.sev);
    case "notice":
      if (item.tier === "community") return { ...fallback("Not checked by anyone official.", Math.min(item.sev, 2) as Level), headline: item.title.replace(/^(Lost|Found)\b/i, (m) => `${m} pet:`).replace(/:\s*:/, ":") };
      return fallback("", Math.min(item.sev, 2) as Level);
    default: return fallback("");
  }
}

// ---------- earthquakes (shared by Now and the Earthquakes page so they never disagree) ----------
const MMI_WORD = ["", "", "Weak", "Weak", "Light", "Moderate", "Strong", "Very strong"];
const MMI_VERB: Record<string, string> = { Weak: "was barely felt", Light: "shook lightly", Moderate: "shook", Strong: "shook hard", "Very strong": "shook very hard" };
/** "16 km SSE of Honaunau-Napoopoo" → "Honaunau-Napoopoo". Never prints km or compass letters. */
export const quakePlace = (p: string) => /\bof\s+(.+)$/.exec(p)?.[1]?.trim() || p;
export const feltWord = (e: Quake) => (e.mmi ? MMI_WORD[Math.min(7, Math.max(2, Math.round(e.mmi)))] : shakingWord(e.m));
export const feltVerb = (e: Quake) => (e.mmi ? MMI_VERB[feltWord(e)] : shakingVerb(e.m));
/** The biggest quake people could feel this week, if any. */
export const heroQuake = (d: Quakes) => d.q.filter((e) => e.m >= 3).sort((a, b) => b.m - a.m || b.t - a.t)[0];
const DAY = 86_400_000;
export function quakeSentence(d: Quakes, now: number): string {
  const hero = heroQuake(d);
  if (!hero) {
    const n = d.q.length;
    if (!n) return "No earthquakes big enough to register this week.";
    return `Nothing big enough to feel this week. ${d.more ? "More than " : ""}${n} small quake${n === 1 ? "" : "s"}, which is normal for Kīlauea.`;
  }
  const at = hero.t * 1000, age = now - at;
  const head = `A ${hero.m.toFixed(1)} near ${quakePlace(hero.p)}`;
  const tail = hero.m >= 6 ? "If it was hard to stand near the coast, go uphill now." : age < 3_600_000 ? "No tsunami expected." : "No tsunami.";
  if (age < 3_600_000 && hero.m >= 4) return `${head} just shook, ${fmtTime(at)}. ${tail}`;
  const when = age > 6 * DAY ? `on ${fmtDateTime(at)}` : age > DAY ? `on ${new Intl.DateTimeFormat("en-US", { timeZone: "Pacific/Honolulu", weekday: "long" }).format(at)} at ${fmtTime(at)}` : `at ${fmtTime(at)}`;
  return `${head} ${feltVerb(hero)} ${when}. ${tail}`;
}

// ---------- storms ----------
const CLS: Record<string, string> = { HU: "Hurricane", TS: "Tropical Storm", TD: "Tropical Depression", PTC: "Potential Tropical Cyclone" };
const DIR = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];
export const dirWord = (deg: number) => DIR[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
export const stormName = (s: Storm) => `${CLS[s.cls] ?? ""} ${s.name}`.trim();

/** One sentence about a storm for one island: where it is, which way, whether it matters here. */
export function stormLine(s: Storm, place: { lat: number; lon: number; label: string }): { text: string; short: string; approaching: boolean; level: Level } {
  const o = outlookFor(s, place);
  const mi = nmToMi(distanceNm(s.lat, s.lon, place.lat, place.lon)).toLocaleString();
  const dir = dirWord(bearingDeg(place.lat, place.lon, s.lat, s.lon));
  const name = stormName(s);
  if (o.hurricaneWindsFrom) return { text: `${name}: damaging winds likely from ${fmtDayTime(o.hurricaneWindsFrom)}. Follow Civil Defense.`, short: `${s.name}: damaging winds likely from ${fmtDayTime(o.hurricaneWindsFrom)}.`, approaching: true, level: 4 };
  if (o.tsWindsFrom) return { text: `${name}: strong winds could start ${fmtDayTime(o.tsWindsFrom)}. Finish getting ready before then.`, short: `${s.name}: strong winds could start ${fmtDayTime(o.tsWindsFrom)}.`, approaching: true, level: 3 };
  if (o.movingAway) return { text: `${name} is ${mi} miles to the ${dir} and moving away.`, short: `${s.name} is moving away.`, approaching: false, level: 0 };
  return { text: `${name} is ${mi} miles to the ${dir}, heading this way. Closest ${fmtDayTime(o.closest.at)}. Too early to know if it will matter here.`, short: `${s.name} is ${mi} miles ${dir}, closest ${fmtDayTime(o.closest.at)}.`, approaching: true, level: 1 };
}
export const windsLine = (s: Storm) => `Winds around ${Math.round(ktToMph(s.windKt) / 5) * 5} mph`;

/**
 * When the agency last touched this record, and whether that is long enough ago to say "check before you go".
 * Only the county GIS carries an edit time; NWS/USGS records are events, not lists, so they are never "stale" this way.
 */
export function lastUpdated(item: Item, now = Date.now()): { at: number; stale: boolean } {
  const edited = Number(item.fields?.editDate) || 0;
  const at = edited > 0 && edited < now + 3_600_000 ? edited : item.issuedAt;
  const limit = item.type === "shelter" ? 12 * 3_600_000 : 24 * 3_600_000;
  return { at, stale: item.source.startsWith("hccda") && now - at > limit };
}
export const staleLine = (item: Item, now = Date.now()) => {
  const u = lastUpdated(item, now);
  return u.stale ? `Civil Defense has not updated this since ${fmtClockLong(u.at, now)}. Check before you go.` : undefined;
};
const fmtClockLong = (ms: number, now: number) => (now - ms > 6 * 86_400_000 ? fmtDateTime(ms) : new Intl.DateTimeFormat("en-US", { timeZone: "Pacific/Honolulu", weekday: "long", hour: "numeric", minute: "2-digit" }).format(ms));

/** One line for a community post: always says "Neighbor report" and never carries a level word. */
export const neighborLine = (item: Item) => `Neighbor report: ${plainAlert(item).headline}`;

/** Words that must never appear in anything a user reads (the test enforces this over every template). */
export const BANNED = [
  /\badvisory\b/i, /\bCat\.? ?\d/, /\bCategory\b/, /\bM\d\.\d/, /\bmagnitude\b/i, /\bAQI\b/, /PM2\.5/, /SO₂|SO2\b/, /\bppm\b/, /\bmb\b/, /\bkm\b/, /\bkt\b/,
  /\bHST\b/, /\bHVO\b/, /\bPTWC\b/, /HI-EMA/, /\bHDOT\b/, /\bNWS\b/, /\bsev\b/, /\bcyclone\b/i, /information statement/i, /\bunverified\b/i,
  /\bstale\b/i, /\breload\b/i, /\bbrowser\b/i, /\bserver\b/i, /\bKB\b/, /\b(NNE|ENE|ESE|SSE|SSW|WSW|WNW|NNW)\b/, /\b[NS][EW] of\b/, /\bago\b/, /\bNeighbour/,
];
