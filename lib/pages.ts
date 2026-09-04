// Page-only JSON shapes (not feed Items): v1/{island}/weather.json, v1/quakes.json, v1/volcano.json, v1/tsunami.json
import type { Island } from "./types";

export type Obs = { at: number; f?: number; rh?: number; wMph?: number; wDir?: number; gMph?: number; sky?: string };
export type Period = { n: string; day: boolean; t: number; pop: number; wind: string; s: string };
/** Condition codes (from the NWS icon path): 0 clear · 1 mostly clear · 2 partly cloudy · 3 mostly cloudy · 4 overcast · 5 showers · 6 rain · 7 thunderstorms · 8 fog · 9 windy · 10 tropical */
export type Hourly = { t0: number; t: number[]; p: number[]; w: number[]; wd: number[]; c: number[]; n: number[]; rh: number[]; alt?: AltModel[] }; // parallel arrays, hour by hour from t0; n = 1 at night
/** Another model's hourly temperatures (°F) on the same t0/hour grid as the NWS arrays: the faint "alternate predictions" behind the curve. */
export type AltModel = { m: string; t: number[] };
export type TownWx = { id: string; name: string; obs?: Obs; fc: Period[]; fcAt?: number; hourly?: Hourly };
/**
 * NOAA tide predictions for the island's reference station. `h` is hourly height in feet above MLLW
 * from `t0`, the same shape as Hourly; `hl` is the turns, which is what people actually ask for —
 * nobody wants the height at 3pm, they want to know when it is high.
 */
export type Tide = { station: string; name: string; t0: number; h: number[]; hl: { t: number; v: number; hi: boolean }[] };
export type Weather = {
  upd: number; island: Island;
  towns: TownWx[];
  tide?: Tide;
  tideAt?: number;  // when we last fetched: predictions are computed, not observed, so this is a slow gate
  surf?: { at: number; zones: Record<string, Record<string, [string, string]>>; uv?: string }; // zone -> shore -> [today, tomorrow] feet
  surfAt?: number;  // when we last fetched surf, not when the product was issued: the refresh gate reads this
  buoys: { id: string; name: string; at: number; hFt: number; perS: number; dir: number }[];
  air: { name: string; pm25: number; cat: string; at: number }[];
  airAt?: number;   // ditto for AirNow
};

export type Quake = { i: string; m: number; t: number; p: string; ll: [number, number]; d: number; f?: number; mmi?: number; r?: 1 };
export type Quakes = { upd: number; notable: Quake[]; q: Quake[]; more: boolean };

export type VolcanoStatus = { vnum: string; name: string; level: string; color: string; erupting: boolean; where: string; levelSince?: number; prevLevel?: string; noticeAt: number; sms: string; sections: Record<string, string>; noticeUrl: string };
export type Volcano = {
  upd: number;
  kilauea?: VolcanoStatus; maunaloa?: VolcanoStatus;
  air: { name: string; so2?: number; pm25?: number; aqi?: number; at: number; stale?: boolean }[];
  cams: { id: string; name: string; kb?: number; mod?: number }[];
};

export type TsunamiLevel = "none" | "info" | "watch" | "advisory" | "warning";
export type Tsunami = {
  upd: number;
  status: { level: TsunamiLevel; event?: string; headline?: string; issued?: number; expires?: number; url: string };
  sirens: { upd: number; total: number; bad: { id: string; loc: string; st: string; ll: [number, number] }[] };
};
