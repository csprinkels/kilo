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
      {/* phones: fixed bottom bar, labels always visible */}
      <nav aria-label="Sections" className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <ul className="mx-auto grid max-w-2xl grid-cols-4">
          {TABS.map((t) => {
            const on = isOn(path, t);
            return (
              <li key={t.href}>
                <Link href={t.href} aria-current={on ? "page" : undefined} className={`flex min-h-16 flex-col items-center justify-center gap-1 text-small font-semibold ${on ? "text-brand" : "text-ink-2"}`}>
                  <t.icon className="size-7" strokeWidth={on ? 2.25 : 1.75} aria-hidden /> {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
