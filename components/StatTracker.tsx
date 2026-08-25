"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { track, wireStatFlush } from "@/lib/stat";

const SCREEN: Record<string, string> = {
  "/": "now", "/weather": "weather", "/traffic": "roads", "/report": "reports",
  "/tsunami": "tsunami", "/quakes": "earthquakes", "/volcano": "volcano", "/storms": "storms", "/sources": "settings", "/privacy": "privacy",
};

/** Counts one screen view per page, anonymously. Renders nothing. */
export default function StatTracker() {
  const path = usePathname();
  useEffect(() => { wireStatFlush(); }, []);
  useEffect(() => {
    const key = path.replace(/\/$/, "") || "/";
    const name = SCREEN[key] ?? key.split("/")[1] ?? "other";
    track(`view:${name}`);
  }, [path]);
  return null;
}
