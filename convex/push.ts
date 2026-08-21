"use node";
import webpush from "web-push";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { DIGEST_BUDGET, buildDigest, type Digest, type Island, type Snapshot } from "../lib/types.ts";

const MIN_GAP_MS = 10 * 60_000; // per island; sev-4 bypasses

function vapid() {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return null;
  webpush.setVapidDetails(VAPID_SUBJECT ?? "mailto:aloha@csprinkels.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  return VAPID_PUBLIC_KEY;
}

/** Build the island digest from the published snapshot and fan it out to every subscriber of that island. */
export const sendDigest = internalAction({
  // `level` is plainAlert().level for the trigger item — the reader-facing urgency the Now page ranks on.
  // Everything here keys off it, never off the feed's `sev`: a M6 quake reads "Act now" but is only sev 3.
  args: { island: v.string(), trigger: v.string(), level: v.optional(v.number()) },
  handler: async (ctx, { island, trigger, level }) => {
    if (!vapid()) return;
    const snapRow = await ctx.runQuery(internal.ingest.getSnapshot, { path: `v1/${island}.json` });
    if (!snapRow) return;
    const snap = JSON.parse(snapRow.body) as Snapshot;
    const digest: Digest = buildDigest(island as Island, snap.items, snap.gen, trigger);
    const lead = digest.top[0];
    if (!lead) return;
    const urgency = level ?? lead.sev; // called by hand without a level: fall back to the feed's own number

    const last = await ctx.runQuery(internal.pushStore.lastSend, { island });
    if (last && urgency < 4 && Date.now() - last.at < MIN_GAP_MS) return;

    const site = (process.env.SITE_URL ?? "").replace(/\/$/, "");
    const navigate = `${site}/?island=${island}&item=${encodeURIComponent(lead.key)}`;
    // Declarative Web Push (Safari 18.4+, no service worker needed) + the same JSON for Chrome's SW handler.
    const payload = JSON.stringify({
      web_push: 8030,
      notification: { title: lead.title, body: lead.body, navigate, tag: `digest-${island}`, lang: "en", silent: false },
      digest,
    });
    if (Buffer.byteLength(payload) > DIGEST_BUDGET) console.error(`[push] ${island} payload ${Buffer.byteLength(payload)} B over budget`);

    const subs = await ctx.runQuery(internal.pushStore.forIsland, { island, minSev: urgency });
    const dead: string[] = [];
    let sent = 0;
    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
          TTL: 24 * 3600, urgency: "high", topic: `digest-${island}`, // topic: a newer digest replaces an undelivered one
        });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dead.push(s.endpoint);
        else console.error(`[push] ${s.endpoint.slice(0, 40)}… -> ${code}`);
      }
    }));
    await ctx.runMutation(internal.pushStore.afterSend, { island, trigger, sent, failed: subs.length - sent, dead, at: Date.now() });
  },
});

/** "Something is waiting for you": a plain notification to every moderator subscription (pushSubs with island "mod"). */
export const sendModerator = internalAction({
  args: { text: v.string() },
  handler: async (ctx, { text }) => {
    if (!vapid()) return;
    const subs = await ctx.runQuery(internal.pushStore.forIsland, { island: "mod", minSev: 4 });
    if (!subs.length) return;
    const site = (process.env.SITE_URL ?? "").replace(/\/$/, "");
    const payload = JSON.stringify({
      web_push: 8030,
      notification: { title: "A neighbor report is waiting", body: text, navigate: `${site}/mod/`, tag: "mod", lang: "en", silent: false },
    });
    const dead: string[] = [];
    let sent = 0;
    await Promise.all(subs.map(async (s) => {
      try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 24 * 3600, urgency: "normal", topic: "mod" }); sent++; }
      catch (e) { const code = (e as { statusCode?: number }).statusCode; if (code === 404 || code === 410) dead.push(s.endpoint); }
    }));
    await ctx.runMutation(internal.pushStore.afterSend, { island: "mod", trigger: "report held", sent, failed: subs.length - sent, dead, at: Date.now() });
  },
});

/** Public VAPID key for the client's pushManager.subscribe(). */
export const publicKey = internalAction({ args: {}, handler: async () => vapid() });
