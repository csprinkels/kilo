"use client";
import { ICON_FOR } from "@/lib/summary";
import { useWeatherMotion } from "@/lib/data";

/** Meteocons (MIT, Bas Milius) fill icons: code 0–10 × day/night → /public/icons/weather/*.svg */
const FILE: Record<number, [day: string, night: string]> = {
  0: ["clear-day", "clear-night"], 1: ["clear-day", "clear-night"],
  2: ["partly-cloudy-day", "partly-cloudy-night"], 3: ["overcast-day", "overcast-night"], 4: ["overcast", "overcast"],
  5: ["partly-cloudy-day-rain", "partly-cloudy-night-rain"], 6: ["rain", "rain"],
  7: ["thunderstorms-day-rain", "thunderstorms-night-rain"], 8: ["fog-day", "fog-night"], 9: ["wind", "wind"], 10: ["hurricane", "hurricane"],
};
/** Static fill (~1–2 KB) stays in `/icons/weather/`; SMIL-animated fill (~1–5 KB) in `/icons/weather/animated/`. */
export const conditionIconSrc = (code: number, night = false, animated = false) => {
  const name = (FILE[code] ?? FILE[4])[night ? 1 : 0];
  return animated ? `/icons/weather/animated/${name}.svg` : `/icons/weather/${name}.svg`;
};

export const toneVar = (code: number, night: boolean) => {
  const t = ICON_FOR[code]?.tone ?? "cloud";
  return `var(--cond-${night && (t === "clear" || t === "cloud") ? "night" : t})`;
};

/**
 * Illustrated weather icon. An <img> keeps gradient ids from colliding and lets the service worker cache it like any asset.
 * On a good link (and when motion is allowed), large icons use the animated Meteocons fill; small rows stay static to save CPU.
 */
export default function ConditionIcon({ code, night = false, size = 24, className = "", live }: {
  code: number; night?: boolean; size?: number; className?: string;
  /** Force or forbid animation. Default: animate only when size ≥ 64 and the link is healthy. */
  live?: boolean;
}) {
  const motionOk = useWeatherMotion();
  const animated = (live ?? size >= 64) && motionOk;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={conditionIconSrc(code, night, animated)} alt="" aria-hidden width={size} height={size} className={`inline-block shrink-0 ${className}`} style={{ width: size, height: size }} />;
}

export type Topic = "road" | "quake" | "volcano" | "tsunami" | "neighbors" | "shelter" | "school" | "power" | "alert" | "storm" | "air";
/** Illustrated topic icon (bespoke set in /public/icons/topic). Always shown next to a word. */
export function TopicIcon({ topic, size = 24, className = "" }: { topic: Topic; size?: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/icons/topic/${topic}.svg`} alt="" aria-hidden width={size} height={size} className={`inline-block shrink-0 ${className}`} style={{ width: size, height: size }} />;
}
