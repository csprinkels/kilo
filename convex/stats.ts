import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/** Today's date in Hawaiʻi, YYYY-MM-DD — the bucket every count lands in. */
const hstDay = (now: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Pacific/Honolulu", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);

/**
 * Add to today's tallies. `events` is {name: howManyTimes}; each name is a screen view or a tap, added up across everyone.
 * Nothing here identifies a phone or a person — it is only "this happened N times today".
 */
export const bump = internalMutation({
  args: { events: v.record(v.string(), v.number()), at: v.number() },
  handler: async (ctx, { events, at }) => {
    const day = hstDay(at);
    for (const [event, n] of Object.entries(events)) {
      const inc = Math.max(0, Math.min(1000, Math.floor(n))); // clamp: a single post can only nudge a counter so far
      if (!inc || !event || event.length > 60) continue;
      const row = await ctx.db.query("stats").withIndex("by_day_event", (q) => q.eq("day", day).eq("event", event)).unique();
      if (row) await ctx.db.patch(row._id, { count: row.count + inc });
      else await ctx.db.insert("stats", { day, event, count: inc });
    }
  },
});

/** The last `days` days of counts, newest day first, for the moderator readout. */
export const recent = internalQuery({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, { days = 7 }) => {
    const cutoff = hstDay(Date.now() - (days - 1) * 86_400_000);
    const rows = (await ctx.db.query("stats").withIndex("by_day").collect()).filter((r) => r.day >= cutoff);
    // Roll up to per-event totals over the window and a per-day series, so the page can show both.
    const totals: Record<string, number> = {};
    const byDay: Record<string, Record<string, number>> = {};
    for (const r of rows) {
      totals[r.event] = (totals[r.event] ?? 0) + r.count;
      (byDay[r.day] ??= {})[r.event] = r.count;
    }
    return { since: cutoff, totals, byDay };
  },
});

/** Admin: wipe one day's counts (used to clear test data). Day is YYYY-MM-DD in Hawaiʻi time; omit for today. */
export const clearDay = internalMutation({
  args: { day: v.optional(v.string()) },
  handler: async (ctx, { day }) => {
    const d = day ?? hstDay(Date.now());
    const rows = await ctx.db.query("stats").withIndex("by_day", (q) => q.eq("day", d)).collect();
    for (const r of rows) await ctx.db.delete(r._id);
    return rows.length;
  },
});
