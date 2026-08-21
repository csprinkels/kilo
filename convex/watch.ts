import { internalAction, internalMutation, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { SourceHealth } from "../lib/types.ts";
import { SNAPSHOT, fresh, snapshotStep, sourceStep, type WatchState } from "../lib/watchRules.ts";

async function save(ctx: MutationCtx, source: string, next: WatchState) {
  const row = await ctx.db.query("watch").withIndex("by_source", (q) => q.eq("source", source)).unique();
  if (row) await ctx.db.patch(row._id, { failsInRow: next.failsInRow, lastOk: next.lastOk, lastAlertAt: next.lastAlertAt });
  else await ctx.db.insert("watch", next);
}

async function load(ctx: MutationCtx, source: string, now: number): Promise<WatchState> {
  const row = await ctx.db.query("watch").withIndex("by_source", (q) => q.eq("source", source)).unique();
  return row ? { source, failsInRow: row.failsInRow, lastOk: row.lastOk, lastAlertAt: row.lastAlertAt } : fresh(source, now);
}

/** Fold one ingest run's health into the watch table; returns the texts the owner should be pushed right now. */
export const record = internalMutation({
  args: { health: v.any(), now: v.number() },
  handler: async (ctx, { health, now }) => {
    const alerts: string[] = [];
    for (const [source, h] of Object.entries(health as Record<string, SourceHealth>)) {
      const { next, alert } = sourceStep(await load(ctx, source, now), h.ok, h.error, now);
      await save(ctx, source, next);
      if (alert) alerts.push(alert);
    }
    return alerts;
  },
});

export const recordSnapshot = internalMutation({
  args: { gen: v.number(), now: v.number() },
  handler: async (ctx, { gen, now }) => {
    const { next, alert } = snapshotStep(await load(ctx, SNAPSHOT, now), gen, now);
    await save(ctx, SNAPSHOT, next);
    return alert;
  },
});

/** Cron: is the manifest still being rebuilt? Source failures are reported from ingest.run itself. */
export const check = internalAction({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.runQuery(internal.ingest.getSnapshot, { path: "v1/manifest.json" });
    if (!row) return;
    const alert = await ctx.runMutation(internal.watch.recordSnapshot, { gen: row.gen, now: Date.now() });
    if (alert) await ctx.runAction(internal.push.sendModerator, { text: alert });
  },
});
