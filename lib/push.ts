"use client";
import { DATA_URL } from "./data";
import type { Island } from "./types";

export type PushStatus = "unsupported" | "needs-install" | "denied" | "off" | "on";

const isStandalone = () =>
  typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true);
const isIOS = () => typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent);

export async function pushStatus(): Promise<PushStatus> {
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
  const st = await pushStatus();
  if (st === "unsupported" || st === "needs-install" || st === "denied") return st;
  if ((await Notification.requestPermission()) !== "granted") return "denied";
  const reg = await navigator.serviceWorker.ready;
  const { key } = (await (await fetch(`${DATA_URL}/v1/push/key`, { signal: AbortSignal.timeout(30_000) })).json()) as { key: string | null };
  if (!key) throw new Error("push not configured");
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(key) as BufferSource }));
  const res = await fetch(`${DATA_URL}/v1/push/subscribe`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: sub.toJSON(), island, minSev }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`subscribe ${res.status}`);
  localStorage.setItem("push.island", island);
  return "on";
}

export async function disablePush(): Promise<PushStatus> {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await fetch(`${DATA_URL}/v1/push/unsubscribe`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
    await sub.unsubscribe();
  }
  localStorage.removeItem("push.island");
  return "off";
}
