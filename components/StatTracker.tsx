"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { refEvent, returnBucket, track, wireStatFlush } from "@/lib/stat";
import { isNative } from "@/lib/native";

const SCREEN: Record<string, string> = {
  "/": "now", "/weather": "weather", "/traffic": "roads", "/report": "reports",
  "/tsunami": "tsunami", "/quakes": "earthquakes", "/volcano": "volcano", "/storms": "storms", "/sources": "settings", "/privacy": "privacy",
};

/** Today in Hawaiʻi, YYYY-MM-DD — the same bucket convex/stats.ts counts into. */
const hstDay = () => new Date().toLocaleDateString("en-CA", { timeZone: "Pacific/Honolulu" });

/** Counts one screen view per page, anonymously. Renders nothing. */
export default function StatTracker() {
  const path = usePathname();
  useEffect(() => {
    wireStatFlush();
    // One "visit" per browser per day. The de-duping happens here, in the browser: the server still only ever
    // receives a number, never an id. Someone who clears storage or uses two browsers counts twice — fine.
    try {
      const src = refEvent(location.search);
      if (src && !sessionStorage.getItem("srcSent")) { sessionStorage.setItem("srcSent", "1"); track(src); } // once per tab, not per reload
      const today = hstDay();
      const last = localStorage.getItem("lastVisit");
      if (last === today) return;
      localStorage.setItem("lastVisit", today);
      track(isNative() ? "visit:app" : "visit:web");
      track(returnBucket(last, today)); // new vs. came back: the bucket goes out, the date does not
    } catch { /* private mode: no storage, no visit count, nothing breaks */ }
  }, []);
  useEffect(() => {
    const key = path.replace(/\/$/, "") || "/";
    const name = SCREEN[key] ?? key.split("/")[1] ?? "other";
    track(`view:${name}`);
  }, [path]);
  return null;
}
