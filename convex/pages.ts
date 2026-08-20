import { internalAction, internalMutation, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { ISLANDS } from "../lib/types.ts";
import type { Quakes, Tsunami, Volcano, Weather } from "../lib/pages.ts";
import { BUOYS, TOWNS } from "../lib/towns.ts";
import { compactQuakes, parseAirNow, parseCap, parseForecast, parseHans, parseNdbc, parseObs, parseSirens, parseSo2, parseSrf } from "./parsers/pages.ts";
import { UA, publishToR2, putSnapshot } from "./ingest.ts";

const MIN = 60_000;
const get = async (url: string, text = false, timeoutMs = 15_000) => {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: text ? "text/plain, */*" : "application/geo+json, application/json, */*" }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return text ? res.text() : res.json();
};
const settle = async <T,>(p: Promise<T>, fallback: T): Promise<T> => { try { return await p; } catch (e) { console.error("[pages]", String(e).slice(0, 160)); return fallback; } };
const prevJson = async <T,>(ctx: ActionCtx, path: string): Promise<T | null> => {
  const row = await ctx.runQuery(internal.ingest.getSnapshot, { path });
  return row ? (JSON.parse(row.body) as T) : null;
};

/** Every 5 min: quakes + tsunami status always; weather/volcano every 15 min; slow-moving parts (AirNow, sirens) hourly/daily. */
export const run = internalAction({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, { force }) => {
    const now = Date.now();
    const stale = (upd: number | undefined, minutes: number, now: number) => !!force || !upd || now - upd > minutes * MIN;
    const files: { path: string; body: string }[] = [];

    // ---- quakes ----
    const since30 = new Date(now - 30 * 86_400_000).toISOString().slice(0, 10), since7 = new Date(now - 7 * 86_400_000).toISOString().slice(0, 10);
    const bbox = "minlatitude=18.5&maxlatitude=22.5&minlongitude=-160.8&maxlongitude=-154.5";
    const [q7, q30] = await Promise.all([
      settle(get(`https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&${bbox}&minmagnitude=2.0&starttime=${since7}&orderby=time`), null),
      settle(get(`https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&${bbox}&minmagnitude=3.5&starttime=${since30}&orderby=time`), null),
    ]);
    if (q7 && q30) {
      const { q, more } = compactQuakes(q7 as never, 60);
      const quakes: Quakes = { upd: now, notable: compactQuakes(q30 as never, 10).q, q, more };
      files.push({ path: "v1/quakes.json", body: JSON.stringify(quakes) });
    }

    // ---- tsunami ----
    const prevT = await prevJson<Tsunami>(ctx, "v1/tsunami.json");
    const cap = await settle(get("https://www.tsunami.gov/events/xml/PHEBCAP.xml", true), null);
    let sirens = prevT?.sirens;
    if (stale(sirens?.upd, 24 * 60, now)) {
      const fc = await settle(get("https://services9.arcgis.com/aKxrz4vDVjfUwBWJ/arcgis/rest/services/public_siren_status_layer_view/FeatureServer/0/query?where=1%3D1&outFields=Siren_Iden,Location,Dash_Stat,Lat,Long&outSR=4326&f=geojson"), null);
      if (fc) sirens = { upd: now, ...parseSirens(fc as never) };
    }
    const status = cap ? parseCap(cap as string, now) : prevT?.status ?? { level: "none" as const };
    const tsunami: Tsunami = { upd: now, status: { ...status, url: "https://www.tsunami.gov/" }, sirens: sirens ?? { upd: 0, total: 0, bad: [] } };
    files.push({ path: "v1/tsunami.json", body: JSON.stringify(tsunami) });

    // ---- volcano (15 min) ----
    const prevV = await prevJson<Volcano>(ctx, "v1/volcano.json");
    if (stale(prevV?.upd, 15, now)) {
      const H = "https://volcanoes.usgs.gov/hans-public/api";
      const summary = await settle(get(`${H}/notice/getDailySummaryData`), null);
      if (summary) {
        const noticeId = (vnum: string) => (summary as { vnum: string; noticeId?: string }[]).find((r) => r.vnum === vnum)?.noticeId;
        const smsFor = (vnum: string) => { const id = noticeId(vnum); return id ? settle(get(`${H}/notice/getNoticeFormatted/${id}/sms`, true), undefined) : Promise.resolve(undefined); };
        const [nk, nm, sk, sm] = await Promise.all([
          settle(get(`${H}/volcano/newestForVolcano/332010`), undefined), settle(get(`${H}/volcano/newestForVolcano/332020`), undefined),
          smsFor("332010"), smsFor("332020"),
        ]);
        const end = new Date(now).toISOString().slice(0, 19), start = new Date(now - 3 * 3_600_000).toISOString().slice(0, 19);
        const so2 = await settle(get(`https://data.prod.hiso2index.info/api/data/getMostRecentPM25andSO2?_agency_code=HI1&_dst_start=${start}&_dst_end=${end}`), null);
        const newest = { "332010": nk as never, "332020": nm as never }, sms = { "332010": sk as string | undefined, "332020": sm as string | undefined };
        const volcano: Volcano = {
          upd: now,
          kilauea: parseHans(summary as never, newest, sms, "332010", "Kīlauea"),
          maunaloa: parseHans(summary as never, newest, sms, "332020", "Mauna Loa"),
          air: so2 ? parseSo2(so2 as never, now) : prevV?.air ?? [],
          cams: [
            { id: "V1cam", name: "Halemaʻumaʻu (west rim)" }, { id: "KWcam", name: "Summit panorama" }, { id: "F1cam", name: "Thermal, crater floor" },
            { id: "KPcam", name: "Summit plume" }, { id: "MLcam", name: "Mauna Loa summit" },
          ],
        };
        files.push({ path: "v1/volcano.json", body: JSON.stringify(volcano) });
      }
    }

    // ---- weather (15 min; forecast + surf + air at most hourly) ----
    const prevW: Record<string, Weather | null> = {};
    for (const island of ISLANDS) prevW[island] = await prevJson<Weather>(ctx, `v1/${island}/weather.json`);
    const anyStale = ISLANDS.some((i) => stale(prevW[i]?.upd, 15, now));
    if (anyStale) {
      const hourly = ISLANDS.some((i) => stale(prevW[i]?.surf ? prevW[i]!.upd : 0, 55, now)); // surf/air/forecast refresh at most hourly
      const [ndbc, airnow, srfList] = await Promise.all([
        settle(get("https://www.ndbc.noaa.gov/data/latest_obs/latest_obs.txt", true, 40_000), null),
        hourly ? settle(get("https://files.airnowtech.org/airnow/today/reportingarea.dat", true, 40_000), null) : null, // 1.7 MB
        hourly ? settle(get("https://api.weather.gov/products/types/SRF/locations/HFO"), null) : null,
      ]);
      let srf: Weather["surf"] | undefined;
      if (srfList) {
        const id = (srfList as { "@graph"?: { "@id": string }[] })["@graph"]?.[0]?.["@id"];
        const prod = id ? await settle(get(id), null) : null;
        if (prod) srf = parseSrf((prod as { productText: string }).productText);
      }
      const buoysAll = ndbc ? parseNdbc(ndbc as string, BUOYS) : [];
      const airAll = airnow ? parseAirNow(airnow as string) : null;
      const AIR_ISLAND: Record<string, string> = { Hilo: "hawaii", Keaau: "hawaii", "Kailua-Kona": "hawaii", Waikoloa: "hawaii", Kihei: "maui", Kahului: "maui", Honolulu: "oahu", "Sand Island": "oahu", Kapolei: "oahu", Lihue: "kauai" };

      for (const island of ISLANDS) {
        const prev = prevW[island];
        const towns = await Promise.all(TOWNS.filter((t) => t.island === island).map(async (t) => {
          const prevTown = prev?.towns.find((x) => x.id === t.id);
          const obsJson = await settle(get(`https://api.weather.gov/stations/${t.stn}/observations?limit=3`), null);
          const needFc = stale(prevTown?.fcAt, 55, now) || !prevTown?.fc.length;
          const fcJson = needFc ? await settle(get(`https://api.weather.gov/gridpoints/${t.grid}/forecast`), null) : null;
          const fc = fcJson ? parseForecast(fcJson as never) : null;
          return { id: t.id, name: t.name, obs: (obsJson && parseObs(obsJson as never)) || prevTown?.obs, fc: fc?.fc ?? prevTown?.fc ?? [], fcAt: fc ? now : prevTown?.fcAt };
        }));
        const weather: Weather = {
          upd: now, island, towns,
          surf: srf ? { at: srf.at, uv: srf.uv, zones: Object.fromEntries(Object.entries(srf.zones).filter(([z]) => (island === "hawaii" ? /Big Island/ : island === "maui" ? /^Maui/ : island === "oahu" ? /^Oahu/ : /^Kauai/).test(z))) } : prev?.surf,
          buoys: buoysAll.filter((b) => BUOYS.find((x) => x.id === b.id)?.island === island),
          air: airAll ? airAll.filter((a) => AIR_ISLAND[a.name] === island) : prev?.air ?? [],
        };
        files.push({ path: `v1/${island}/weather.json`, body: JSON.stringify(weather) });
      }
    }

    await ctx.runMutation(internal.pages.store, { files, now });
    await publishToR2(files);
  },
});

export const store = internalMutation({
  args: { files: v.array(v.object({ path: v.string(), body: v.string() })), now: v.number() },
  handler: async (ctx, { files, now }) => { for (const f of files) await putSnapshot(ctx, f.path, f.body, now); },
});
