// Shared between convex/ (producer) and app/ (consumer). Same shape in DB and JSON.
export type Island = "hawaii" | "maui" | "oahu" | "kauai" | "state";
export const ISLANDS: Exclude<Island, "state">[] = ["hawaii", "maui", "oahu", "kauai"];

export type ItemType =
  | "advisory" | "storm" | "tsunami" | "quake" | "volcano" | "notice"
  | "shelter" | "road_closure" | "evac" | "hazard" | "school" | "outage";

export type Item = {
  key: string;                       // `${source}:${externalId}` — idempotent upsert
  source: string;
  type: ItemType;
  tier: "official" | "vetted" | "community";
  sev: 1 | 2 | 3 | 4;                // 4 = life-safety
  islands: Island[];                 // which island snapshots carry it ("state" = all)
  districts: string[];               // Hawaii County judicial districts etc.; [] = whole island
  title: string;                     // <=120
  body: string;                      // <=600, plain text
  srcUrl: string;
  lat?: number;
  lon?: number;
  status?: string;                   // shelter Open/Full/Closed; road Closed/One Lane Open ...
  fields?: Record<string, string>;
  issuedAt: number;
  lastConfirmedAt: number;           // last time the source feed still listed it
  expiresAt?: number;
  hash: string;                      // change detector
};

export type Snapshot = { gen: number; island: Island; items: Item[] };

export type SourceHealth = { ok: boolean; at: number; count: number; error?: string };

export type Manifest = {
  gen: number;
  mode: "normal" | "watch";
  v: Record<Island, number>;         // snapshot gen per island
  sources: Record<string, SourceHealth>;
};

export const clip = (s: string | null | undefined, n: number) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
};

export const hashOf = (...parts: (string | number | undefined | null)[]) => {
  // FNV-1a, 32-bit: good enough for "did this row change"
  let h = 0x811c9dc5;
  for (const ch of parts.join(" ")) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
};
