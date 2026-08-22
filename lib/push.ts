"use client";
import { API_URL } from "./data";
import { isNative } from "./native";
import type { Island } from "./types";

export type PushStatus = "unsupported" | "needs-install" | "denied" | "off" | "on";

const isStandalone = () =>
  typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true);
const isIOS = () => typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent);

export async function pushStatus(): Promise<PushStatus> {
  if (isNative()) return nativeStatus();
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return isIOS() && !isStandalone() ? "needs-install" : "unsupported"; // iOS exposes push only to Home Screen web apps
  }
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.ready;
  return (await reg.pushManager.getSubscription()) ? "on" : "off";
}

const b64ToU8 = (s: string) => {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

/** Subscribe this browser to the island digest. Returns the new status. */
export async function enablePush(island: Exclude<Island, "state"> | "mod", minSev = 3): Promise<PushStatus> {
  if (isNative()) return nativeEnable(island, minSev);
  const st = await pushStatus();
  if (st === "unsupported" || st === "needs-install" || st === "denied") return st;
  if ((await Notification.requestPermission()) !== "granted") return "denied";
  const reg = await navigator.serviceWorker.ready;
  const { key } = (await (await fetch(`${API_URL}/v1/push/key`, { signal: AbortSignal.timeout(30_000) })).json()) as { key: string | null };
  if (!key) throw new Error("push not configured");
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(key) as BufferSource }));
  const res = await fetch(`${API_URL}/v1/push/subscribe`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: sub.toJSON(), island, minSev }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`subscribe ${res.status}`);
  localStorage.setItem("push.island", island);
  return "on";
}

export async function disablePush(): Promise<PushStatus> {
  if (isNative()) return nativeDisable();
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await fetch(`${API_URL}/v1/push/unsubscribe`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
    await sub.unsubscribe();
  }
  localStorage.removeItem("push.island");
  return "off";
}

// ---- Native (iOS APNs / Android FCM) via @capacitor/push-notifications. Dynamic import keeps the plugin out of the web bundle.
const TOKEN_KEY = "push.token";
const plugin = async () => (await import("@capacitor/push-notifications")).PushNotifications;

async function nativeStatus(): Promise<PushStatus> {
  const { receive } = await (await plugin()).checkPermissions();
  if (receive === "denied") return "denied";
  return receive === "granted" && localStorage.getItem(TOKEN_KEY) ? "on" : "off";
}

/** Ask, register with APNs/FCM, and wait for the token (or a registration error / 20 s). */
async function nativeToken(): Promise<string | null> {
  const push = await plugin();
  if ((await push.requestPermissions()).receive !== "granted") return null;
  // Android needs a channel for heads-up alerts; on iOS this is a no-op that may reject.
  await push.createChannel({ id: "warnings", name: "Warnings", description: "Shelter openings, evacuations and warnings", importance: 5, visibility: 1, sound: "default" }).catch(() => {});
  let handles: Array<{ remove(): Promise<void> }> = [];
  try {
    return await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("registration timed out")), 20_000);
      const done = (fn: () => void) => { clearTimeout(timer); fn(); };
      void Promise.all([
        push.addListener("registration", ({ value }) => done(() => resolve(value))),
        push.addListener("registrationError", ({ error }) => done(() => reject(new Error(error)))),
      ]).then((h) => { handles = h; return push.register(); }).catch((e) => done(() => reject(e)));
    });
  } finally { await Promise.all(handles.map((h) => h.remove())); }
}

async function nativeEnable(island: string, minSev: number): Promise<PushStatus> {
  const token = await nativeToken();
  if (!token) return "denied";
  const { Capacitor } = await import("@capacitor/core");
  const res = await fetch(`${API_URL}/v1/push/subscribe`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: Capacitor.getPlatform() === "ios" ? "apns" : "fcm", token, island, minSev }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`subscribe ${res.status}`);
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem("push.island", island);
  return "on";
}

async function nativeDisable(): Promise<PushStatus> {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) await fetch(`${API_URL}/v1/push/unsubscribe`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: token }) }).catch(() => {});
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("push.island");
  await (await plugin()).unregister().catch(() => {});
  return "off";
}
