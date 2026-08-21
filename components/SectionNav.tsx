"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CarFront, CloudSun, Home, Users } from "lucide-react";

/** Four destinations. Storms, earthquakes, the volcano and tsunami are rows on Now, so Now stays lit on those pages. */
const TABS = [
  { href: "/", label: "Now", icon: Home, also: ["/storms/", "/quakes/", "/volcano/", "/tsunami/"] },
  { href: "/weather/", label: "Weather", icon: CloudSun, also: [] },
  { href: "/traffic/", label: "Roads", icon: CarFront, also: [] },
  { href: "/report/", label: "Neighbors", icon: Users, also: ["/guidelines/"] },
];
const isOn = (path: string, t: (typeof TABS)[number]) => path === t.href || t.also.some((a) => path.startsWith(a));

export default function SectionNav() {
  const path = usePathname();
  return (
    <>
      {/* wide screens: the same four, as pills under the top bar */}
      <nav aria-label="Sections" className="mt-s3 hidden gap-s2 md:flex">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} aria-current={isOn(path, t) ? "page" : undefined} className={`btn ${isOn(path, t) ? "chip-active" : ""}`}><t.icon className="size-5" aria-hidden /> {t.label}</Link>
        ))}
      </nav>
      {/* phones: a floating frosted pill above the home indicator; the lit tab sits on its own pill inside it */}
      <nav aria-label="Sections" className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center px-4 md:hidden" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)" }}>
        {/* @container + auto widths: "Neighbors" gets the room it needs instead of a quarter of the bar. */}
        <ul className="glass pointer-events-auto @container flex w-full max-w-md items-stretch justify-between gap-[4px] rounded-full p-[4px]">
          {TABS.map((t) => {
            const on = isOn(path, t);
            return (
              <li key={t.href}>
                <Link href={t.href} aria-current={on ? "page" : undefined}
                  className={`flex min-h-14 min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-full px-[4px] font-semibold leading-tight transition-colors [font-size:clamp(16px,5cqi,1.25rem)] @min-[21rem]:px-s2 ${on ? "bg-surface-2 text-brand" : "text-ink-2"}`}>
                  <t.icon className="size-6" strokeWidth={on ? 2.25 : 1.75} aria-hidden /> {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
