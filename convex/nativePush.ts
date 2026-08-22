"use node";
/**
 * Native push senders: APNs (token auth over HTTP/2) and FCM HTTP v1. Env:
 *   APNS_KEY_ID            10-char id of the .p8 APNs auth key
 *   APNS_TEAM_ID           Apple developer team id
 *   APNS_KEY               the .p8 PEM, raw or base64-encoded
 *   APNS_BUNDLE_ID         apns-topic; default com.csprinkels.kilo
 *   APNS_SANDBOX_FALLBACK  "0" disables retrying BadDeviceToken against the sandbox host
 *   FCM_SERVICE_ACCOUNT    Firebase service-account JSON, raw or base64-encoded
 * Any group missing → its sender reports ok:false, dead:false; push.ts checks *Ready() first and skips instead.
 */
import http2 from "node:http2";
import { apnsJwt, decodeEnv, googleGrantJwt, memo, type ServiceAccount } from "./pushJwt";

export type SendResult = { ok: true } | { ok: false; dead: boolean; error: string };
export type Note = { token: string; title: string; body: string; navigate: string; tag: string };

// ---- APNs ----
function apnsEnv() {
  const { APNS_KEY_ID, APNS_TEAM_ID, APNS_KEY } = process.env;
  return APNS_KEY_ID && APNS_TEAM_ID && APNS_KEY ? { keyId: APNS_KEY_ID, teamId: APNS_TEAM_ID, key: decodeEnv(APNS_KEY) } : null;
}
export const apnsReady = () => apnsEnv() !== null;
const apnsToken = memo(50 * 60_000, async () => apnsJwt(apnsEnv()!));

/** One POST on a fresh HTTP/2 session, closed on completion. ponytail: no session reuse; pool per action call if APNs rate-limits. */
function h2post(origin: string, path: string, headers: Record<string, string>, body: string) {
  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const session = http2.connect(origin);
    session.setTimeout(10_000, () => session.destroy(new Error("apns timeout")));
    session.on("error", reject);
    const req = session.request({ ":method": "POST", ":path": path, ...headers });
    let status = 0;
    const chunks: Buffer[] = [];
    req.on("response", (h) => { status = Number(h[":status"]); });
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => { session.close(); resolve({ status, body: Buffer.concat(chunks).toString() }); });
    req.on("error", (e) => { session.close(); reject(e); });
    req.end(body);
  });
}

export async function sendApns({ token, title, body, navigate, tag }: Note): Promise<SendResult> {
  if (!apnsEnv()) return { ok: false, dead: false, error: "APNS env missing" };
  const headers = {
    authorization: `bearer ${await apnsToken()}`,
    "apns-topic": process.env.APNS_BUNDLE_ID ?? "com.csprinkels.kilo",
    "apns-push-type": "alert",
    "apns-priority": "10",
    "apns-expiration": String(Math.floor(Date.now() / 1000) + 24 * 3600),
    "content-type": "application/json",
  };
  const payload = JSON.stringify({ aps: { alert: { title, body }, sound: "default", "thread-id": tag, "interruption-level": "time-sensitive" }, navigate });
  // Xcode debug builds register sandbox tokens; production answers 400 BadDeviceToken for those, so try the sandbox once.
  const hosts = ["https://api.push.apple.com"];
  if (process.env.APNS_SANDBOX_FALLBACK !== "0") hosts.push("https://api.sandbox.push.apple.com");
  let last: SendResult = { ok: false, dead: false, error: "no host" };
  for (const host of hosts) {
    try {
      const r = await h2post(host, `/3/device/${token}`, headers, payload);
      if (r.status === 200) return { ok: true };
      let reason = "";
      try { reason = String(JSON.parse(r.body).reason ?? ""); } catch { /* not JSON */ }
      last = { ok: false, dead: r.status === 410 || reason === "Unregistered" || reason === "BadDeviceToken", error: `${r.status} ${reason}` };
      if (!(r.status === 400 && reason === "BadDeviceToken")) return last;
    } catch (e) { return { ok: false, dead: false, error: String(e) }; }
  }
  return last;
}

// ---- FCM ----
const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
function fcmEnv(): ServiceAccount | null {
  const raw = process.env.FCM_SERVICE_ACCOUNT;
  if (!raw) return null;
  try { return JSON.parse(decodeEnv(raw)); } catch { return null; }
}
export const fcmReady = () => fcmEnv() !== null;
const fcmAccess = memo(50 * 60_000, async () => {
  const assertion = googleGrantJwt(fcmEnv()!, SCOPE);
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!r.ok) throw new Error(`oauth ${r.status} ${(await r.text()).slice(0, 200)}`);
  return ((await r.json()) as { access_token: string }).access_token;
});

export async function sendFcm({ token, title, body, navigate, tag }: Note): Promise<SendResult> {
  const sa = fcmEnv();
  if (!sa) return { ok: false, dead: false, error: "FCM env missing" };
  try {
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: "POST",
      headers: { authorization: `Bearer ${await fcmAccess()}`, "content-type": "application/json" },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          data: { navigate, tag },
          android: { priority: "high", notification: { channel_id: "warnings", sound: "default" } },
        },
      }),
    });
    if (r.ok) return { ok: true };
    const text = await r.text();
    return { ok: false, dead: r.status === 404 || text.includes("UNREGISTERED"), error: `${r.status} ${text.slice(0, 200)}` };
  } catch (e) { return { ok: false, dead: false, error: String(e) }; }
}
