"use client";
import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudSun, Moon, Sun, Wind, type LucideIcon } from "lucide-react";
import { ICON_FOR } from "@/lib/summary";

const ICONS: Record<string, LucideIcon> = { Sun, Moon, CloudSun, CloudMoon, Cloud, CloudDrizzle, CloudRain, CloudLightning, CloudFog, Wind };
const TONE_CLASS: Record<string, string> = {
  clear: "text-cond-clear", cloud: "text-cond-cloud", showers: "text-cond-showers", rain: "text-cond-rain",
  storm: "text-cond-storm", fog: "text-cond-fog", windy: "text-cond-windy", night: "text-cond-night",
};
export const toneVar = (code: number, night: boolean) => {
  const t = ICON_FOR[code]?.tone ?? "cloud";
  return `var(--cond-${night && (t === "clear" || t === "cloud") ? "night" : t})`;
};

/** Weather condition glyph: lucide line icon in the condition colour (icons only: colour never carries text). */
export default function ConditionIcon({ code, night = false, size = 20, className = "" }: { code: number; night?: boolean; size?: number; className?: string }) {
  const m = ICON_FOR[code] ?? ICON_FOR[4];
  const Icon = ICONS[night ? m.night : m.day] ?? Cloud;
  const tone = night && (m.tone === "clear" || m.tone === "cloud") ? "night" : m.tone;
  const fill = Icon === Sun || Icon === Moon;
  return <Icon aria-hidden className={`${TONE_CLASS[tone]} ${className}`} style={{ width: size, height: size }} strokeWidth={2} fill={fill ? "currentColor" : "none"} fillOpacity={fill ? 0.25 : 0} />;
}
