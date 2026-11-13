import { internalMutation, internalQuery, mutation } from "./_generated/server";
import { v } from "convex/values";

export const forIsland = internalQuery({
  args: { island: v.string(), minSev: v.number() },
  handler: async (ctx, { island, minSev }) =>
    (await ctx.db.query("pushSubs").withIndex("by_island", (q) => q.eq("island", island)).collect()).filter((s) => s.minSev <= minSev),
});

/** This island's log since `since`, newest first: what lib/pushRules.ts decides on. */
export const recent = internalQuery({
  args: { island: v.string(), since: v.number() },
  // shortcut: reads the newest 200 rows, upgrade to a by_island_at index if an island ever logs more than that in 6 hours
  handler: async (ctx, { island, since }) =>
    (await ctx.db.query("pushLog").withIndex("by_island", (q) => q.eq("island", island)).order("desc").take(200)).filter((r) => r.at >= since),
});

/** Hand over every warning waiting for the gap to end and clear the flag in one transaction, so two deferred runs cannot both send. */
export const takeHeld = internalMutation({
  args: { island: v.string() },
  handler: async (ctx, { island }) => {
    const held = (await ctx.db.query("pushLog").withIndex("by_island", (q) => q.eq("island", island)).order("desc").take(200)).filter((r) => r.held);
    for (const r of held) await ctx.db.patch(r._id, { held: false });
    return held;
  },
});

export const afterSend = internalMutation({
  args: { island: v.string(), trigger: v.string(), sent: v.number(), failed: v.number(), dead: v.array(v.string()), at: v.number(), kind: v.optional(v.string()), level: v.optional(v.number()), held: v.optional(v.boolean()), until: v.optional(v.number()) },
  handler: async (ctx, { dead, ...row }) => {
    await ctx.db.insert("pushLog", row);
    for (const endpoint of dead) {
      const row = await ctx.db.query("pushSubs").withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint)).unique();
      if (row) await ctx.db.delete(row._id);
    }
  },
});

/** Called from http.ts. One row per endpoint (device token for apns/fcm); re-subscribing moves it to a new island. */
export const subscribe = mutation({
  args: { endpoint: v.string(), p256dh: v.string(), auth: v.string(), island: v.string(), minSev: v.number(), kind: v.optional(v.string()), modKey: v.optional(v.string()) },
  handler: async (ctx, { modKey, ...a }) => {
    if (a.kind !== undefined && !["apns", "fcm"].includes(a.kind)) throw new Error("bad kind");
    if (a.kind ? !/^[A-Za-z0-9:_-]{1,512}$/.test(a.endpoint) : !/^https:\/\//.test(a.endpoint) || a.endpoint.length > 2048) throw new Error("bad endpoint");
    // "mod" is the owner's phone: its notes quote held reports (names, plates), so it takes the moderator key.
    if (a.island === "mod" ? !process.env.MOD_KEY || modKey !== process.env.MOD_KEY : !["hawaii", "maui", "oahu", "kauai"].includes(a.island)) throw new Error("bad island");
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
