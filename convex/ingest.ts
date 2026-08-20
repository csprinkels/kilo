import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { AwsClient } from "aws4fetch";
import { ISLANDS, hashOf, type Island, type Item, type Manifest, type Snapshot, type SourceHealth } from "../lib/types.ts";
import { NWS_URL, WATCH_EVENTS, parseNws } from "./parsers/nws.ts";
import { HCCDA_LAYERS, parseHccda, type HccdaLayer } from "./parsers/hccda.ts";

const UA = "HawaiiCommunityApp/0.1 (aloha@csprinkels.com)";
const FETCH_TIMEOUT_MS = 8_000;
const MAX_ITEMS_PER_SNAPSHOT = 200;

// One entry per upstream feed. `source` groups items so a failed fetch never deactivates its own rows.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Parse = (json: any, now: number) => Item[];
const SOURCES: { id: string; source: string; url: string; parse: Parse }[] = [
  { id: "nws", source: "nws", url: NWS_URL, parse: parseNws },
  ...(Object.keys(HCCDA_LAYERS) as HccdaLayer[]).map((layer) => ({
    id: `hccda:${layer}`,
    source: `hccda:${layer}`,
    url: HCCDA_LAYERS[layer],
    parse: ((json, now) => parseHccda(layer, json, now)) as Parse,
  })),
];

async function fetchJson(url: string) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/geo+json, application/json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Cron entry point: fetch every source, upsert, rebuild snapshots, mirror to R2. */
export const run = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const results = await Promise.allSettled(
      SOURCES.map(async (s) => ({ s, items: s.parse(await fetchJson(s.url), now) })),
    );
    const health: Record<string, SourceHealth> = {};
    const batches: { source: string; items: Item[] }[] = [];
    results.forEach((r, i) => {
      const id = SOURCES[i].id;
      if (r.status === "fulfilled") {
        health[id] = { ok: true, at: now, count: r.value.items.length };
        batches.push({ source: r.value.s.source, items: r.value.items });
      } else {
        health[id] = { ok: false, at: now, count: 0, error: String(r.reason?.message ?? r.reason).slice(0, 200) };
        console.error(`[ingest] ${id} failed:`, r.reason);
      }
    });

    const snapshots = await ctx.runMutation(internal.ingest.commit, { batches, health, now });
    await publishToR2(snapshots);
  },
});

/** Upsert each source's items, deactivate the ones it stopped listing, rebuild every snapshot. */
export const commit = internalMutation({
  args: {
    batches: v.array(v.object({ source: v.string(), items: v.array(v.any()) })),
    health: v.any(),
    now: v.number(),
  },
  handler: async (ctx, { batches, health, now }) => {
    for (const { source, items } of batches) {
      const existing = await ctx.db.query("items").withIndex("by_source_active", (q) => q.eq("source", source).eq("active", true)).collect();
      const seen = new Set<string>();
      for (const item of items as Item[]) {
        seen.add(item.key);
        const row = await ctx.db.query("items").withIndex("by_key", (q) => q.eq("key", item.key)).unique();
        if (!row) await ctx.db.insert("items", { ...item, active: true });
        else if (row.hash !== item.hash || !row.active) await ctx.db.patch(row._id, { ...item, issuedAt: row.active ? row.issuedAt : item.issuedAt, active: true });
        else await ctx.db.patch(row._id, { lastConfirmedAt: now, expiresAt: item.expiresAt });
      }
      for (const row of existing) if (!seen.has(row.key)) await ctx.db.patch(row._id, { active: false });
    }

    // Rebuild snapshots from everything still active and unexpired.
    const active = (await ctx.db.query("items").withIndex("by_active", (q) => q.eq("active", true)).collect())
      .filter((r) => !r.expiresAt || r.expiresAt > now);
    const toItem = ({ _id, _creationTime, active: _a, ...rest }: (typeof active)[number]) => rest as Item;
    const mode: Manifest["mode"] = active.some((r) => WATCH_EVENTS.test(r.fields?.event ?? "")) ? "watch" : "normal";

    const out: { path: string; body: string }[] = [];
    const vmap = {} as Record<Island, number>;
    for (const island of [...ISLANDS, "state" as const]) {
      const items = active
        .filter((r) => island === "state" || r.islands.includes(island) || r.islands.includes("state"))
        .sort((a, b) => b.sev - a.sev || b.issuedAt - a.issuedAt)
        .slice(0, MAX_ITEMS_PER_SNAPSHOT)
        .map(toItem);
      const snap: Snapshot = { gen: now, island, items };
      vmap[island] = now;
      out.push({ path: `v1/${island}.json`, body: JSON.stringify(snap) });
    }
    const manifest: Manifest = { gen: now, mode, v: vmap, sources: health };
    out.push({ path: "v1/manifest.json", body: JSON.stringify(manifest) });

    for (const { path, body } of out) {
      const etag = `"${hashOf(body)}"`;
      const row = await ctx.db.query("snapshots").withIndex("by_path", (q) => q.eq("path", path)).unique();
      if (row) await ctx.db.patch(row._id, { body, etag, gen: now });
      else await ctx.db.insert("snapshots", { path, body, etag, gen: now });
    }
    return out;
  },
});

export const getSnapshot = internalQuery({
  args: { path: v.string() },
  handler: (ctx, { path }) => ctx.db.query("snapshots").withIndex("by_path", (q) => q.eq("path", path)).unique(),
});

/** Mirror snapshots to Cloudflare R2 when configured; silently skipped in dev. */
async function publishToR2(files: { path: string; body: string }[]) {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) return;
  const r2 = new AwsClient({ accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, service: "s3", region: "auto" });
  const base = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}`;
  await Promise.all(
    files.map(async ({ path, body }) => {
      const res = await r2.fetch(`${base}/${path}`, {
        method: "PUT",
        body,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          // Served stale for up to 7 days if the origin is down. Needs a CF Cache Rule to take effect.
          "Cache-Control": "public, max-age=30, stale-while-revalidate=3600, stale-if-error=604800",
        },
      });
      if (!res.ok) console.error(`[r2] PUT ${path} -> ${res.status} ${await res.text()}`);
    }),
  );
}
