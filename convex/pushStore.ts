import { internalMutation, internalQuery, mutation } from "./_generated/server";
import { v } from "convex/values";

export const forIsland = internalQuery({
  args: { island: v.string(), minSev: v.number() },
  handler: async (ctx, { island, minSev }) =>
    (await ctx.db.query("pushSubs").withIndex("by_island", (q) => q.eq("island", island)).collect()).filter((s) => s.minSev <= minSev),
});

export const lastSend = internalQuery({
  args: { island: v.string() },
  handler: (ctx, { island }) => ctx.db.query("pushLog").withIndex("by_island", (q) => q.eq("island", island)).order("desc").first(),
});

export const afterSend = internalMutation({
  args: { island: v.string(), trigger: v.string(), sent: v.number(), failed: v.number(), dead: v.array(v.string()), at: v.number() },
  handler: async (ctx, { island, trigger, sent, failed, dead, at }) => {
    await ctx.db.insert("pushLog", { island, at, trigger, sent, failed });
    for (const endpoint of dead) {
      const row = await ctx.db.query("pushSubs").withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint)).unique();
      if (row) await ctx.db.delete(row._id);
    }
  },
});

/** Called from http.ts. One row per endpoint; re-subscribing moves it to a new island. */
export const subscribe = mutation({
  args: { endpoint: v.string(), p256dh: v.string(), auth: v.string(), island: v.string(), minSev: v.number() },
  handler: async (ctx, a) => {
    if (!/^https:\/\//.test(a.endpoint) || a.endpoint.length > 2048) throw new Error("bad endpoint");
    if (!["hawaii", "maui", "oahu", "kauai"].includes(a.island)) throw new Error("bad island");
    const row = await ctx.db.query("pushSubs").withIndex("by_endpoint", (q) => q.eq("endpoint", a.endpoint)).unique();
    if (row) await ctx.db.patch(row._id, { ...a, failures: 0 });
    else await ctx.db.insert("pushSubs", { ...a, createdAt: Date.now(), failures: 0 });
  },
});

export const unsubscribe = mutation({
  args: { endpoint: v.string() },
  handler: async (ctx, { endpoint }) => {
    const row = await ctx.db.query("pushSubs").withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint)).unique();
    if (row) await ctx.db.delete(row._id);
  },
});
