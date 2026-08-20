// Shared between convex/ (producer) and app/ (consumer). Same shape in DB and JSON.
export type Island = "hawaii" | "maui" | "oahu" | "kauai" | "state";
export const ISLANDS: Exclude<Island, "state">[] = ["hawaii", "maui", "oahu", "kauai"];

export type ItemType =
  | "advisory" | "storm" | "tsunami" | "quake" | "volcano" | "notice"
  | "shelter" | "road_closure" | "evac" | "hazard" | "school" | "outage" | "traffic";

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

// ---------- bad-signal delivery ----------
/** <=1.5 KB per island: what a person needs in the next few hours, fetched FIRST on a weak connection. */
export type Essentials = {
  v: 1;
  island: Island;
  gen: number;
  mode: Manifest["mode"];
  sev: number;                       // highest active severity (0 = nothing active)
  hl: string;                        // one-line headline
  alerts: { h: string; sev: number; type: ItemType; title: string; at: number }[]; // <=8, titles only; h = hashOf(key)
  shelters: [name: string, address: string, status: string][];                       // <=6
  ok: [sourcesOk: number, sourcesTotal: number];
};

/** Push payload: the island DIGEST (APNs keeps only one stored notification per app while a phone is unreachable). */
export type DigestItem = Pick<Item, "key" | "sev" | "type" | "title" | "srcUrl" | "issuedAt" | "districts"> & { body: string };
export type Digest = { v: 1; island: Island; gen: number; trigger: string; top: DigestItem[] };

export const ESSENTIALS_BUDGET = 1500;   // bytes, raw JSON
export const DIGEST_BUDGET = 3500;       // bytes, whole push payload

export function buildEssentials(island: Island, items: Item[], gen: number, mode: Manifest["mode"], ok: [number, number]): Essentials {
  const top = items.slice(0, 8);
  const shelters = items.filter((i) => i.type === "shelter").slice(0, 6)
    .map((i): [string, string, string] => [clip(i.title.replace(/^Shelter \w+: /, ""), 40), clip(`${i.fields?.address ?? ""}${i.fields?.city ? ", " + i.fields.city : ""}`, 48), i.status ?? ""]);
  return {
    v: 1, island, gen, mode,
    sev: items[0]?.sev ?? 0,
    hl: clip(items[0]?.title ?? "Nothing active", 90),
    alerts: top.map((i) => ({ h: hashOf(i.key), sev: i.sev, type: i.type, title: clip(i.title, 64), at: i.issuedAt })),
    shelters,
    ok,
  };
}

export function buildDigest(island: Island, items: Item[], gen: number, trigger: string): Digest {
  const lead = items.find((i) => i.key === trigger);
  const rest = items.filter((i) => i.key !== trigger && i.sev >= 2).slice(0, 4);
  // Lead item gets its full body (the decision); the rest are headlines with a short body. srcUrl only on the lead:
  // NWS URNs alone are ~100 bytes each and the payload must stay under the 4 KB push limit.
  const pick = (i: Item, bodyLen: number, withUrl: boolean): DigestItem => ({
    key: i.key, sev: i.sev, type: i.type, title: clip(i.title, 90), body: clip(i.body, bodyLen),
    srcUrl: withUrl ? i.srcUrl : "", issuedAt: i.issuedAt, districts: i.districts.slice(0, 1),
  });
  return { v: 1, island, gen, trigger, top: [...(lead ? [pick(lead, 600, true)] : []), ...rest.map((i) => pick(i, 120, false))] };
}

/** GSM-7-safe text that fits one SMS segment (153 chars), so a person WITH signal can forward an alert to one without. */
export function smsText(i: Pick<Item, "title" | "body" | "issuedAt">): string {
  const ascii = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")           // kahakō etc. -> base vowel
      .replace(/[\u02BB\u2018\u2019`\u00B4]/g, "'").replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2014\u2013]/g, "-").replace(/\u2026/g, "...").replace(/\u00B7/g, "-")
      .replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim();
  const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 3).trimEnd() + "..." : s);
  const hst = new Intl.DateTimeFormat("en-US", { timeZone: "Pacific/Honolulu", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })
    .format(i.issuedAt).replace(",", "").replace(/ (AM|PM)$/, "$1");
  const head = `${hst} ${ascii(i.title)}`;
  const room = 153 - head.length - 1;
  return room > 20 ? `${head} ${cut(ascii(i.body), room)}` : cut(head, 153);
}
