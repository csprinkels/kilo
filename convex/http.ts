import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

// Dev / fallback read path. Production reads the same bytes from R2 behind Cloudflare's CDN.
const http = httpRouter();

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "If-None-Match",
  "Access-Control-Expose-Headers": "ETag",
  "Access-Control-Max-Age": "86400",
};

// Browsers preflight because If-None-Match is not a CORS-safelisted header.
http.route({ pathPrefix: "/v1/", method: "OPTIONS", handler: httpAction(async () => new Response(null, { status: 204, headers: CORS })) });

http.route({
  pathPrefix: "/v1/",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const path = new URL(req.url).pathname.slice(1); // "v1/hawaii.json"
    const snap = await ctx.runQuery(internal.ingest.getSnapshot, { path });
    const cors = CORS;
    if (!snap) return new Response("not found", { status: 404, headers: cors });
    // Proxies may rewrite `"abc"` to `W/"abc-gzip"`; matching on the hash is enough.
    if ((req.headers.get("if-none-match") ?? "").includes(snap.etag.replace(/"/g, ""))) return new Response(null, { status: 304, headers: { ...cors, ETag: snap.etag } });
    return new Response(snap.body, {
      headers: {
        ...cors,
        "Content-Type": "application/json; charset=utf-8",
        ETag: snap.etag,
        "Cache-Control": "public, max-age=30, stale-while-revalidate=3600, stale-if-error=604800",
      },
    });
  }),
});

// ---- Web Push: subscribe / unsubscribe / public key ----
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const PUSH_CORS = { ...CORS, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };

http.route({ path: "/v1/push/key", method: "GET", handler: httpAction(async (ctx) => json({ key: await ctx.runAction(internal.push.publicKey, {}) })) });
http.route({ path: "/v1/push/subscribe", method: "OPTIONS", handler: httpAction(async () => new Response(null, { status: 204, headers: PUSH_CORS })) });
http.route({ path: "/v1/push/unsubscribe", method: "OPTIONS", handler: httpAction(async () => new Response(null, { status: 204, headers: PUSH_CORS })) });
http.route({
  path: "/v1/push/subscribe", method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      const { subscription, island, minSev } = await req.json();
      await ctx.runMutation(api.pushStore.subscribe, {
        endpoint: String(subscription.endpoint), p256dh: String(subscription.keys.p256dh), auth: String(subscription.keys.auth),
        island: String(island), minSev: Math.min(4, Math.max(2, Number(minSev) || 3)),
      });
      return json({ ok: true });
    } catch (e) { return json({ ok: false, error: String((e as Error).message).slice(0, 120) }, 400); }
  }),
});
http.route({
  path: "/v1/push/unsubscribe", method: "POST",
  handler: httpAction(async (ctx, req) => {
    const { endpoint } = await req.json().catch(() => ({}));
    if (endpoint) await ctx.runMutation(api.pushStore.unsubscribe, { endpoint: String(endpoint) });
    return json({ ok: true });
  }),
});

// ---- Community reports: submit + vote. Bot checks here, rules in convex/reports.ts + lib/reportRules.ts ----
const TURNSTILE_VERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

async function deviceHash(deviceId: unknown) {
  if (typeof deviceId !== "string" || !/^[0-9a-f-]{36}$/i.test(deviceId)) return null;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(deviceId + (process.env.DEVICE_SALT ?? "")));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

/** Turnstile is enforced as soon as TURNSTILE_SECRET is set in the Convex env (no deploy needed). */
async function botCheck(body: Record<string, unknown>): Promise<string | null> {
  if (typeof body.website === "string" && body.website) return "honeypot";
  if (typeof body.openedAt !== "number" || Date.now() - body.openedAt < 3000) return "Too fast. Take a second and try again.";
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) return null;
  if (typeof body.turnstileToken !== "string") return "Please complete the verification.";
  const res = await fetch(TURNSTILE_VERIFY, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret, response: body.turnstileToken, idempotency_key: crypto.randomUUID() }),
  });
  const out = (await res.json()) as { success?: boolean };
  return out.success ? null : "Verification failed. Reload and try again.";
}

const errJson = (e: unknown) => {
  const d = (e as { data?: { code?: number; message?: string } }).data;
  return json({ ok: false, error: d?.message ?? "Something went wrong." }, d?.code ?? 400);
};

for (const path of ["/v1/reports", "/v1/reports/vote"]) {
  http.route({ path, method: "OPTIONS", handler: httpAction(async () => new Response(null, { status: 204, headers: PUSH_CORS })) });
}
http.route({
  path: "/v1/reports", method: "POST",
  handler: httpAction(async (ctx, req) => {
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ ok: false, error: "Bad request." }, 400); }
    const bot = await botCheck(body);
    if (bot === "honeypot") return json({ ok: true, id: "x", status: "live" }); // lie to bots, store nothing
    if (bot) return json({ ok: false, error: bot }, 429);
    const hash = await deviceHash(body.deviceId);
    if (!hash) return json({ ok: false, error: "Bad request." }, 400);
    try {
      const out = await ctx.runMutation(internal.reports.submit, {
        type: String(body.type ?? ""), text: String(body.text ?? ""), locText: String(body.locText ?? ""),
        island: String(body.island ?? ""), district: String(body.district ?? ""), deviceHash: hash,
      });
      return json({ ok: true, ...out });
    } catch (e) { return errJson(e); }
  }),
});
http.route({
  path: "/v1/reports/vote", method: "POST",
  handler: httpAction(async (ctx, req) => {
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ ok: false, error: "Bad request." }, 400); }
    const bot = await botCheck({ ...body, openedAt: typeof body.openedAt === "number" ? body.openedAt : 0 });
    if (bot && bot !== "honeypot" && process.env.TURNSTILE_SECRET) return json({ ok: false, error: bot }, 429);
    const hash = await deviceHash(body.deviceId);
    const vote = body.vote;
    if (!hash || typeof body.id !== "string" || !["still", "gone", "flag"].includes(String(vote))) return json({ ok: false, error: "Bad request." }, 400);
    try {
      return json(await ctx.runMutation(internal.reports.vote, { id: body.id as never, vote: vote as "still", deviceHash: hash }));
    } catch (e) { return errJson(e); }
  }),
});

export default http;
