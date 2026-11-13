"use client";
import { Capacitor } from "@capacitor/core";
import { smsText, type Item } from "./types";
import { itemLink } from "./now";
import { track } from "./stat";

/** True inside the iOS/Android app (Capacitor). In a browser, everything below falls through to the web APIs. */
export const isNative = () => Capacitor.isNativePlatform();

/** Share one text message's worth, and the link that opens it. The native sheet in the app; Web Share or the clipboard on the web. Returns "shared" | "copied" | "cancelled". */
export async function shareText(text: string, url?: string): Promise<"shared" | "copied" | "cancelled"> {
  track("share");
  try {
    if (isNative()) { const { Share } = await import("@capacitor/share"); await Share.share({ text, url }); return "shared"; }
    if (navigator.share) { await navigator.share({ text, url }); return "shared"; }
    await navigator.clipboard.writeText(url ? `${text} ${url}` : text); return "copied";
  } catch { return "cancelled"; }
}

/** Share an item with the link that opens it on Now, for the island this phone is looking at. */
export function shareItem(item: Item) {
  let island: string | null = null;
  try { island = localStorage.getItem("island"); } catch { /* storage off: the item's own island */ }
  // A statewide item opens on this phone's island; anything else on the island it belongs to (the page may be showing a neighbor's link).
  if (!island || island === "state" || !item.islands.some((i) => i === island || i === "state")) island = item.islands.find((i) => i !== "state") ?? "hawaii";
  return shareText(smsText(item), itemLink(island, item.key, "share"));
}

type Fix = { coords: { latitude: number; longitude: number; accuracy: number } };
/**
 * navigator.geolocation.getCurrentPosition, but in the app it asks the phone itself. Through the web view, iOS stacks
 * WebKit's own prompt on top of the system one, and WebKit's names the page's origin: "localhost" would like to use
 * your current location. The plugin asks once, as Kilo, with the NSLocationWhenInUseUsageDescription text.
 */
export function getPosition(ok: (p: Fix) => void, fail: () => void, opts?: PositionOptions) {
  if (!isNative()) return navigator.geolocation.getCurrentPosition(ok, fail, opts);
  import("@capacitor/geolocation").then(({ Geolocation }) => Geolocation.getCurrentPosition(opts)).then(ok, fail);
}

/**
 * Native-only setup, called once from the root: status bar over the page, splash away once we have painted, links into the app → pages.
 * `go` must be a client-side navigation (Next's router): inside the app every extension-less URL the local server sees
 * becomes the root index.html, so a full page load of /weather/ would land on Now.
 */
export async function nativeBoot(go: (path: string) => void) {
  if (!isNative()) return;
  const [{ StatusBar, Style }, { SplashScreen }, { App }] = await Promise.all([import("@capacitor/status-bar"), import("@capacitor/splash-screen"), import("@capacitor/app")]);
  const dark = matchMedia("(prefers-color-scheme: dark)");
  const paint = () => StatusBar.setStyle({ style: dark.matches ? Style.Dark : Style.Light }).catch(() => {});
  await StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
  await paint();
  dark.addEventListener("change", paint);
  // Android back button: go back in the app's history, or leave from the Now page.
  App.addListener("backButton", ({ canGoBack }) => { if (canGoBack && location.pathname !== "/") history.back(); else App.exitApp(); });
  // A link into the app (push tap, later: universal links) lands on the right page.
  App.addListener("appUrlOpen", ({ url }) => { try { const u = new URL(url); go(u.pathname + u.search); } catch { /* ignore */ } });
  // A tapped warning carries data.navigate ("/?island=hawaii&item=…" or an absolute URL). Received-while-open needs nothing: the pages poll.
  const { PushNotifications } = await import("@capacitor/push-notifications");
  PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
    const nav = (notification.data as { navigate?: unknown } | undefined)?.navigate;
    if (typeof nav !== "string") return;
    track("open:push");
    try { const u = new URL(nav, location.origin); go(u.pathname + u.search); } catch { /* ignore */ }
  });
  await SplashScreen.hide().catch(() => {});
}
