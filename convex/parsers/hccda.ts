import { clip, hashOf, type Item } from "../../lib/types.ts";

// Hawaii County Civil Defense public ArcGIS feature layers (GeoJSON, no auth).
const BASE = "https://services1.arcgis.com/C2LPusZs5OXNGFDn/arcgis/rest/services";
const q = (layer: string) =>
  `${BASE}/${layer}/FeatureServer/0/query?where=1%3D1&outFields=*&outSR=4326&f=geojson`;

export const HCCDA_LAYERS = {
  shelters: q("Emergency_Shelters_(HCCDA)_Public"),
  roads: q("Road_Closures_(HCCDA)_Public"),
  evacs: q("Evacuations_(HCCDA)_Public"),
  hazards: q("Hazards_(HCCDA)_Public"),
  schools: q("School_Closures_(HCCDA)_Public"),
} as const;
export type HccdaLayer = keyof typeof HCCDA_LAYERS;

const DASHBOARD = "https://www.arcgis.com/apps/dashboards/5865229bcba74020992b372ef18b6f17";

type Props = Record<string, string | number | null | undefined>;
type Feature = { geometry: { type: string; coordinates: unknown } | null; properties: Props };
type FC = { features: Feature[] };

const str = (v: unknown) => (v == null ? "" : String(v).trim());
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/** First coordinate of any geometry, as [lon, lat]. Good enough for distance sorting. */
function firstCoord(g: Feature["geometry"]): [number, number] | undefined {
  if (!g) return undefined;
  let c: unknown = g.coordinates;
  while (Array.isArray(c) && Array.isArray(c[0])) c = c[0];
  return Array.isArray(c) && typeof c[0] === "number" && typeof c[1] === "number" ? [c[0], c[1]] : undefined;
}

function base(layer: HccdaLayer, p: Props, f: Feature, now: number): Omit<Item, "type" | "sev" | "title" | "body" | "hash"> {
  const [lon, lat] = firstCoord(f.geometry) ?? [num(p.Longitude), num(p.Latitude)];
  const issuedAt = num(p.Start_Date) ?? num(p.CreationDate) ?? num(p.EditDate) ?? now;
  const end = num(p.End_Date);
  return {
    key: `hccda:${layer}:${str(p.GlobalID) || str(p.OBJECTID)}`,
    source: "hccda",
    tier: "official",
    islands: ["hawaii"],
    districts: p.District ? [str(p.District)] : [],
    srcUrl: DASHBOARD,
    lat, lon,
    issuedAt,
    lastConfirmedAt: now,
    expiresAt: end && end > now ? end : undefined,
  };
}

export function parseHccda(layer: HccdaLayer, fc: FC, now = Date.now()): Item[] {
  const out: Item[] = [];
  for (const f of fc.features ?? []) {
    const p = f.properties ?? {};
    const active = str(p.Active) === "Active";
    const status = str(p.Status);
    const where = [str(p.Location), p.Mile_Marker && `MM ${str(p.Mile_Marker)}`].filter(Boolean).join(", ");
    const b = base(layer, p, f, now);

    if (layer === "shelters") {
      if (!status || status === "Closed") continue;
      const notes = [
        str(p.Address) && `${str(p.Address)}, ${str(p.City)}`,
        str(p.Animals) === "Yes" ? "Pets: yes" : str(p.Animals) === "No" ? "Pets: no" : "",
        str(p.Hardened) === "Yes" ? "Hurricane-hardened" : "",
        str(p.Notes),
      ].filter(Boolean).join(" · ");
      out.push({
        ...b, type: "shelter", sev: 3, status,
        title: clip(`Shelter ${status.toUpperCase()}: ${str(p.Name)}`, 120),
        body: clip(notes, 600),
        fields: { address: str(p.Address), city: str(p.City), zip: str(p.Zip_Code), animals: str(p.Animals), capacity: str(p.Capacity) },
        hash: hashOf(status, p.Notes, p.Capacity, p.Occupancy),
      });
    } else if (layer === "roads") {
      if (!active || !str(p.Name)) continue; // county data has the odd blank row
      const kind = str(p.Road_Closure_Type) || "Closed";
      out.push({
        ...b, type: "road_closure", sev: /both directions|closed/i.test(kind) ? 2 : 1, status: kind,
        title: clip(`${str(p.Name)} — ${kind}`, 120),
        body: clip([where, str(p.Reason), str(p.Alternate_Route) && `Alternate: ${str(p.Alternate_Route)}`, str(p.Notes)].filter(Boolean).join(". "), 600),
        fields: { reason: str(p.Reason), alternate: str(p.Alternate_Route), editDate: str(p.EditDate) },
        hash: hashOf(kind, p.Reason, p.Notes, p.EditDate),
      });
    } else if (layer === "evacs") {
      if (!active) continue;
      const kind = str(p.Evacuation_Type) || "Evacuation";
      out.push({
        ...b, type: "evac", sev: 4, status: kind,
        title: clip(`${kind.toUpperCase()}: ${str(p.Name) || where}`, 120),
        body: clip([where, str(p.Reason), str(p.Notes)].filter(Boolean).join(". "), 600),
        fields: { reason: str(p.Reason), editDate: str(p.EditDate) },
        hash: hashOf(kind, p.Reason, p.Notes, p.EditDate),
      });
    } else if (layer === "hazards") {
      if (!active) continue;
      const kind = str(p.Hazard_Type) || "Hazard";
      out.push({
        ...b, type: "hazard", sev: 2, status: kind,
        title: clip(`${kind}: ${where || str(p.District)}`, 120),
        body: clip([str(p.Reason), str(p.Notes)].filter(Boolean).join(". "), 600),
        fields: { reason: str(p.Reason), editDate: str(p.EditDate) },
        hash: hashOf(kind, p.Reason, p.Notes, p.EditDate),
      });
    } else if (layer === "schools") {
      if (status !== "Closed") continue;
      out.push({
        ...b, type: "school", sev: 2, status,
        title: clip(`School closed: ${str(p.Name)}`, 120),
        body: clip([str(p.Closure_Reason), str(p.Notes), `${str(p.Address)}, ${str(p.City)}`].filter(Boolean).join(". "), 600),
        fields: { reason: str(p.Closure_Reason) },
        hash: hashOf(status, p.Closure_Reason, p.Notes, p.End_Date),
      });
    }
  }
  return out;
}
