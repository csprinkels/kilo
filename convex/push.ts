"use node";
import webpush from "web-push";
import { internalAction, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { DIGEST_BUDGET, buildDigest, type Digest, type Island, type Snapshot } from "../lib/types.ts";
import { apnsReady, fcmReady, sendApns, sendFcm } from "./nativePush";

const MIN_GAP_MS = 10 * 60_000; // per island; sev-4 bypasses

function vapid() {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return null;
  webpush.setVapidDetails(VAPID_SUBJECT ?? "mailto:aloha@csprinkels.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  return VAPID_PUBLIC_KEY;
}

type Sub = { endpoint: string; p256dh: string; auth: string; kind?: string };
type Note = { title: string; body: string; navigate: string; tag: string; webPayload: string; urgency: "high" | "normal" };

/** Send one notification to every row — web via web-push, apns/fcm via nativePush — then log + prune dead rows once. */
async function fanOut(ctx: ActionCtx, subs: Sub[], { island, trigger, ...n }: Note & { island: string; trigger: string }) {
  const ready = { web: vapid() !== null, apns: apnsReady(), fcm: fcmReady() };
  const dead: string[] = [];
  const skipped = new Set<string>();
  let sent = 0;
  await Promise.all(subs.map(async (s) => {
    const kind = s.kind ?? "web";
    if (!ready[kind as keyof typeof ready]) return skipped.add(kind); // env missing: not sent, not a failure
    if (kind === "web") {
      try {
        // topic: a newer notification replaces an undelivered one with the same tag
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, n.webPayload, { TTL: 24 * 3600, urgency: n.urgency, topic: n.tag });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dead.push(s.endpoint);
        else console.error(`[push] web ${s.endpoint.slice(0, 40)}… -> ${code}`);
      }
      return;
    }
    const r = await (kind === "apns" ? sendApns : sendFcm)({ token: s.endpoint, title: n.title, body: n.body, navigate: n.navigate, tag: n.tag });
    if (r.ok) sent++;
    else if (r.dead) dead.push(s.endpoint);
    else console.error(`[push] ${kind} ${s.endpoint.slice(0, 12)}… -> ${r.error}`);
  }));
  for (const k of skipped) console.warn(`[push] ${k} env missing; skipped ${subs.filter((s) => (s.kind ?? "web") === k).length} sub(s)`);
  const notSent = subs.filter((s) => skipped.has(s.kind ?? "web")).length;
  await ctx.runMutation(internal.pushStore.afterSend, { island, trigger, sent, failed: subs.length - sent - notSent, dead, at: Date.now() });
}

/** Build the island digest from the published snapshot and fan it out to every subscriber of that island. */
export const sendDigest = internalAction({
  // `level` is plainAlert().level for the trigger item — the reader-facing urgency the Now page ranks on.
  // Everything here keys off it, never off the feed's `sev`: a M6 quake reads "Act now" but is only sev 3.
  args: { island: v.string(), trigger: v.string(), level: v.optional(v.number()) },
  handler: async (ctx, { island, trigger, level }) => {
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
    const tag = `digest-${island}`;
    // Declarative Web Push (Safari 18.4+, no service worker needed) + the same JSON for Chrome's SW handler.
    const webPayload = JSON.stringify({
      web_push: 8030,
      notification: { title: lead.title, body: lead.body, navigate, tag, lang: "en", silent: false },
      digest,
    });
    if (Buffer.byteLength(webPayload) > DIGEST_BUDGET) console.error(`[push] ${island} payload ${Buffer.byteLength(webPayload)} B over budget`);

    const subs = await ctx.runQuery(internal.pushStore.forIsland, { island, minSev: urgency });
    await fanOut(ctx, subs, { island, trigger, title: lead.title, body: lead.body, navigate, tag, webPayload, urgency: "high" });
  },
});

/** "Something is waiting for you": a plain notification to every moderator subscription (pushSubs with island "mod"). */
export const sendModerator = internalAction({
  args: { text: v.string() },
  handler: async (ctx, { text }) => {
    const subs = await ctx.runQuery(internal.pushStore.forIsland, { island: "mod", minSev: 4 });
    if (!subs.length) return;
    const site = (process.env.SITE_URL ?? "").replace(/\/$/, "");
    const title = "A neighbor report is waiting", navigate = `${site}/mod/`, tag = "mod";
    const webPayload = JSON.stringify({ web_push: 8030, notification: { title, body: text, navigate, tag, lang: "en", silent: false } });
    await fanOut(ctx, subs, { island: "mod", trigger: "report held", title, body: text, navigate, tag, webPayload, urgency: "normal" });
  },
});

/** Public VAPID key for the client's pushManager.subscribe(). */
export const publicKey = internalAction({ args: {}, handler: async () => vapid() });

/** A plain test notification to every subscriber of one island — `npx convex run --prod push:ping '{"island":"hawaii"}'`. */
export const ping = internalAction({
  args: { island: v.string(), text: v.optional(v.string()) },
  handler: async (ctx, { island, text }): Promise<string> => {
    const subs: Sub[] = await ctx.runQuery(internal.pushStore.forIsland, { island, minSev: 9 });
    const site = (process.env.SITE_URL ?? "").replace(/\/$/, "");
    const title = "Kilo test", body = text ?? "Warnings are working on this phone.", navigate = `${site}/?island=${island}`, tag = "ping";
    const webPayload = JSON.stringify({ web_push: 8030, notification: { title, body, navigate, tag, lang: "en", silent: false } });
    await fanOut(ctx, subs, { island, trigger: "ping", title, body, navigate, tag, webPayload, urgency: "high" });
    return `${subs.length} subscription(s): ${subs.map((s) => s.kind ?? "web").join(", ") || "none"}`;
  },
});
