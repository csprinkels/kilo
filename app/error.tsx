"use client";
import { useEffect, useState } from "react";
import { APP_NAME } from "@/lib/brand";
import { Notice } from "@/components/AlertBlock";

// Everything this app is for happens when other things are already going wrong, so a blank screen is the one
// outcome to design against. Anything that throws while rendering lands here instead.
// Next 16 calls the recovery prop `retry` (it re-fetches and re-renders); `reset` only clears the boundary.

/** Everything ʻio keeps on this phone. Wiping it is the way out of a corrupt saved value. */
const KEYS = ["island", "town", "text", "mode", "lastOkAt", "votes", "reportDraft", "deviceId", "alertsDismissed", "push.island"];

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [wiped, setWiped] = useState(false);
  useEffect(() => { console.error("[kilo]", error); }, [error]);

  const startOver = () => {
    try {
      for (const k of KEYS) localStorage.removeItem(k);
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k?.startsWith("snap:")) localStorage.removeItem(k);
      }
    } catch { /* nothing we can do; the reload below is still worth trying */ }
    setWiped(true);
    // A full document load on purpose, not a router push: the point is to drop the corrupt state this app
    // is still holding in memory, which a client-side navigation would carry straight over.
    location.replace(new URL("/", location.origin).href);
  };

  return (
    <main className="relative z-[1] mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5 pb-s7 pt-s7">
      <Notice title="Hurt or in danger? Call 911.">Do not wait for this screen.</Notice>

      <h1 className="h-display mt-s6">{APP_NAME} could not show this page</h1>
      <p className="mt-s3 max-w-[36rem] text-body text-ink-2">
        Something went wrong on this phone, not out in the world. Your island may still be fine.
        Try again, and if it keeps happening, start over — that clears what {APP_NAME} saved here and loads it fresh.
      </p>

      <div className="mt-s5 flex flex-col gap-s2">
        <button className="btn btn-primary btn-big" onClick={() => retry()}>Try again</button>
        <button className="btn btn-big" onClick={startOver} disabled={wiped}>{wiped ? "One moment…" : "Start over"}</button>
      </div>

      <p className="mt-s5 max-w-[36rem] text-small text-ink-2">
        Starting over forgets your island, your town and any report you were writing. It does not delete
        anything you already sent.
      </p>
      <p className="mt-s4 text-small text-ink-2">
        Official warnings are always at <a className="font-semibold text-brand" href="https://www.weather.gov/hfo/">weather.gov/hfo</a>.
      </p>
    </main>
  );
}
