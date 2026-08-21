import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import {
  DEVICE_DAILY_CAP, DISTRICT_HOURLY_CAP, FLAGS_TO_REVIEW, HELD_BY_DEFAULT, REPORT_TYPES, VOTES_DAILY_CAP,
  afterVote, clean, holdReason, validateReport, type ReportType,
} from "../lib/reportRules.ts";

const HOUR = 3_600_000, DAY = 24 * HOUR;

/** Validate, rate-limit, auto-hold, merge-or-insert. Called only from the HTTP action after bot checks. */
export const submit = internalMutation({
  args: { type: v.string(), text: v.string(), locText: v.string(), island: v.string(), district: v.string(), deviceHash: v.string() },
  handler: async (ctx, a) => {
    const now = Date.now();
    const text = clean(a.text), locText = clean(a.locText);
    const err = validateReport({ ...a, text, locText });
    if (err) throw new ConvexError({ code: 400, message: err });

    // Flood brake per district (unforgeable) + per-device daily cap (honest-user guard; device ids are client-minted).
    const recentDistrict = await ctx.db.query("reports").withIndex("by_district_type_created", (q) => q.eq("district", a.district).eq("type", a.type).gt("createdAt", now - HOUR)).collect();
    const recentAll = [
      ...(await ctx.db.query("reports").withIndex("by_status", (q) => q.eq("status", "live")).collect()),
      ...(await ctx.db.query("reports").withIndex("by_status", (q) => q.eq("status", "pending")).collect()),
    ]; // small table; count this district's last hour across types
    if (recentAll.filter((r) => r.district === a.district && r.createdAt > now - HOUR).length >= DISTRICT_HOURLY_CAP) throw new ConvexError({ code: 429, message: "Too many reports for this district right now. Try again in a bit." });
    const mine = await ctx.db.query("reports").withIndex("by_device_created", (q) => q.eq("deviceHash", a.deviceHash).gt("createdAt", now - DAY)).collect();
    if (mine.length >= DEVICE_DAILY_CAP) throw new ConvexError({ code: 429, message: "You've hit today's limit of reports. Thank you for helping." });
    if (mine.some((r) => r.text === text && r.locText === locText)) throw new ConvexError({ code: 409, message: "You already sent this one." });

    // Same district + type within 30 minutes: count it as a confirmation instead of a duplicate row.
    const twin = recentDistrict.find((r) => r.status === "live" && r.createdAt > now - 30 * 60_000);
    if (twin) {
      if (!twin.voters.includes(a.deviceHash)) {
        await ctx.db.patch(twin._id, {
          confirmCount: twin.confirmCount + 1, lastConfirmedAt: now, voters: [...twin.voters, a.deviceHash],
          expiresAt: afterVote("still", twin as never, now),
        });
      }
      return { id: twin._id, status: "live", merged: true, expiresAt: twin.expiresAt };
    }

    const reason = holdReason(`${text} ${locText}`);
    const held = !!reason || HELD_BY_DEFAULT.includes(a.type as ReportType);
    const expiresAt = now + REPORT_TYPES[a.type as ReportType].ttlMs;
    const id = await ctx.db.insert("reports", {
      type: a.type, text, locText, island: a.island, district: a.district,
      status: held ? "pending" : "live", holdReason: reason ?? (held ? "review" : undefined),
      deviceHash: a.deviceHash, confirmCount: 0, goneCount: 0, flagCount: 0, voters: [],
      createdAt: now, lastConfirmedAt: now, expiresAt,
    });
    // Tell whoever moderates that something is waiting (no-op until a moderator has subscribed).
    if (held) await ctx.scheduler.runAfter(0, internal.push.sendModerator, { text: `${a.type.replace(/_/g, " ")} · ${locText || a.district}: ${text.slice(0, 80)}` });
    return { id, status: held ? "pending" : "live", merged: false, expiresAt, holdReason: reason };
  },
});

export const vote = internalMutation({
  args: { id: v.id("reports"), vote: v.union(v.literal("still"), v.literal("gone"), v.literal("flag")), deviceHash: v.string() },
  handler: async (ctx, { id, vote, deviceHash }) => {
    const now = Date.now();
    const r = await ctx.db.get(id);
    if (!r || r.status !== "live") throw new ConvexError({ code: 404, message: "That report is no longer active." });
    if (r.voters.includes(deviceHash)) return { ok: true, dup: true };
    const myVotesToday = (await ctx.db.query("reports").withIndex("by_status", (q) => q.eq("status", "live")).collect())
      .filter((x) => x.voters.includes(deviceHash) && x.lastConfirmedAt > now - DAY).length;
    if (myVotesToday >= VOTES_DAILY_CAP) throw new ConvexError({ code: 429, message: "That's plenty of votes for today." });

    const patch: Record<string, unknown> = { voters: [...r.voters, deviceHash] };
    if (vote === "still") { patch.confirmCount = r.confirmCount + 1; patch.lastConfirmedAt = now; patch.expiresAt = afterVote("still", r as never, now); }
    if (vote === "gone") { patch.goneCount = r.goneCount + 1; if (r.goneCount + 1 >= 3) patch.expiresAt = afterVote("gone", r as never, now); }
    if (vote === "flag") {
      patch.flagCount = r.flagCount + 1;
      // Flags send a report back to human review (not straight to hidden) and only when flags outnumber confirmations.
      if (r.flagCount + 1 >= FLAGS_TO_REVIEW && r.flagCount + 1 > r.confirmCount) { patch.status = "pending"; patch.holdReason = "flagged"; }
    }
    await ctx.db.patch(id, patch);
    return { ok: true };
  },
});

/** Cron: live AND pending rows past their expiry are closed (so an unattended review queue drains itself); old rows purged. */
export const expire = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    for (const status of ["live", "pending"] as const) {
      for (const r of await ctx.db.query("reports").withIndex("by_status", (q) => q.eq("status", status)).collect()) {
        if (r.expiresAt <= now) await ctx.db.patch(r._id, { status: "expired" });
      }
    }
    for (const status of ["expired", "hidden"] as const) {
      for (const r of await ctx.db.query("reports").withIndex("by_status", (q) => q.eq("status", status)).collect()) {
        if (r.expiresAt < now - 30 * DAY) await ctx.db.delete(r._id);
      }
    }
  },
});

// ---- moderation: one person, one key (MOD_KEY in the Convex env), checked in the HTTP route ----

/** What the moderator sees: everything held, plus what went live in the last day (so a bad one can be pulled). */
export const forModerator = internalQuery({
  args: {},
  handler: async (ctx) => {
    const since = Date.now() - DAY;
    const pending = await ctx.db.query("reports").withIndex("by_status", (q) => q.eq("status", "pending")).collect();
    const live = (await ctx.db.query("reports").withIndex("by_status", (q) => q.eq("status", "live")).collect()).filter((r) => r.createdAt > since);
    const pick = (r: (typeof pending)[number]) => ({
      id: r._id, type: r.type, text: r.text, locText: r.locText, island: r.island, district: r.district, status: r.status,
      holdReason: r.holdReason, createdAt: r.createdAt, expiresAt: r.expiresAt, confirms: r.confirmCount, flags: r.flagCount,
    });
    return { pending: pending.sort((a, b) => b.createdAt - a.createdAt).map(pick), live: live.sort((a, b) => b.createdAt - a.createdAt).map(pick) };
  },
});

/** Show (pending → live) or hide (anything → hidden). A shown report gets a fresh 6 hours from now, not from when it was written. */
export const moderate = internalMutation({
  args: { id: v.id("reports"), action: v.union(v.literal("show"), v.literal("hide")) },
  handler: async (ctx, { id, action }) => {
    const r = await ctx.db.get(id);
    if (!r) throw new ConvexError({ code: 404, message: "That report is gone." });
    const now = Date.now();
    if (action === "show") await ctx.db.patch(id, { status: "live", holdReason: undefined, lastConfirmedAt: now, expiresAt: Math.max(r.expiresAt, now + 6 * HOUR) });
    else await ctx.db.patch(id, { status: "hidden" });
    return { id, status: action === "show" ? "live" : "hidden" };
  },
});
