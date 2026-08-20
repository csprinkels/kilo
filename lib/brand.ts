import type { Island, ItemType } from "./types";

export const APP_NAME = "Kilo";
export const TAGLINE = "Hawaiʻi, at a glance"; // kilo: to watch, observe, forecast

export const ISLAND_LABEL: Record<Island, string> = {
  hawaii: "Hawaiʻi Island",
  maui: "Maui · Molokaʻi · Lānaʻi",
  oahu: "Oʻahu",
  kauai: "Kauaʻi · Niʻihau",
  state: "Statewide",
};

export const TYPE_LABEL: Record<ItemType, string> = {
  advisory: "Weather", storm: "Tropical cyclone", tsunami: "Tsunami", quake: "Earthquake", volcano: "Volcano",
  notice: "Notice", shelter: "Shelter", road_closure: "Road", evac: "Evacuation", hazard: "Hazard",
  school: "School", outage: "Outage", traffic: "Traffic",
};

export const SOURCE_LABEL: Record<string, string> = {
  nws: "National Weather Service",
  hccda: "Hawaiʻi County Civil Defense",
  hdot: "Hawaiʻi DOT Highways",
  hiema: "HI-EMA",
  hpd: "Hawaiʻi Police Department",
  hnl: "Honolulu Police (911 dispatch)",
  usgs: "USGS",
  hvo: "USGS Hawaiian Volcano Observatory",
  ptwc: "Pacific Tsunami Warning Center",
};

export const SEV_SECTION: Record<1 | 2 | 3 | 4, string> = {
  4: "Life safety", 3: "Warnings & shelters", 2: "Closures & advisories", 1: "Notices",
};

// Official sign-up for each county's own alert system: step one of onboarding, not a competitor.
export const COUNTY_ALERTS: Record<Exclude<Island, "state">, { label: string; how: string; url: string }> = {
  hawaii: { label: "Hawaiʻi County (HAWAIIALERTS)", how: "Text HAWAIIALERTS to 888777", url: "https://www.hawaiicounty.gov/departments/civil-defense" },
  maui: { label: "Maui County (MEMA Alerts)", how: "Sign up at mauicounty.gov", url: "https://www.mauicounty.gov/983/MEMA-Alerts" },
  oahu: { label: "Honolulu (HNL Alert)", how: "Text HNLALERT to 888777", url: "https://www.honolulu.gov/dem/hnl-alert/" },
  kauai: { label: "Kauaʻi (KEMA Alerts)", how: "Sign up at kauai.gov", url: "https://www.kauai.gov/Government/Departments-Agencies/Emergency-Management-Agency" },
};

/** Display faces lack U+02BB; the ʻokina is traditionally typeset as an opening single quote. */
export const okina = (s: string) => s.replace(/ʻ/g, "\u2018");

const HST = "Pacific/Honolulu";
export const fmtTime = (ms: number) =>
  new Intl.DateTimeFormat("en-US", { timeZone: HST, hour: "numeric", minute: "2-digit" }).format(ms);
export const fmtDateTime = (ms: number) =>
  new Intl.DateTimeFormat("en-US", { timeZone: HST, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(ms);
/** "Thu 8 AM" in HST: timeline and map labels. */
export const fmtDayTime = (ms: number) =>
  new Intl.DateTimeFormat("en-US", { timeZone: HST, weekday: "short", hour: "numeric" }).format(ms).replace(",", "");
export const ago = (ms: number, now = Date.now()) => {
  const m = Math.max(0, Math.round((now - ms) / 60_000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
};
