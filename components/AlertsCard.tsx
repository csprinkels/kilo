"use client";
import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Share } from "lucide-react";
import type { Island } from "@/lib/types";
import { disablePush, enablePush, pushStatus, type PushStatus } from "@/lib/push";
import { ISLAND_LABEL, okina } from "@/lib/brand";

/** "Get alerts on this phone": Web Push digests per island. Works on Android and on iPhones with the app on the Home Screen. */
export default function AlertsCard({ island }: { island: Exclude<Island, "state"> }) {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { void pushStatus().then(setStatus); }, []);

  const toggle = async () => {
    setBusy(true); setErr(null);
    try { setStatus(status === "on" ? await disablePush() : await enablePush(island)); }
    catch (e) { setErr("Couldn't reach the server to finish signing up. Try again when you have a better connection."); console.error(e); }
    finally { setBusy(false); }
  };

  if (status === null) return null;
  const name = okina(ISLAND_LABEL[island].split(" · ")[0]);
  return (
    <section className="mt-6 card" aria-label="Alerts on this phone">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full ${status === "on" ? "bg-sev3-bg text-sev3" : "bg-surface-2 text-ink-2"}`}>
          {status === "on" ? <BellRing className="size-[18px]" /> : status === "denied" ? <BellOff className="size-[18px]" /> : <Bell className="size-[18px]" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="display text-lead font-medium">Alerts on this phone</p>
          {status === "on" && <p className="mt-1 text-label text-ink-2">On for <strong>{name}</strong>. Each alert carries its full text, so you can read it from the lock screen even when nothing else will load.</p>}
          {status === "off" && <p className="mt-1 text-label text-ink-2">Get shelter openings, evacuations and warnings for <strong>{name}</strong> as notifications. The whole message is inside the notification: no connection needed to read it.</p>}
          {status === "needs-install" && (
            <p className="mt-1 text-label text-ink-2">On iPhone, alerts need the app on your Home Screen: tap <Share className="inline size-3.5 align-text-bottom" /> <strong>Share → Add to Home Screen</strong>, then open it from there and come back here.</p>
          )}
          {status === "denied" && <p className="mt-1 text-label text-ink-2">Notifications are blocked for this site. Allow them in your browser or phone settings, then reload.</p>}
          {status === "unsupported" && <p className="mt-1 text-label text-ink-2">This browser can&apos;t receive notifications. Try Chrome on Android, or add the app to your Home Screen on iPhone.</p>}
          {err && <p className="mt-2 text-micro text-sev4">{err}</p>}
          {(status === "on" || status === "off") && (
            <button onClick={toggle} disabled={busy}
              className={`mt-3 rounded-full px-4 py-2 text-label font-semibold transition-colors disabled:opacity-50 ${status === "on" ? "border border-line bg-surface text-ink-2" : "bg-brand text-brand-ink"}`}>
              {busy ? "One moment…" : status === "on" ? "Turn off" : `Turn on for ${name}`}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
