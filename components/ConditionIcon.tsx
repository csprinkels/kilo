"use client";
import { ICON_FOR } from "@/lib/summary";

/** Meteocons (MIT, Bas Milius) fill icons: code 0–10 × day/night → /public/icons/weather/*.svg */
const FILE: Record<number, [day: string, night: string]> = {
  0: ["clear-day", "clear-night"], 1: ["clear-day", "clear-night"],
  2: ["partly-cloudy-day", "partly-cloudy-night"], 3: ["overcast-day", "overcast-night"], 4: ["overcast", "overcast"],
  5: ["partly-cloudy-day-rain", "partly-cloudy-night-rain"], 6: ["rain", "rain"],
  7: ["thunderstorms-day-rain", "thunderstorms-night-rain"], 8: ["fog-day", "fog-night"], 9: ["wind", "wind"], 10: ["hurricane", "hurricane"],
};
export const conditionIconSrc = (code: number, night = false) => `/icons/weather/${(FILE[code] ?? FILE[4])[night ? 1 : 0]}.svg`;

export const toneVar = (code: number, night: boolean) => {
  const t = ICON_FOR[code]?.tone ?? "cloud";
  return `var(--cond-${night && (t === "clear" || t === "cloud") ? "night" : t})`;
};

/** Illustrated weather icon. An <img> keeps gradient ids from colliding and lets the service worker cache it like any asset. */
export default function ConditionIcon({ code, night = false, size = 24, className = "" }: { code: number; night?: boolean; size?: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={conditionIconSrc(code, night)} alt="" aria-hidden width={size} height={size} className={`inline-block shrink-0 ${className}`} style={{ width: size, height: size }} />;
}

export type Topic = "road" | "quake" | "volcano" | "tsunami" | "neighbors" | "shelter" | "school" | "power" | "alert" | "storm" | "air";
/** Illustrated topic icon (bespoke set in /public/icons/topic). Always shown next to a word. */
export function TopicIcon({ topic, size = 24, className = "" }: { topic: Topic; size?: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/icons/topic/${topic}.svg`} alt="" aria-hidden width={size} height={size} className={`inline-block shrink-0 ${className}`} style={{ width: size, height: size }} />;
}
