import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[a-z]{2,}$/i;
const ISLANDS = new Set(["hawaii", "maui", "oahu", "kauai", "other"]);

/** One row per email; signing up twice is fine and says so. */
export const join = internalMutation({
  args: { email: v.string(), island: v.optional(v.string()), source: v.string() },
  handler: async (ctx, { email, island, source }) => {
    const e = email.trim().toLowerCase();
    if (!EMAIL.test(e)) throw new ConvexError({ code: 400, message: "That does not look like an email address." });
    const isl = island && ISLANDS.has(island) ? island : undefined;
    const have = await ctx.db.query("waitlist").withIndex("by_email", (q) => q.eq("email", e)).unique();
    if (have) return { ok: true, already: true };
    await ctx.db.insert("waitlist", { email: e, island: isl, createdAt: Date.now(), source: source.slice(0, 40) });
    return { ok: true, already: false };
  },
});

/** For the moderator page: how many, and the list as rows (newest first). */
export const list = internalQuery({
  args: {},
  handler: async (ctx) => (await ctx.db.query("waitlist").collect()).sort((a, b) => b.createdAt - a.createdAt).map((r) => ({ email: r.email, island: r.island ?? "", at: r.createdAt })),
});
