import { XMLParser } from "fast-xml-parser";
import { OAHU_AREAS } from "../../lib/oahuAreas.ts";
import { clip, hashOf, type Island, type Item } from "../../lib/types.ts";
import { geoJsonPath, simplifyPath } from "../../lib/roads.ts";
import { districtsFor } from "../../lib/places.ts";

const DAY = 86_400_000;
const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", cdataPropName: "__cdata", textNodeName: "#text" });
const text = (v: unknown): string =>
  v == null ? "" : typeof v === "object" ? text((v as Record<string, unknown>)["__cdata"] ?? (v as Record<string, unknown>)["#text"] ?? Object.values(v as object).map(text).join(" ")) : String(v);
const unent = (s: string) => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&amp;/g, "&");
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
type Lane = { geometry: { type: string; coordinates: unknown } | null; properties: Record<string, string | number | null> };
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
    const path = simplifyPath(geoJsonPath(geometry));
    const [lat, lon] = path[0] ?? [undefined, undefined];
    out.push({
      key: `hdot:${id}`, source: "hdot", type: "road_closure", tier: "official",
      sev: 1,
      islands: [island], districts: [],
      status: `${p.CloseFact ?? "Lane"} closure`,
      title: clip(`${road}: ${String(p.CloseFact ?? "lane").toLowerCase()} closure, ${String(p.ClosHours ?? "").toLowerCase() || "scheduled"}${p.direct ? ` (${p.direct})` : ""}`, 120),
      body: clip([p.IntersFrom && p.IntersTo && `${p.IntersFrom} → ${p.IntersTo}`, p.ClosReason, p.Remarks].filter(Boolean).join(". "), 600),
      srcUrl: "https://experience.arcgis.com/experience/397fed5aafdb4f25b73e342ef35f2ec5",
      lat, lon,
      ...(path.length >= 2 ? { path } : {}),
      fields: { reason: String(p.ClosReason ?? ""), hours: String(p.ClosHours ?? "") },
      issuedAt: Number(p.beginDate) || now, lastConfirmedAt: now,
      expiresAt: Number(p.enDate) || undefined,
      hash: hashOf(p.CloseFact, p.ClosHours, p.enDate, p.Remarks, String(path)),
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

// ---------- Hawaiʻi County Department of Water Supply (WordPress; boil-water, outages, conservation) ----------
// The county's only public water feed. We surface only notices we can classify with confidence; general
// updates, board news and "cancelled/restored" posts are dropped so a stale "boil your water" never lingers.
export const HIDWS_URL = "https://www.hawaiidws.org/feed/";
type DwsKind = "boil" | "off" | "prep" | "conserve";
const DWS_DAYS: Record<DwsKind, number> = { boil: 10, off: 10, prep: 4, conserve: 30 };
function dwsClassify(t: string): { kind: DwsKind; sev: Item["sev"] } | null {
  if (/\b(cancel|rescind|lift|no longer|downgraded to (a )?normal|fully restored|has ended|back to normal|is safe to drink)/i.test(t)) return null;
  if (/boil water/i.test(t)) return { kind: "boil", sev: 3 };
  if (/water (main break|outage)|water (is|are|now) (off|out|down)|no water|without water|shut ?off|service (is|has been) (interrupted|disrupted|cut)/i.test(t)) return { kind: "off", sev: 2 };
  if (/could be (interrupt|impact|disrupt)|service (could|may|will) be|prepare .*drinking water|plan for possible|ahead of .*storm/i.test(t)) return { kind: "prep", sev: 2 };
  if (/conservation|restriction|use less water|low water pressure/i.test(t)) return { kind: "conserve", sev: 1 };
  return null;
}
// One district when the notice clearly names one area; whole island when it spans several or names none.
const dwsDistricts = (t: string): string[] => { const ds = districtsFor(t); return ds.length === 1 ? ds : []; };
export function parseDws(rss: string, now = Date.now()): Item[] {
  const doc = xml.parse(rss);
  const out: Item[] = [];
  for (const it of asArray<Record<string, unknown>>(doc?.rss?.channel?.item)) {
    const at = Date.parse(text(it.pubDate));
    if (!Number.isFinite(at)) continue;
    const link = text(it.link), title = clip(unent(text(it.title)), 120), body = clip(unent(stripHtml(text(it.description))), 600);
    const cls = dwsClassify(title); // the title alone — a general update that only mentions boil water in its body is not a boil-water notice
    if (!cls || now - at > DWS_DAYS[cls.kind] * DAY) continue;
    out.push({
      key: `hidws:${text(it.guid) || link}`, source: "hidws", type: "outage" as const, tier: "official" as const,
      sev: cls.sev, islands: ["hawaii" as const], districts: dwsDistricts(`${title} ${body}`),
      title, body, srcUrl: link,
      fields: { kind: cls.kind },
      issuedAt: at, lastConfirmedAt: now, expiresAt: at + DWS_DAYS[cls.kind] * DAY,
      hash: hashOf(title, body),
    });
  }
  return out;
}

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

// ---------- Honolulu Police CAD traffic incidents (Socrata, last 24 h, ~5-min updates; address + area, no coordinates) ----------
export const HNL_TRAFFIC_URL = "https://data.honolulu.gov/resource/ykb6-n5th.json?$limit=300&$order=date%20DESC,time%20DESC";
type HnlRow = { date: string; time: string; type: string; address?: string; location?: string; area?: string };
const HNL_KIND: Record<string, { label: string; sev: Item["sev"]; status: string; ttlH: number } | undefined> = {
  "Traffic Control Device": { label: "Traffic signal problem", sev: 2, status: "signal", ttlH: 6 },
  "MVC": { label: "Crash", sev: 1, status: "crash", ttlH: 2 },
  "MVC Veh Towed": { label: "Crash, vehicle towed", sev: 1, status: "crash", ttlH: 2 },
  "Stalled/Hazard Veh": { label: "Stalled or hazardous vehicle", sev: 1, status: "hazard", ttlH: 1 },
  "Traffic Incident": { label: "Traffic incident", sev: 1, status: "incident", ttlH: 2 },
  // "Hazardous Driver" and "Traffic Complaint" are noise for a status board
};
export function parseHnlTraffic(rows: HnlRow[], now = Date.now()): Item[] {
  const out: Item[] = [];
  for (const r of rows ?? []) {
    const kind = HNL_KIND[r.type];
    if (!kind) continue;
    const at = hstToEpoch(r.date, r.time);
    if (!Number.isFinite(at) || now - at > kind.ttlH * 3_600_000) continue;
    const where = [r.address, r.location && r.location !== r.address ? `(${titleCase(r.location)})` : ""].filter(Boolean).join(" ");
    // Dispatch gives no coordinates; the neighborhood name does, roughly. fields.approx says so to the UI.
    const area = OAHU_AREAS[(r.area ?? "").trim()];
    out.push({
      key: `hnl:${hashOf(r.date, r.time, r.type, r.address)}`, source: "hnl", type: "traffic", tier: "official",
      sev: kind.sev, islands: ["oahu"], districts: r.area ? [r.area] : [],
      lat: area?.[0], lon: area?.[1],
      status: kind.status,
      title: clip(`${kind.label}: ${where || r.area || "Oʻahu"}`, 120),
      body: clip(`Reported to Honolulu 911 dispatch at ${new Date(at).toLocaleTimeString("en-US", { timeZone: "Pacific/Honolulu", hour: "numeric", minute: "2-digit" })}${r.area ? `, ${r.area} area` : ""}. Dispatch category: ${r.type}. Clears automatically.`, 600),
      srcUrl: "https://data.honolulu.gov/Public-Safety/Traffic-Incidents/ykb6-n5th",
      fields: { category: r.type, area: r.area ?? "", approx: area ? "area" : "" },
      issuedAt: at, lastConfirmedAt: now, expiresAt: at + kind.ttlH * 3_600_000,
      hash: hashOf(r.type, r.address, r.location, area ? "geo" : ""),
    });
  }
  return out;
}
function hstToEpoch(date: string, time: string) {
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(date), t = /(\d{1,2}):(\d{2}):(\d{2}) (AM|PM)/.exec(time);
  if (!m || !t) return NaN;
  let h = Number(t[1]) % 12; if (t[4] === "PM") h += 12;
  return Date.UTC(Number(m[3]), Number(m[1]) - 1, Number(m[2]), h + 10, Number(t[2]), Number(t[3])); // HST = UTC-10, no DST
}
const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
