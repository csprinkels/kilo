"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Activity, CarFront, CloudSun, Home, LayoutGrid, Megaphone, Mountain, Waves, Wind, X } from "lucide-react";

const PRIMARY = [
  { href: "/", label: "Now", icon: Home },
  { href: "/weather/", label: "Weather", icon: CloudSun },
  { href: "/storms/", label: "Storms", icon: Wind },
  { href: "/quakes/", label: "Quakes", icon: Activity },
];
const MORE = [
  { href: "/traffic/", label: "Traffic", icon: CarFront },
  { href: "/volcano/", label: "Volcano", icon: Mountain },
  { href: "/tsunami/", label: "Tsunami", icon: Waves },
  { href: "/report/", label: "Report", icon: Megaphone },
];
const ALL = [...PRIMARY, ...MORE];
const isOn = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

/** Mobile: fixed bottom tab bar (thumb reach, 56px + safe area). Wide screens: the pill row under the masthead. */
export default function SectionNav() {
  const path = usePathname();
  const [more, setMore] = useState(false);
  const moreOn = MORE.some((m) => isOn(path, m.href));
  return (
    <>
      {/* wide */}
      <nav aria-label="Sections" className="no-scrollbar -mx-5 mt-s4 hidden gap-s2 overflow-x-auto px-5 md:flex">
        {ALL.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} aria-current={isOn(path, href) ? "page" : undefined} className={`btn h-10 shrink-0 ${isOn(path, href) ? "chip-active" : ""}`}><Icon className="size-4" /> {label}</Link>
        ))}
      </nav>
      {/* mobile */}
      <nav aria-label="Sections" className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <ul className="mx-auto grid max-w-2xl grid-cols-5">
          {PRIMARY.map(({ href, label, icon: Icon }) => {
            const on = isOn(path, href);
            return (
              <li key={href}>
                <Link href={href} aria-current={on ? "page" : undefined} className={`flex h-14 flex-col items-center justify-center gap-0.5 text-micro font-medium ${on ? "text-brand" : "text-muted"}`}>
                  <Icon className="size-6" strokeWidth={on ? 2.25 : 2} /> {label}
                </Link>
              </li>
            );
          })}
          <li>
            <button onClick={() => setMore((m) => !m)} aria-expanded={more} aria-controls="more-sheet" className={`flex h-14 w-full flex-col items-center justify-center gap-0.5 text-micro font-medium ${moreOn || more ? "text-brand" : "text-muted"}`}>
              {more ? <X className="size-6" /> : <LayoutGrid className="size-6" />} More
            </button>
          </li>
        </ul>
        {more && (
          <div id="more-sheet" className="border-t border-line bg-surface px-s4 pb-s4 pt-s3">
            <ul className="mx-auto grid max-w-2xl grid-cols-4 gap-s2">
              {MORE.map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <Link href={href} onClick={() => setMore(false)} aria-current={isOn(path, href) ? "page" : undefined} className={`flex h-16 flex-col items-center justify-center gap-1 rounded-card text-micro font-medium ${isOn(path, href) ? "bg-surface-2 text-brand" : "text-ink-2"}`}>
                    <Icon className="size-6" /> {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>
    </>
  );
}
