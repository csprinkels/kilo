"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { Island } from "@/lib/types";
import { disablePush, enablePush, pushStatus, type PushStatus } from "@/lib/push";
import { APP_NAME, ISLAND_LABEL } from "@/lib/brand";

// "Not now" on the Now page: remembered on this phone; Settings always shows the block.
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
const getDismissed = () => localStorage.getItem("alertsDismissed") === "1";
export function useAlertsDismissed(): [boolean, () => void] {
  const dismissed = useSyncExternalStore(subscribe, getDismissed, () => false);
  return [dismissed, () => { localStorage.setItem("alertsDismissed", "1"); listeners.forEach((cb) => cb()); }];
}

/**
 * "Warnings on this phone": Web Push per island. Works on Android and on iPhones with the app on the Home Screen.
 * `compact` (the Now page) adds a "Not now" button that hides the block on this phone; Settings always shows it.
 */
export default function AlertsCard({ island, compact }: { island: Exclude<Island, "state">; compact?: boolean }) {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dismissed, dismiss] = useAlertsDismissed();
  // A failed status check still offers the button: tapping it surfaces the real error instead of hiding it.
  useEffect(() => { void pushStatus().then(setStatus).catch(() => setStatus("off")); }, []);

  const toggle = async () => {
    setBusy(true); setErr(null);
    try { setStatus(status === "on" ? await disablePush() : await enablePush(island)); }
    catch (e) { setErr("Couldn't finish turning this on. Try again when you have a better signal."); console.error(e); }
    finally { setBusy(false); }
  };

  if (compact && dismissed) return null;
  const name = ISLAND_LABEL[island].split(" · ")[0];
  return (
    <section className={compact ? "isl-card" : "mt-s7"} aria-label="Warnings on this phone">
      <h2 className={compact ? "text-body font-semibold text-ink" : "h-title"}>Warnings on this phone</h2>
      <p className="mt-s2 max-w-[36rem] text-body text-ink-2">
        {status === "on" && <>On for {name}. The whole message is in the notification, so you can read it with no signal.</>}
        {(status === "off" || status === null) && <>Get shelter openings, evacuations and warnings for {name} as notifications. The whole message is in the notification, so you can read it with no signal.</>}
        {status === "needs-install" && <>First add {APP_NAME} to your Home Screen: tap the Share button, then &ldquo;Add to Home Screen&rdquo;. Then open {APP_NAME} from there and come back here.</>}
        {status === "denied" && <>Notifications are turned off for {APP_NAME}. Turn them on in your phone&apos;s settings, then open {APP_NAME} again.</>}
        {status === "unsupported" && <>This phone can&apos;t show notifications from {APP_NAME}.</>}
      </p>
      {err && <p className="mt-s2 max-w-[36rem] text-body text-danger">{err}</p>}
      {(status === "on" || status === "off" || compact) && (
        <div className="mt-s4 flex flex-wrap items-center gap-s3">
          {(status === "on" || status === "off") && (
            <button onClick={toggle} disabled={busy} className={`btn disabled:opacity-50 ${status === "off" ? "btn-primary" : ""}`}>
              {busy ? "One moment…" : status === "on" ? "Turn off" : "Turn on"}
            </button>
          )}
          {compact && <button onClick={dismiss} className="inline-flex min-h-11 items-center px-s2 text-body font-semibold text-brand">Not now</button>}
        </div>
      )}
    </section>
  );
}
