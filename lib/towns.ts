// Towns shown on /weather, one NWS grid + observation station each. Resolved once via api.weather.gov/points (2026-08-20).
import type { Island } from "./types";
export type Town = { island: Exclude<Island, "state">; id: string; name: string; lat: number; lon: number; grid: string; stn: string; zone: string };
export const TOWNS: Town[] = [
  { island: "hawaii", id: "hilo", name: "Hilo", lat: 19.7297, lon: -155.09, grid: "HFO/270,74", stn: "PHTO", zone: "HIZ053" },
  { island: "hawaii", id: "kona", name: "Kailua-Kona", lat: 19.64, lon: -155.99, grid: "HFO/232,70", stn: "PHKO", zone: "HIZ023" },
  { island: "hawaii", id: "waimea", name: "Waimea", lat: 20.02, lon: -155.67, grid: "HFO/246,87", stn: "PHMU", zone: "HIZ054" },
  { island: "hawaii", id: "pahoa", name: "Pāhoa", lat: 19.49, lon: -154.95, grid: "HFO/276,64", stn: "PHTO", zone: "HIZ053" },
  { island: "maui", id: "kahului", name: "Kahului", lat: 20.89, lon: -156.47, grid: "HFO/212,126", stn: "PHOG", zone: "HIZ045" },
  { island: "maui", id: "kihei", name: "Kīhei", lat: 20.76, lon: -156.46, grid: "HFO/213,120", stn: "PHOG", zone: "HIZ049" },
  { island: "maui", id: "hana", name: "Hāna", lat: 20.76, lon: -155.99, grid: "HFO/232,120", stn: "PHOG", zone: "HIZ047" },
  { island: "oahu", id: "honolulu", name: "Honolulu", lat: 21.31, lon: -157.86, grid: "HFO/154,145", stn: "PHNL", zone: "HIZ033" },
  { island: "oahu", id: "kaneohe", name: "Kāneʻohe", lat: 21.41, lon: -157.8, grid: "HFO/157,149", stn: "PHNG", zone: "HIZ009" },
  { island: "oahu", id: "kapolei", name: "Kapolei", lat: 21.34, lon: -158.06, grid: "HFO/146,146", stn: "PHJR", zone: "HIZ034" },
  { island: "kauai", id: "lihue", name: "Līhuʻe", lat: 21.98, lon: -159.37, grid: "HFO/91,175", stn: "PHLI", zone: "HIZ030" },
  { island: "kauai", id: "kapaa", name: "Kapaʻa", lat: 22.08, lon: -159.32, grid: "HFO/93,179", stn: "PHLI", zone: "HIZ030" },
  { island: "kauai", id: "waimea-kauai", name: "Waimea (Kauaʻi)", lat: 21.96, lon: -159.67, grid: "HFO/79,174", stn: "PHBK", zone: "HIZ003" },
];

// NDBC wave buoys that report today (51203/51204 are dead, 51210/51213 stale as of Aug 2026).
export const BUOYS: { id: string; name: string; island: Exclude<Island, "state"> }[] = [
  { id: "51206", name: "Hilo", island: "hawaii" }, { id: "51205", name: "Pauwela (Maui N shore)", island: "maui" },
  { id: "51201", name: "Waimea Bay", island: "oahu" }, { id: "51202", name: "Mokapu", island: "oahu" }, { id: "51211", name: "Pearl Harbor", island: "oahu" }, { id: "51212", name: "Barbers Point", island: "oahu" },
  { id: "51208", name: "Hanalei", island: "kauai" },
];

// Surf Zone Forecast (SRF) zone blocks per island, in the order HFO prints them.
export const SRF_ZONES: Record<Exclude<Island, "state">, string[]> = { hawaii: ["Big Island Windward and Southeast", "Big Island Leeward"], maui: ["Maui"], oahu: ["Oahu"], kauai: ["Kauai"] };

/**
 * NOAA CO-OPS reference tide stations, one per island — the harbour each island's tide tables are
 * published against. Tides differ by only minutes around one island, so a second station would be
 * another fetch for a difference nobody can act on.
 */
export const TIDES: Record<Exclude<Island, "state">, { id: string; name: string }> = {
  hawaii: { id: "1617760", name: "Hilo Bay" },
  maui: { id: "1615680", name: "Kahului Harbor" },
  oahu: { id: "1612340", name: "Honolulu Harbor" },
  kauai: { id: "1611400", name: "Nāwiliwili Harbor" },
};
