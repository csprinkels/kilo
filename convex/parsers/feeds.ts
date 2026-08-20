import { XMLParser } from "fast-xml-parser";
import { clip, hashOf, type Island, type Item } from "../../lib/types.ts";

const DAY = 86_400_000;
const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", cdataPropName: "__cdata", textNodeName: "#text" });
const text = (v: unknown): string =>
  v == null ? "" : typeof v === "object" ? text((v as Record<string, unknown>)["__cdata"] ?? (v as Record<string, unknown>)["#text"] ?? Object.values(v as object).map(text).join(" ")) : String(v);
const stripHtml = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/&#8230;|&hellip;/g, "…").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\[…\]/g, "").trim();
const asArray = <T,>(v: T | T[] | undefined): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);

// ---------- USGS earthquakes (Hawaiʻi bbox, M2.5+, newest 20) ----------
export const USGS_URL =
  "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minlatitude=18.5&maxlatitude=22.5&minlongitude=-160.8&maxlongitude=-154.5&minmagnitude=2.5&orderby=time&limit=20";

type Quake = { id: string; geometry: { coordinates: [number, number, number] }; properties: { mag: number; place: string; time: number; url: string; title: string; tsunami: number } };
export function parseUsgs(json: { features: Quake[] }, now = Date.now()): Item[] {
  return (json.features ?? [])
    .filter((f) => now - f.properties.time < 3 * DAY)
    .map(({ id, geometry: { coordinates: [lon, lat, depth] }, properties: p }) => ({
      key: `usgs:${id}`, source: "usgs", type: "quake" as const, tier: "official" as const,
      sev: (p.mag >= 5 ? 3 : p.mag >= 4 ? 2 : 1) as Item["sev"],
      islands: [islandFromLatLon(lat, lon)], districts: [],
      title: clip(p.title, 120),
      body: clip(`Depth ${Math.round(depth)} km. ${p.tsunami ? "Tsunami evaluation issued — see PTWC." : "No tsunami expected from a quake this size."}`, 600),
      srcUrl: p.url, lat, lon,
      fields: { mag: p.mag.toFixed(1) },
      issuedAt: p.time, lastConfirmedAt: now, expiresAt: p.time + 3 * DAY,
      hash: hashOf(p.mag, p.place, p.time),
    }));
}
function islandFromLatLon(lat: number, lon: number): Island {
  if (lon > -156.2 && lat < 20.4) return "hawaii";
  if (lon > -157.5 && lat < 21.4) return "maui";
  if (lon > -158.4) return "oahu";
  return "kauai";
}

// ---------- USGS HVO elevated volcanoes ----------
export const HVO_URL = "https://volcanoes.usgs.gov/hans-public/api/volcano/getElevatedVolcanoes";
type Volcano = { obs_abbr: string; volcano_name: string; vnum: string; color_code: string; alert_level: string; notice_url: string; sent_unixtime: string; notice_identifier: string };
const COLOR_SEV: Record<string, Item["sev"]> = { RED: 4, ORANGE: 3, YELLOW: 1 };
export function parseHvo(json: Volcano[], now = Date.now()): Item[] {
  return (json ?? [])
    .filter((v) => v.obs_abbr === "hvo" && COLOR_SEV[v.color_code])
    .map((v) => ({
      key: `hvo:${v.vnum}`, source: "hvo", type: "volcano" as const, tier: "official" as const,
      sev: COLOR_SEV[v.color_code],
      islands: ["hawaii" as const], districts: [],
      title: clip(`${v.volcano_name.replace("Kilauea", "Kīlauea")}: ${v.alert_level} / ${v.color_code}`, 120),
      body: clip(`USGS Hawaiian Volcano Observatory alert level ${v.alert_level}, aviation color code ${v.color_code}. Latest notice ${new Date(Number(v.sent_unixtime) * 1000).toLocaleString("en-US", { timeZone: "Pacific/Honolulu" })} HST.`, 600),
      srcUrl: v.notice_url,
      fields: { alertLevel: v.alert_level, colorCode: v.color_code, notice: v.notice_identifier },
      issuedAt: Number(v.sent_unixtime) * 1000, lastConfirmedAt: now,
      hash: hashOf(v.alert_level, v.color_code, v.notice_identifier),
    }));
}

// ---------- HDOT lane closures in effect now (statewide, planned work) ----------
const HDOT_WHERE = encodeURIComponent("Active=1 AND beginDate <= CURRENT_TIMESTAMP AND enDate >= CURRENT_TIMESTAMP");
export const HDOT_URL = `https://services.arcgis.com/HQ0xoN0EzDPBOEci/arcgis/rest/services/Lane_Closure_WFL1_View_NoEd/FeatureServer/0/query?where=${HDOT_WHERE}&outFields=*&outSR=4326&f=geojson`;
const HDOT_ISLAND: Record<string, Island> = { Oahu: "oahu", Hawaii: "hawaii", Maui: "maui", Molokai: "maui", Lanai: "maui", Kauai: "kauai" };
type Lane = { geometry: { coordinates: unknown } | null; properties: Record<string, string | number | null> };
export function parseHdot(json: { features: Lane[] }, now = Date.now()): Item[] {
  const seen = new Set<string>();
  const out: Item[] = [];
  for (const { geometry, properties: p } of json.features ?? []) {
    const road = String(p.RoadName || (p.Route ? `Route ${p.Route}` : "State highway"));
    const island = HDOT_ISLAND[String(p.Island)] ?? "state";
    // One project is published as many segments/days; collapse to one card per road + span + hours.
    const id = hashOf(island, road, p.IntersFrom, p.IntersTo, p.ClosHours, p.CloseFact, p.direct);
    if (seen.has(id)) continue;
    seen.add(id);
    let c: unknown = geometry?.coordinates;
    while (Array.isArray(c) && Array.isArray(c[0])) c = c[0];
    const [lon, lat] = Array.isArray(c) ? (c as number[]) : [undefined, undefined];
    out.push({
      key: `hdot:${id}`, source: "hdot", type: "road_closure", tier: "official",
      sev: 1,
      islands: [island], districts: [],
      status: `${p.CloseFact ?? "Lane"} closure`,
      title: clip(`${road}: ${String(p.CloseFact ?? "lane").toLowerCase()} closure, ${String(p.ClosHours ?? "").toLowerCase() || "scheduled"}${p.direct ? ` (${p.direct})` : ""}`, 120),
      body: clip([p.IntersFrom && p.IntersTo && `${p.IntersFrom} → ${p.IntersTo}`, p.ClosReason, p.Remarks].filter(Boolean).join(". "), 600),
      srcUrl: "https://experience.arcgis.com/experience/397fed5aafdb4f25b73e342ef35f2ec5",
      lat, lon,
      fields: { reason: String(p.ClosReason ?? ""), hours: String(p.ClosHours ?? "") },
      issuedAt: Number(p.beginDate) || now, lastConfirmedAt: now,
      expiresAt: Number(p.enDate) || undefined,
      hash: hashOf(p.CloseFact, p.ClosHours, p.enDate, p.Remarks),
    });
  }
  return out;
}

// ---------- WordPress RSS feeds (HI-EMA, Hawaiʻi Police Department) ----------
type WpOpts = { source: string; islands: Island[]; maxAgeDays: number; sev?: (title: string, body: string) => Item["sev"]; districts?: (t: string) => string[] };
export function parseWordPress(rss: string, o: WpOpts, now = Date.now()): Item[] {
  const doc = xml.parse(rss);
  return asArray<Record<string, unknown>>(doc?.rss?.channel?.item)
    .map((it) => ({ it, at: Date.parse(text(it.pubDate)) }))
    .filter(({ at }) => Number.isFinite(at) && now - at < o.maxAgeDays * DAY)
    .map(({ it, at }) => {
      const link = text(it.link), title = clip(text(it.title), 120), body = clip(stripHtml(text(it.description)), 600);
      return {
        key: `${o.source}:${text(it.guid) || link}`, source: o.source, type: "notice" as const, tier: "official" as const,
        sev: o.sev?.(title, body) ?? (2 as const), islands: o.islands, districts: o.districts?.(`${title} ${body}`) ?? [],
        title, body, srcUrl: link,
        fields: { category: asArray(it.category).map(text).join(", ") },
        issuedAt: at, lastConfirmedAt: now, expiresAt: at + o.maxAgeDays * DAY,
        hash: hashOf(title, body),
      };
    });
}

export const HIEMA_URL = "https://dod.hawaii.gov/hiema/feed/";
export const parseHiema = (rss: string, now = Date.now()) => parseWordPress(rss, { source: "hiema", islands: ["state"], maxAgeDays: 14 }, now);

// Hawaiʻi Police Department media releases: after-the-fact mostly, but also "911 non-operational", road closures, crashes.
export const HPD_URL = "https://www.hawaiipolice.gov/feed/";
const HPD_SEV = (title: string, body: string): Item["sev"] => {
  const t = `${title} ${body}`;
  if (/\b911\b.*(non.?operational|not working|outage|down)|tsunami|evacuat|shelter in place|active shooter/i.test(t)) return 3;
  if (/crash|collision|closed|closure|roadway|highway|traffic|signal|stoplight|missing|runaway|flood|fire|hazmat|checkpoint/i.test(t)) return 2;
  return 1;
};
export const parseHpd = (rss: string, now = Date.now(), districts?: (t: string) => string[]) =>
  parseWordPress(rss, { source: "hpd", islands: ["hawaii"], maxAgeDays: 3, sev: HPD_SEV, districts }, now);

// ---------- PTWC tsunami bulletins (Atom) ----------
export const PTWC_URL = "https://www.tsunami.gov/events/xml/PHEBAtom.xml";
const PTWC_SEV: Record<string, Item["sev"]> = { Warning: 4, Watch: 3, Advisory: 3, Threat: 3, Information: 1 };
export function parsePtwc(atom: string, now = Date.now()): Item[] {
  const doc = xml.parse(atom);
  const feedTitle = text(doc?.feed?.title).trim();
  return asArray<Record<string, unknown>>(doc?.feed?.entry)
    .map((e) => ({ e, at: Date.parse(text(e.updated)) }))
    .filter(({ at }) => Number.isFinite(at) && now - at < DAY)
    .map(({ e, at }) => {
      const summary = stripHtml(text(e.summary));
      const category = /Category:\s*(\w+)/.exec(summary)?.[1] ?? "Information";
      const links = asArray<Record<string, string>>(e.link as never);
      const bulletin = links.find((l) => l["@_rel"] === "alternate")?.["@_href"] ?? "https://www.tsunami.gov/";
      const lat = Number(e["geo:lat"]), lon = Number(e["geo:long"]);
      return {
        key: `ptwc:${text(e.id)}`, source: "ptwc", type: "tsunami" as const, tier: "official" as const,
        sev: PTWC_SEV[category] ?? 3,
        islands: ["state" as const], districts: [],
        title: clip(`${feedTitle || "Tsunami bulletin"}: ${text(e.title).trim()}`, 120),
        body: clip(summary.replace(/View bulletin.*$/, ""), 600),
        srcUrl: bulletin,
        lat: Number.isFinite(lat) ? lat : undefined, lon: Number.isFinite(lon) ? lon : undefined,
        fields: { category },
        issuedAt: at, lastConfirmedAt: now, expiresAt: at + DAY,
        hash: hashOf(feedTitle, text(e.title), summary),
      };
    });
}
