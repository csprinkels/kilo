// Parsers for page-only JSON (weather, quakes, volcano, tsunami). Pure functions; fixtures in fixtures/.
import { XMLParser } from "fast-xml-parser";
import { clip } from "../../lib/types.ts";
import type { Hourly, Obs, Period, Quake, TsunamiLevel, VolcanoStatus, Weather } from "../../lib/pages.ts";
import { COMPASS } from "../../lib/storm.ts";
import { conditionCode } from "../../lib/summary.ts";
export { conditionCode };

const cToF = (c: number) => Math.round((c * 9) / 5 + 32);
const kmhToMph = (k: number) => Math.round(k / 1.609);
const mToFt = (m: number) => Math.round(m * 3.281 * 10) / 10;

// ---------- NWS observations: /stations/{id}/observations?limit=3 (the /latest endpoint is often null with QC "Z") ----------
type ObsFeature = { properties: { timestamp: string; textDescription?: string; rawMessage?: string; temperature: { value: number | null }; relativeHumidity: { value: number | null }; windSpeed: { value: number | null }; windDirection: { value: number | null }; windGust: { value: number | null } } };
export function parseObs(json: { features?: ObsFeature[] }): Obs | undefined {
  for (const f of json.features ?? []) {
    const p = f.properties;
    const at = Date.parse(p.timestamp);
    if (p.temperature.value != null) {
      return {
        at, f: cToF(p.temperature.value), rh: p.relativeHumidity.value != null ? Math.round(p.relativeHumidity.value) : undefined,
        wMph: p.windSpeed.value != null ? kmhToMph(p.windSpeed.value) : undefined, wDir: p.windDirection.value ?? undefined,
        gMph: p.windGust.value != null ? kmhToMph(p.windGust.value) : undefined, sky: p.textDescription || undefined,
      };
    }
    // METAR fallback: "PHTO 200853Z AUTO 24003KT 10SM CLR 24/22 A2997"
    const m = /\s(\d{3})(\d{2,3})(?:G(\d{2,3}))?KT\s.*?\s(M?\d{2})\/(M?\d{2})\s/.exec(p.rawMessage ?? "");
    if (m) {
      const t = Number(m[4].replace("M", "-")), dew = Number(m[5].replace("M", "-"));
      const rh = Math.round(100 * Math.exp((17.625 * dew) / (243.04 + dew)) / Math.exp((17.625 * t) / (243.04 + t)));
      return { at, f: cToF(t), rh, wMph: Math.round(Number(m[2]) * 1.151), wDir: Number(m[1]), gMph: m[3] ? Math.round(Number(m[3]) * 1.151) : undefined, sky: p.textDescription || undefined };
    }
  }
  return undefined;
}

// ---------- NWS forecast periods ----------
type FcPeriod = { name: string; isDaytime: boolean; temperature: number; probabilityOfPrecipitation?: { value: number | null }; windSpeed: string; windDirection: string; shortForecast: string };
export function parseForecast(json: { properties?: { updateTime?: string; periods?: FcPeriod[] } }): { at?: number; fc: Period[] } {
  const periods = (json.properties?.periods ?? []).slice(0, 4);
  return {
    at: json.properties?.updateTime ? Date.parse(json.properties.updateTime) : undefined,
    fc: periods.map((p) => ({ n: p.name, day: p.isDaytime, t: p.temperature, pop: p.probabilityOfPrecipitation?.value ?? 0, wind: `${p.windDirection} ${p.windSpeed}`.trim(), s: clip(p.shortForecast, 40) })),
  };
}

// ---------- NWS hourly forecast → compact parallel arrays (36 h ≈ 600 B) ----------
type HourPeriod = { startTime: string; isDaytime: boolean; temperature: number; probabilityOfPrecipitation?: { value: number | null }; relativeHumidity?: { value: number | null }; windSpeed: string; windDirection: string; icon?: string; shortForecast?: string };
export function parseHourly(json: { properties?: { periods?: HourPeriod[] } }, hours = 36, now = Date.now()): Hourly | undefined {
  const ps = (json.properties?.periods ?? []).filter((p) => Date.parse(p.startTime) >= now - 3_600_000).slice(0, hours);
  if (!ps.length) return undefined;
  return {
    t0: Date.parse(ps[0].startTime),
    t: ps.map((p) => p.temperature),
    p: ps.map((p) => p.probabilityOfPrecipitation?.value ?? 0),
    w: ps.map((p) => parseInt(p.windSpeed) || 0),
    wd: ps.map((p) => Math.max(0, COMPASS.indexOf(p.windDirection))),
    c: ps.map((p) => conditionCode(p.icon, p.shortForecast)),
    n: ps.map((p) => (p.isDaytime ? 0 : 1)),
    rh: ps.map((p) => p.relativeHumidity?.value ?? 0),
  };
}

// ---------- NWS Surf Zone Forecast (SRF) text: zone blocks with shore rows of heights (feet) ----------
export function parseSrf(text: string): { at: number; zones: Record<string, Record<string, [string, string]>>; uv?: string } {
  const zones: Record<string, Record<string, [string, string]>> = {};
  const blocks = text.split(/\n(?=HIZ\d)/);
  for (const b of blocks) {
    const name = /^HIZ[^\n]*\n([A-Za-z ]+)-\n/.exec(b)?.[1]?.trim();
    if (!name) continue;
    const shores: Record<string, [string, string]> = {};
    for (const m of b.matchAll(/^(North|East|South|West) Facing\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)/gm)) {
      shores[m[1]] = [m[3], m[5]]; // AM columns: tonight->tomorrow morning, next day morning; simple and stable
    }
    if (Object.keys(shores).length) zones[name] = shores;
  }
  const uv = /UV Index\.+\s*(\w+)/.exec(text)?.[1];
  const when = /(\d{3,4}) (AM|PM) HST \w{3} (\w{3}) (\d{1,2}) (\d{4})/.exec(text);
  let at = Date.now();
  if (when) {
    const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let h = Math.floor(Number(when[1]) / 100) % 12; if (when[2] === "PM") h += 12;
    at = Date.UTC(Number(when[5]), MON.indexOf(when[3]), Number(when[4]), h + 10, Number(when[1]) % 100);
  }
  return { at, zones, uv };
}

// ---------- NDBC latest_obs.txt: whitespace table, "MM" = missing ----------
export function parseNdbc(text: string, ids: { id: string; name: string }[]) {
  const out: Weather["buoys"] = [];
  for (const line of text.split("\n")) {
    const c = line.trim().split(/\s+/);
    const b = ids.find((x) => x.id === c[0]);
    if (!b || c.length < 15) continue;
    const [, , , yy, mo, dd, hh, mi, , , , wvht, dpd, , mwd] = c;
    if (wvht === "MM") continue;
    out.push({ id: b.id, name: b.name, at: Date.UTC(+yy, +mo - 1, +dd, +hh, +mi), hFt: mToFt(+wvht), perS: dpd === "MM" ? 0 : +dpd, dir: mwd === "MM" ? -1 : +mwd });
  }
  return out;
}

// ---------- AirNow reportingarea.dat: pipe-delimited; keep HI current ("O") PM2.5 rows ----------
export function parseAirNow(text: string): Weather["air"] {
  const out: Weather["air"] = [];
  for (const line of text.split("\n")) {
    const f = line.split("|");
    if (f.length < 14 || f[8] !== "HI" || f[5] !== "O" || f[11] !== "PM2.5") continue;
    const [mm, dd, yy] = f[1].split("/").map(Number), [h] = (f[2] || "0:00").split(":").map(Number);
    out.push({ name: f[7], pm25: Number(f[12]), cat: f[13], at: Date.UTC(2000 + yy, mm - 1, dd, h + 10) });
  }
  return out;
}

// ---------- USGS quakes (FDSN GeoJSON) → compact ----------
type UsgsFeature = { id: string; geometry: { coordinates: [number, number, number] }; properties: { mag: number; place: string; time: number; felt?: number | null; mmi?: number | null; status?: string } };
export function compactQuakes(json: { features?: UsgsFeature[] }, cap = 60): { q: Quake[]; more: boolean } {
  const all = (json.features ?? []).map(({ id, geometry: { coordinates: [lon, lat, depth] }, properties: p }): Quake => ({
    i: id, m: Math.round(p.mag * 10) / 10, t: Math.round(p.time / 1000), p: p.place.replace(/, Hawaii$/, ""), ll: [Math.round(lat * 100) / 100, Math.round(lon * 100) / 100], d: Math.round(depth),
    ...(p.felt ? { f: p.felt } : {}), ...(p.mmi ? { mmi: Math.round(p.mmi * 10) / 10 } : {}), ...(p.status === "reviewed" ? { r: 1 as const } : {}),
  })).sort((a, b) => b.t - a.t);
  return { q: all.slice(0, cap), more: all.length > cap };
}

// ---------- HVO HANS ----------
type Summary = { noticeId: string; vName: string; vnum: string; synopsis: string; alertLevel: string; colorCode: string; sentUnixtime: string; statusUnixtime?: string; prevAlertLevel?: string };
type Newest = { noticeUrl?: string; noticeId?: string; sent_unixtime?: string | number; noticeSections?: { vnum: string; summary?: string; synopsis?: string; alertLevel?: string; colorCode?: string }[] };
export function parseHans(summary: Summary[], newest: Record<string, Newest | undefined>, sms: Record<string, string | undefined>, vnum: string, name: string): VolcanoStatus | undefined {
  // Volcanoes at NORMAL (Mauna Loa, most months) are absent from the daily summary: fall back to their newest (monthly) notice.
  const sec = newest[vnum]?.noticeSections?.find((s) => s.vnum === vnum);
  const row: Summary | undefined = summary.find((r) => r.vnum === vnum) ?? (sec && sec.alertLevel ? {
    noticeId: newest[vnum]?.noticeId ?? "", vName: name, vnum, synopsis: sec.synopsis ?? "", alertLevel: sec.alertLevel, colorCode: sec.colorCode ?? "GREEN",
    sentUnixtime: String(newest[vnum]?.sent_unixtime ?? 0),
  } : undefined);
  if (!row) return undefined;
  const html = newest[vnum]?.noticeSections?.find((s) => s.vnum === vnum)?.summary ?? "";
  const sections: Record<string, string> = {};
  for (const m of html.matchAll(/<strong>([^<:]{3,40}):?<\/strong>:?([\s\S]*?)(?=<strong>|$)/g)) {
    const body = m[2].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
    if (body.length > 20) sections[m[1].trim()] = clip(body, 400);
  }
  const synopsis = row.synopsis ?? "";
  const smsText = (sms[vnum] ?? "").replace(/^\s*\w+ \([A-Z]+\/[A-Z]+\)\s*/, "").trim() || synopsis;
  return {
    vnum, name, level: row.alertLevel, color: row.colorCode,
    erupting: !/not erupting|paused|is not currently erupting/i.test(synopsis) && /erupt/i.test(synopsis),
    where: /rift/i.test(synopsis) ? "rift zone" : "summit",
    levelSince: row.statusUnixtime ? Number(row.statusUnixtime) * 1000 : undefined, prevLevel: row.prevAlertLevel || undefined,
    noticeAt: Number(row.sentUnixtime) * 1000, sms: clip(smsText, 400), sections,
    noticeUrl: newest[vnum]?.noticeUrl ?? `https://volcanoes.usgs.gov/hans-public/notice/${row.noticeId}`,
  };
}

// ---------- Hawaiʻi DOH SO2/PM2.5 (hiso2index, undocumented) ----------
type So2Row = { site: string; pollutant: string; value: number | null; aqivalue: number | null; dateTimeStamp: string };
const SO2_SITES: Record<string, string> = { Hilo: "Hilo", Kona: "Kona", "KS Hawaii": "Keaʻau (KS)", Waikoloa: "Waikoloa", "Kailua-Kona": "Kailua-Kona", Pahala: "Pāhala", "Ocean View": "Ocean View", "Mountain View": "Mountain View", Volcano: "Volcano", Honolulu: "Honolulu", Kapolei: "Kapolei", "Kihei, Maui": "Kīhei" };
export function parseSo2(rows: So2Row[], now = Date.now()) {
  const by = new Map<string, { name: string; so2?: number; pm25?: number; aqi?: number; at: number; stale?: boolean }>();
  for (const r of rows ?? []) {
    const name = SO2_SITES[r.site]; if (!name) continue;
    const at = Date.parse(r.dateTimeStamp + "Z");
    const cur = by.get(name) ?? { name, at: 0 };
    if (/^SO2/i.test(r.pollutant) && r.value != null && at >= (cur.at || 0)) { cur.so2 = Math.round(r.value * 1000) / 1000; cur.at = Math.max(cur.at, at); }
    if (/^PM2\.5/i.test(r.pollutant) && r.value != null) { cur.pm25 = Math.round(r.value); if (r.aqivalue != null && r.aqivalue >= 0) cur.aqi = r.aqivalue; cur.at = Math.max(cur.at, at); }
    by.set(name, cur);
  }
  return [...by.values()].map((s) => ({ ...s, stale: now - s.at > 3 * 3_600_000 || undefined })).sort((a, b) => a.name.localeCompare(b.name));
}

// ---------- PTWC CAP: threat level from VTEC/event ----------
const xml = new XMLParser({ ignoreAttributes: false, textNodeName: "#text" });
export function parseCap(text: string, now = Date.now()): { level: TsunamiLevel; event?: string; headline?: string; issued?: number; expires?: number } {
  const doc = xml.parse(text);
  const alert = doc?.alert; const info = Array.isArray(alert?.info) ? alert.info[0] : alert?.info;
  if (!info) return { level: "none" };
  const expires = info.expires ? Date.parse(info.expires) : undefined, issued = alert?.sent ? Date.parse(alert.sent) : undefined;
  const event = String(info.event ?? ""), headline = String(info.headline ?? "");
  const params: { valueName: string; value: string }[] = Array.isArray(info.parameter) ? info.parameter : info.parameter ? [info.parameter] : [];
  const vtec = params.find((p) => /VTEC/i.test(p.valueName))?.value ?? "";
  let level: TsunamiLevel = /warning/i.test(event) ? "warning" : /advisory/i.test(event) ? "advisory" : /watch/i.test(event) ? "watch" : "info";
  if (/\/(CAN|EXP)\./.test(vtec)) level = "none";
  if (expires && expires < now) level = "none";
  return { level, event, headline: clip(headline, 160), issued, expires };
}

// ---------- HI-EMA siren status (statewide) ----------
type SirenFeature = { geometry: { coordinates: [number, number] } | null; properties: { Siren_Iden?: string; Location?: string; Dash_Stat?: string; Lat?: number; Long?: number } };
export function parseSirens(fc: { features?: SirenFeature[] }) {
  const feats = fc.features ?? [];
  const bad = feats.filter((f) => f.properties.Dash_Stat && f.properties.Dash_Stat !== "Operational").map((f) => ({
    id: String(f.properties.Siren_Iden ?? ""), loc: clip(String(f.properties.Location ?? ""), 60), st: String(f.properties.Dash_Stat),
    ll: [Math.round((f.geometry?.coordinates[1] ?? f.properties.Lat ?? 0) * 1000) / 1000, Math.round((f.geometry?.coordinates[0] ?? f.properties.Long ?? 0) * 1000) / 1000] as [number, number],
  }));
  return { total: feats.length, bad };
}
