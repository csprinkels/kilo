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

export default http;
