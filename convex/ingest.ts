import { internalAction, internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { AwsClient } from "aws4fetch";
import { ISLANDS, buildEssentials, hashOf, type Island, type Item, type Manifest, type Snapshot, type SourceHealth } from "../lib/types.ts";
import { NWS_URL, WATCH_EVENTS, parseNws } from "./parsers/nws.ts";
import { HCCDA_LAYERS, parseHccda, type HccdaLayer } from "./parsers/hccda.ts";
import { HDOT_URL, HIEMA_URL, HNL_TRAFFIC_URL, HPD_URL, HVO_URL, PTWC_URL, USGS_URL, parseHdot, parseHiema, parseHnlTraffic, parseHpd, parseHvo, parsePtwc, parseUsgs, HIDWS_URL, parseDws } from "./parsers/feeds.ts";
import { districtFor } from "../lib/places.ts";
import { plainAlert } from "../lib/plain.ts";
import { reportToItem } from "../lib/reportRules.ts";

export const UA = "Kilo/0.1 (kilohawaii.app; aloha@csprinkels.com)";
const BROWSER_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const FETCH_TIMEOUT_MS = 8_000;
const MAX_ITEMS_PER_SNAPSHOT = 200;

// One entry per upstream feed. `source` groups items so a failed fetch never deactivates its own rows.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Parse = (body: any, now: number) => Item[];
type Source = { id: string; url: string; parse: Parse; text?: true; browserUA?: true; timeoutMs?: number }; // browserUA: WordPress hosts that 403 bots
export const SOURCES: Source[] = [
  { id: "nws", url: NWS_URL, parse: parseNws },
  ...(Object.keys(HCCDA_LAYERS) as HccdaLayer[]).map((layer) => ({
    id: `hccda:${layer}`,
    url: HCCDA_LAYERS[layer],
    parse: ((json, now) => parseHccda(layer, json, now)) as Parse,
  })),
  { id: "usgs", url: USGS_URL, parse: parseUsgs },
  { id: "hvo", url: HVO_URL, parse: parseHvo },
  { id: "hdot", url: HDOT_URL, parse: parseHdot },
  { id: "hiema", url: HIEMA_URL, parse: parseHiema, text: true },
  { id: "hpd", url: HPD_URL, parse: (rss, now) => parseHpd(rss, now, (t) => { const d = districtFor(t); return d ? [d] : []; }), text: true, browserUA: true },
  { id: "hidws", url: HIDWS_URL, parse: parseDws, text: true, browserUA: true },
  { id: "ptwc", url: PTWC_URL, parse: parsePtwc, text: true },
  { id: "hnl", url: HNL_TRAFFIC_URL, parse: parseHnlTraffic, timeoutMs: 20_000 }, // Socrata is slow some minutes
];

async function fetchBody(s: Source) {
  const res = await fetch(s.url, {
    headers: { "User-Agent": s.browserUA ? BROWSER_UA : UA, Accept: s.text ? "application/rss+xml, application/atom+xml, application/xml, text/xml" : "application/geo+json, application/json" },
    signal: AbortSignal.timeout(s.timeoutMs ?? FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return s.text ? res.text() : res.json();
}

/** Cron entry point: fetch every source, upsert, rebuild snapshots, mirror to R2. */
export const run = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const results = await Promise.allSettled(
      SOURCES.map(async (s) => ({ s, items: s.parse(await fetchBody(s), now) })),
    );
    const health: Record<string, SourceHealth> = {};
    const batches: { source: string; items: Item[] }[] = [];
    results.forEach((r, i) => {
      const id = SOURCES[i].id;
      if (r.status === "fulfilled") {
        health[id] = { ok: true, at: now, count: r.value.items.length };
        batches.push({ source: r.value.s.id, items: r.value.items });
      } else {
        health[id] = { ok: false, at: now, count: 0, error: String(r.reason?.message ?? r.reason).slice(0, 200) };
        console.error(`[ingest] ${id} failed:`, r.reason);
      }
    });

    const snapshots = await ctx.runMutation(internal.ingest.commit, { batches, health, now });
    await publishToR2(snapshots);
    for (const text of await ctx.runMutation(internal.watch.record, { health, now })) await ctx.runAction(internal.push.sendModerator, { text });
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
    const fresh = new Set<string>(); // keys that are new (or came back) this run: push triggers
    for (const { source, items } of batches) {
      const existing = await ctx.db.query("items").withIndex("by_source_active", (q) => q.eq("source", source).eq("active", true)).collect();
      const seen = new Set<string>();
      for (const item of items as Item[]) {
        seen.add(item.key);
        const row = await ctx.db.query("items").withIndex("by_key", (q) => q.eq("key", item.key)).unique();
        if (!row) { await ctx.db.insert("items", { ...item, active: true }); fresh.add(item.key); }
        else if (row.hash !== item.hash || !row.active) { await ctx.db.patch(row._id, { ...item, issuedAt: row.active ? row.issuedAt : item.issuedAt, active: true }); if (!row.active) fresh.add(item.key); }
        else await ctx.db.patch(row._id, { lastConfirmedAt: now, expiresAt: item.expiresAt });
      }
      for (const row of existing) if (!seen.has(row.key)) await ctx.db.patch(row._id, { active: false });
    }

    // Rebuild snapshots from everything still active and unexpired, plus live community reports (sev <= 2 by construction).
    const active = (await ctx.db.query("items").withIndex("by_active", (q) => q.eq("active", true)).collect())
      .filter((r) => !r.expiresAt || r.expiresAt > now);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const toItem = ({ _id, _creationTime, active: _a, ...rest }: (typeof active)[number]) => rest as Item;
    const community = (await ctx.db.query("reports").withIndex("by_status", (q) => q.eq("status", "live")).collect())
      .filter((r) => r.expiresAt > now)
      .map((r) => reportToItem({ ...r, _id: r._id as string } as never));
    const mode: Manifest["mode"] = active.some((r) => WATCH_EVENTS.test(r.fields?.event ?? "")) ? "watch" : "normal";
    const okCount = Object.values(health as Record<string, SourceHealth>).filter((h) => h.ok).length;
    const srcTotal = Object.keys(health as object).length;

    const out: { path: string; body: string }[] = [];
    const vmap = {} as Record<Island, number>;
    const triggers: { island: Island; key: string; level: number }[] = [];
    for (const island of [...ISLANDS, "state" as const]) {
      const items = [
        ...active.filter((r) => island === "state" || r.islands.includes(island) || r.islands.includes("state")).map(toItem),
        ...community.filter((c) => island === "state" || c.islands.includes(island)),
      ]
        .sort((a, b) => b.sev - a.sev || b.issuedAt - a.issuedAt)
        .slice(0, MAX_ITEMS_PER_SNAPSHOT);
      const snap: Snapshot = { gen: now, island, items };
      vmap[island] = now;
      out.push({ path: `v1/${island}.json`, body: JSON.stringify(snap) });
      out.push({ path: `v1/${island}/essentials.json`, body: JSON.stringify(buildEssentials(island, items, now, mode, [okCount, srcTotal])) });
      // A new item the Now page would show as a warning is worth a push (the highest one if several).
      // Rank on plainAlert().level, the same number the page ranks on — never on the feed's own `sev`.
      // They disagree (a M5 quake and an erupting volcano are sev 3 but level 2 and 1), and when push
      // used `sev` a notification could point at an item the page then refused to render.
      if (island !== "state") {
        // Wrapped because this whole mutation is one transaction: a template that throws must cost us the
        // notification, never the snapshot. Same reason each source's fetch is isolated up in `run`.
        const levelOf = (i: Item) => {
          try { return plainAlert(i, now, island).level; } catch (e) { console.error(`[ingest] plainAlert ${i.key}:`, e); return 0; }
        };
        const lead = items.find((i) => fresh.has(i.key) && levelOf(i) >= 3);
        if (lead) triggers.push({ island, key: lead.key, level: levelOf(lead) });
      }
    }
    for (const t of triggers) await ctx.scheduler.runAfter(0, internal.push.sendDigest, { island: t.island, trigger: t.key, level: t.level });
    const manifest: Manifest = { gen: now, mode, v: vmap, sources: health };
    out.push({ path: "v1/manifest.json", body: JSON.stringify(manifest) });

    for (const { path, body } of out) await putSnapshot(ctx, path, body, now);
    return out;
  },
});

/** Cron: delete feed items the source dropped 30+ days ago. Active rows are never touched; anything younger stays so
 *  a row re-listed within a month keeps its original issuedAt (see commit). Community reports live in `reports`
 *  and are purged by reports.expire, not here. */
export const purge = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Age by lastConfirmedAt (when the source last listed it), not issuedAt: a long-running alert that just ended must wait the full 30 days.
    const cutoff = Date.now() - 30 * 24 * 3_600_000;
    // ponytail: 500 per daily run is far above the ~150/day deactivation rate; self-reschedule if a backlog ever forms.
    // Index range, not collect+filter: inactive rows carry road paths and would blow the per-mutation read limit in a month.
    const stale = await ctx.db.query("items").withIndex("by_active_confirmed", (q) => q.eq("active", false).lt("lastConfirmedAt", cutoff)).take(500);
    for (const r of stale) await ctx.db.delete(r._id);
    return stale.length;
  },
});

export async function putSnapshot(ctx: MutationCtx, path: string, body: string, gen: number) {
  const etag = `"${hashOf(body)}"`;
  const row = await ctx.db.query("snapshots").withIndex("by_path", (q) => q.eq("path", path)).unique();
  if (row) await ctx.db.patch(row._id, { body, etag, gen });
  else await ctx.db.insert("snapshots", { path, body, etag, gen });
}

export const getSnapshot = internalQuery({
  args: { path: v.string() },
  handler: (ctx, { path }) => ctx.db.query("snapshots").withIndex("by_path", (q) => q.eq("path", path)).unique(),
});

/** Mirror snapshots to Cloudflare R2 when configured; silently skipped in dev. */
export async function publishToR2(files: { path: string; body: string }[]) {
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
