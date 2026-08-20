// Pure weather helpers shared by the Weather page and tests: Dark-Sky-style summary sentence, feels-like, sun times, icon mapping.
import type { Hourly } from "./pages.ts";

const HST_OFFSET_MIN = -600;
const hourHST = (ms: number) => new Date(ms + HST_OFFSET_MIN * 60_000).getUTCHours();
const dayHST = (ms: number) => Math.floor((ms + HST_OFFSET_MIN * 60_000) / 86_400_000);
export const clock = (ms: number) => {
  const h = hourHST(ms), h12 = h % 12 || 12;
  return `${h12} ${h < 12 ? "AM" : "PM"}`;
};

const WET = new Set([5, 6, 7, 10]);
const word = (c: number, maxP: number) => {
  const x = c === 7 ? "thunderstorms" : c === 10 ? "tropical rain" : c === 6 ? "rain" : "showers";
  if (maxP >= 80) return x[0].toUpperCase() + x.slice(1);
  if (maxP >= 60) return `${x[0].toUpperCase() + x.slice(1)} likely`;
  return `Chance of ${x}`;
};
const bucket = (ms: number, t0: number) => {
  const h = hourHST(ms), sameDay = dayHST(ms) === dayHST(t0);
  if (!sameDay) return h < 12 ? "tomorrow morning" : h < 18 ? "tomorrow afternoon" : "tomorrow evening";
  return h < 12 ? "this morning" : h < 18 ? "this afternoon" : h < 22 ? "this evening" : "tonight";
};
const COND_WORD: Record<number, string> = { 0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Mostly cloudy", 4: "Overcast", 5: "Showers", 6: "Rain", 7: "Thunderstorms", 8: "Fog", 9: "Windy", 10: "Tropical weather" };

/** One plain sentence for the next `window` hours. Present tense, hedged by probability, clock times on the hour. */
/** The day's sentence, led by "Clear right now." when the station disagrees with the forecast's first hour. */
export function nowAndLater(obsCode: number | undefined, h: Hourly, window = 24): string {
  const later = summarize(h, window);
  if (obsCode == null || condWord(obsCode) === condWord(h.c[0])) return later;
  const dry = obsCode <= 4, wetSoon = WET.has(h.c[0]) || h.p[0] >= 40;
  return dry && wetSoon ? `${condWord(obsCode)} right now. ${later}` : later;
}

export function summarize(h: Hourly, window = 24): string {
  const n = Math.min(window, h.t.length);
  const at = (i: number) => h.t0 + i * 3_600_000;
  // Rain run: first stretch of >=2 consecutive wet hours (condition or pop>=40).
  const wet = (i: number) => WET.has(h.c[i]) || h.p[i] >= 40;
  let start = -1, end = -1;
  for (let i = 0; i + 1 < n; i++) if (wet(i) && wet(i + 1)) { start = i; break; }
  if (start >= 0) { end = start; while (end + 1 < n && wet(end + 1)) end++; }
  if (start >= 0) {
    const run = Array.from({ length: end - start + 1 }, (_, k) => start + k);
    const maxP = Math.max(...run.map((i) => h.p[i]));
    const cTop = Math.max(...run.map((i) => (h.c[i] === 7 || h.c[i] === 10 ? 10 : h.c[i] === 6 ? 6 : 5)));
    const code = cTop === 10 ? (run.some((i) => h.c[i] === 10) ? 10 : 7) : cTop;
    if (maxP >= 30) {
      const w = word(code, maxP);
      const coverage = (end - start + 1) / n;
      if (start === 0 && coverage >= 0.7) return `${w} throughout the day.`;
      if (start === 0) {
        const after = h.c[Math.min(n - 1, end + 1)] <= 2 ? "clearing" : "partly cloudy";
        return `${w} until ${clock(at(end + 1))}, then ${after}.`;
      }
      if (coverage >= 0.7) return `${w} from ${clock(at(start))} on.`;
      if (start <= 1) return `${w} starting soon.`;
      if (start <= 3) return `${w} starting around ${clock(at(start))}.`;
      return `${w} ${bucket(at(start), h.t0)}.`;
    }
  }
  // Dry: wind, fog, or a plain condition line with the day's extreme.
  const windyHours = h.w.slice(0, n).filter((w) => w >= 20).length;
  if (windyHours >= 3 || h.c.slice(0, n).filter((c) => c === 9).length >= 3) return `Breezy ${bucket(at(0), h.t0).replace("this ", "this ")}, winds to ${Math.max(...h.w.slice(0, n))} mph.`;
  if (h.c[0] === 8) {
    const clear = h.c.slice(0, n).findIndex((c) => c !== 8);
    return clear > 0 ? `Fog this morning, clearing by ${clock(at(clear))}.` : "Foggy through the day.";
  }
  const night = h.n[0] === 1;
  const cond = COND_WORD[h.c[0]] ?? "Clear";
  return night ? `${cond} tonight, low ${Math.min(...h.t.slice(0, Math.min(12, n)))}°.` : `${cond} today, high ${Math.max(...h.t.slice(0, Math.min(14, n)))}°.`;
}

const ICON_CODE: [RegExp, number][] = [
  [/hurricane|tropical_storm/, 10], [/tsra/, 7], [/rain_showers|showers/, 5], [/rain|sleet|snow/, 6], [/fog|haze|smoke/, 8], [/wind/, 9],
  [/ovc/, 4], [/bkn/, 3], [/sct/, 2], [/few/, 1], [/skc|hot|cold/, 0],
];
export function conditionCode(iconUrl = "", shortForecast = ""): number {
  const key = (iconUrl.split("/").slice(-1)[0] ?? "").split("?")[0] || shortForecast.toLowerCase().replace(/ /g, "_");
  const hit = ICON_CODE.find(([re]) => re.test(key))?.[1];
  if (hit != null) return hit;
  const t = shortForecast.toLowerCase();
  return /thunder/.test(t) ? 7 : /shower/.test(t) ? 5 : /rain|drizzle/.test(t) ? 6 : /fog|mist|haze|vog/.test(t) ? 8 : /windy|breezy/.test(t) ? 9
    : /overcast/.test(t) ? 4 : /mostly cloudy/.test(t) ? 3 : /partly|scattered clouds/.test(t) ? 2 : /cloud/.test(t) ? 4 : /mostly clear|mostly sunny/.test(t) ? 1 : 0;
}

/** NOAA heat index (Rothfusz), °F; returns the air temp below 80°F. */
export function feelsLike(tF: number, rh: number): number {
  if (tF < 80 || rh <= 0) return Math.round(tF);
  const t = tF, r = rh;
  let hi = -42.379 + 2.04901523 * t + 10.14333127 * r - 0.22475541 * t * r - 6.83783e-3 * t * t - 5.481717e-2 * r * r + 1.22874e-3 * t * t * r + 8.5282e-4 * t * r * r - 1.99e-6 * t * t * r * r;
  if (r < 13 && t <= 112) hi -= ((13 - r) / 4) * Math.sqrt((17 - Math.abs(t - 95)) / 17);
  if (r > 85 && t <= 87) hi += ((r - 85) / 10) * ((87 - t) / 5);
  return Math.round(hi);
}

/** Sunrise/sunset for a date (local HST midnight given as epoch ms) at lat/lon — NOAA approximation, good to ~2 min. */
export function sunTimes(dayStartMs: number, lat: number, lon: number): { rise: number; set: number } {
  const rad = Math.PI / 180;
  const noonGuess = dayStartMs + 12 * 3_600_000;
  const J = noonGuess / 86_400_000 + 2440587.5;
  // n = whole days since J2000 for this local day (J is local noon, so rounding lands on the right day);
  // J* = mean solar noon at this longitude (west is negative here, so "- lon/360" adds the westward fraction).
  const n = Math.round(J - 2451545.0);
  const Jstar = n + 0.0008 - lon / 360;
  const M = (357.5291 + 0.98560028 * Jstar) % 360;
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const lam = (M + C + 180 + 102.9372) % 360;
  const Jtransit = 2451545.0 + Jstar + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * lam * rad);
  const delta = Math.asin(Math.sin(lam * rad) * Math.sin(23.4397 * rad));
  const cosW = (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * Math.sin(delta)) / (Math.cos(lat * rad) * Math.cos(delta));
  const w = Math.acos(Math.max(-1, Math.min(1, cosW))) / rad;
  const toMs = (jd: number) => (jd - 2440587.5) * 86_400_000;
  return { rise: toMs(Jtransit - w / 360), set: toMs(Jtransit + w / 360) };
}

/** lucide icon name + condition colour token for a code (see lib/pages.ts). */
export const ICON_FOR: Record<number, { day: string; night: string; tone: string }> = {
  0: { day: "Sun", night: "Moon", tone: "clear" }, 1: { day: "Sun", night: "Moon", tone: "clear" },
  2: { day: "CloudSun", night: "CloudMoon", tone: "cloud" }, 3: { day: "CloudSun", night: "CloudMoon", tone: "cloud" },
  4: { day: "Cloud", night: "Cloud", tone: "cloud" }, 5: { day: "CloudDrizzle", night: "CloudDrizzle", tone: "showers" },
  6: { day: "CloudRain", night: "CloudRain", tone: "rain" }, 7: { day: "CloudLightning", night: "CloudLightning", tone: "storm" },
  8: { day: "CloudFog", night: "CloudFog", tone: "fog" }, 9: { day: "Wind", night: "Wind", tone: "windy" },
  10: { day: "CloudLightning", night: "CloudLightning", tone: "storm" },
};
export const condWord = (c: number) => COND_WORD[c] ?? "Clear";
