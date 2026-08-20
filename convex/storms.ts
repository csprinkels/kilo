import { internalAction, internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Storm, StormsSnapshot, TrackPoint } from "../lib/storm.ts";
import { CURRENT_STORMS_URL, archiveTcmUrl, parseTcm, parseTcp, preText, relevantStorms, type CurrentStorm } from "./parsers/storms.ts";
import { UA, publishToR2, putSnapshot } from "./ingest.ts";

const BACKFILL_PER_RUN = 6; // archived advisories fetched per cron tick while a storm's past track is incomplete

async function getText(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

/** Cron: read CurrentStorms.json; on a new advisory fetch + parse the text products; back-fill older advisories. */
export const refresh = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const current = relevantStorms(JSON.parse(await getText(CURRENT_STORMS_URL)) as { activeStorms?: CurrentStorm[] });
    const known = await ctx.runQuery(internal.storms.state, {});

    const updates: { storm: Omit<Storm, "track">; point: TrackPoint }[] = [];
    const backfill: { stormId: string; point: TrackPoint }[] = [];

    for (const cur of current) {
      const adv = Number(cur.forecastAdvisory?.advNum ?? cur.publicAdvisory?.advNum ?? 0);
      const prev = known.find((k) => k.stormId === cur.id);
      if (!prev || prev.advNum !== adv) {
        try {
          const tcm = parseTcm(preText(await getText(cur.forecastAdvisory!.url)));
          const tcp = cur.publicAdvisory ? parseTcp(preText(await getText(cur.publicAdvisory.url)), cur.name || tcm.name) : { warnings: [] };
          const storm: Omit<Storm, "track"> = {
            id: cur.id, ...tcm, name: cur.name || tcm.name, cls: cur.classification || tcm.cls,
            headline: tcp.headline, warnings: tcp.warnings,
            links: {
              public: cur.publicAdvisory?.url, forecast: cur.forecastAdvisory?.url, discussion: cur.forecastDiscussion?.url,
              graphics: cur.forecastGraphics?.url, cone: cur.trackCone?.kmzFile,
            },
          };
          updates.push({ storm, point: { at: tcm.issuedAt, lat: tcm.lat, lon: tcm.lon, windKt: tcm.windKt, adv: tcm.advNum, cls: tcm.cls } });
        } catch (e) {
          console.error(`[storms] ${cur.id} adv ${adv} failed:`, e);
        }
      }
      // Past track: fetch archived advisories we don't have yet, a few per tick.
      const have = new Set(prev?.advs ?? []);
      const missing = Array.from({ length: Math.max(0, adv - 1) }, (_, i) => i + 1).filter((a) => !have.has(a)).slice(0, BACKFILL_PER_RUN);
      for (const a of missing) {
        try {
          const t = parseTcm(preText(await getText(archiveTcmUrl(cur.id, a))));
          backfill.push({ stormId: cur.id, point: { at: t.issuedAt, lat: t.lat, lon: t.lon, windKt: t.windKt, adv: t.advNum, cls: t.cls } });
        } catch {
          backfill.push({ stormId: cur.id, point: { at: 0, lat: 0, lon: 0, windKt: 0, adv: a, cls: "MISSING" } }); // don't retry forever
        }
      }
    }

    const files = await ctx.runMutation(internal.storms.commit, { activeIds: current.map((s) => s.id), updates, backfill, now });
    await publishToR2(files);
  },
});

export const state = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("storms").withIndex("by_active", (q) => q.eq("active", true)).collect();
    const out = [];
    for (const r of rows) {
      const track = await ctx.db.query("stormTrack").withIndex("by_storm_adv", (q) => q.eq("stormId", r.stormId)).collect();
      out.push({ stormId: r.stormId, advNum: r.advNum, advs: track.map((t) => t.adv) });
    }
    return out;
  },
});

export const commit = internalMutation({
  args: { activeIds: v.array(v.string()), updates: v.array(v.any()), backfill: v.array(v.any()), now: v.number() },
  handler: async (ctx, { activeIds, updates, backfill, now }) => {
    for (const { storm, point } of updates as { storm: Omit<Storm, "track">; point: TrackPoint }[]) {
      const row = await ctx.db.query("storms").withIndex("by_stormId", (q) => q.eq("stormId", storm.id)).unique();
      if (row) await ctx.db.patch(row._id, { advNum: storm.advNum, data: storm, active: true, updatedAt: now });
      else await ctx.db.insert("storms", { stormId: storm.id, advNum: storm.advNum, data: storm, active: true, updatedAt: now });
      await upsertTrack(ctx, storm.id, point);
    }
    for (const { stormId, point } of backfill as { stormId: string; point: TrackPoint }[]) await upsertTrack(ctx, stormId, point);

    // Storms that vanished from CurrentStorms.json are over.
    for (const row of await ctx.db.query("storms").withIndex("by_active", (q) => q.eq("active", true)).collect()) {
      if (!activeIds.includes(row.stormId)) await ctx.db.patch(row._id, { active: false, updatedAt: now });
    }

    const storms: Storm[] = [];
    for (const row of await ctx.db.query("storms").withIndex("by_active", (q) => q.eq("active", true)).collect()) {
      const track = (await ctx.db.query("stormTrack").withIndex("by_storm_adv", (q) => q.eq("stormId", row.stormId)).collect())
        .filter((t) => t.cls !== "MISSING")
        .map(({ at, lat, lon, windKt, adv, cls }) => ({ at, lat, lon, windKt, adv, cls }));
      storms.push({ ...(row.data as Omit<Storm, "track">), track });
    }
    const snap: StormsSnapshot = { gen: now, storms };
    const body = JSON.stringify(snap);
    await putSnapshot(ctx, "v1/storms.json", body, now);
    return [{ path: "v1/storms.json", body }];
  },
});

async function upsertTrack(ctx: MutationCtx, stormId: string, p: TrackPoint) {
  const row = await ctx.db.query("stormTrack").withIndex("by_storm_adv", (q) => q.eq("stormId", stormId).eq("adv", p.adv)).unique();
  if (row) await ctx.db.patch(row._id, p);
  else await ctx.db.insert("stormTrack", { stormId, ...p });
}
