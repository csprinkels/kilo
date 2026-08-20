import { clip, hashOf, type Island, type Item } from "../../lib/types.ts";

export const NWS_URL = "https://api.weather.gov/alerts/active?area=HI";

// SAME (FIPS) county code -> island. Kalawao (015005) is on Molokai -> maui.
const SAME_ISLAND: Record<string, Island> = {
  "015001": "hawaii", "015003": "oahu", "015005": "maui", "015007": "kauai", "015009": "maui",
};

const NWS_SEV: Record<string, Item["sev"]> = { Extreme: 4, Severe: 3, Moderate: 2, Minor: 1, Unknown: 1 };
// Events whose NWS "severity" understates the action people must take.
const EVENT_SEV: Record<string, Item["sev"]> = {
  "Tsunami Warning": 4, "Hurricane Warning": 4, "Extreme Wind Warning": 4,
  "Flash Flood Warning": 4, "Flash Flood Emergency": 4,
  "Tropical Storm Warning": 3, "Hurricane Watch": 3, "Tsunami Watch": 3, "Tsunami Advisory": 3,
  "Tropical Cyclone Local Statement": 3,
};
const EVENT_TYPE = (event: string): Item["type"] =>
  /Tsunami/.test(event) ? "tsunami" : /Hurricane|Tropical/.test(event) ? "storm" : "advisory";

export const WATCH_EVENTS = /^(Hurricane|Tropical Storm|Tsunami) (Watch|Warning)$/;

type Feature = {
  properties: {
    id: string; event: string; headline?: string | null; description?: string | null;
    instruction?: string | null; areaDesc: string; severity: string; status: string;
    messageType: string; sent: string; effective: string; expires: string; ends?: string | null;
    geocode?: { SAME?: string[]; UGC?: string[] };
  };
};

export function parseNws(json: { features: Feature[] }, now = Date.now()): Item[] {
  const out: Item[] = [];
  for (const { properties: p } of json.features ?? []) {
    if (p.status !== "Actual" || p.messageType === "Cancel") continue;
    const islands = [...new Set((p.geocode?.SAME ?? []).map((c) => SAME_ISLAND[c]).filter(Boolean))];
    const sev = EVENT_SEV[p.event] ?? NWS_SEV[p.severity] ?? 1;
    const title = clip(`${p.event}: ${p.areaDesc}`, 120);
    const body = clip([p.headline, p.description, p.instruction].filter(Boolean).join("\n\n"), 600);
    // `expires` is message staleness; `ends` is the event end and may be null.
    const expiresAt = Date.parse(p.ends ?? p.expires);
    out.push({
      key: `nws:${p.id}`,
      source: "nws",
      type: EVENT_TYPE(p.event),
      tier: "official",
      sev,
      islands: islands.length ? islands : ["state"],
      districts: [],
      title,
      body,
      srcUrl: `https://alerts.weather.gov/search?id=${encodeURIComponent(p.id)}`,
      fields: { event: p.event, nwsSeverity: p.severity, areaDesc: clip(p.areaDesc, 300) },
      issuedAt: Date.parse(p.effective ?? p.sent),
      lastConfirmedAt: now,
      expiresAt: Number.isFinite(expiresAt) ? expiresAt : undefined,
      hash: hashOf(p.event, p.headline, p.description, p.ends, p.expires),
    });
  }
  return out;
}
