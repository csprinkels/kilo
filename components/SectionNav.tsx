"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, CarFront, CloudSun, Home, Megaphone, Mountain, Waves, Wind } from "lucide-react";

const SECTIONS = [
  { href: "/", label: "Now", icon: Home },
  { href: "/storms/", label: "Storms", icon: Wind },
  { href: "/traffic/", label: "Traffic", icon: CarFront },
  { href: "/weather/", label: "Weather", icon: CloudSun },
  { href: "/quakes/", label: "Quakes", icon: Activity },
  { href: "/volcano/", label: "Volcano", icon: Mountain },
  { href: "/tsunami/", label: "Tsunami", icon: Waves },
  { href: "/report/", label: "Report", icon: Megaphone },
];

/** Horizontal section switcher shared by every page. */
export default function SectionNav() {
  const path = usePathname();
  return (
    <nav aria-label="Sections" className="no-scrollbar -mx-5 mt-4 flex gap-1.5 overflow-x-auto px-5">
      {SECTIONS.map(({ href, label, icon: Icon }) => {
        const on = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={on ? "page" : undefined}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${on ? "bg-ink text-bg" : "bg-surface-2 text-ink-2 hover:text-ink"}`}>
            <Icon className="size-3.5" /> {label}
          </Link>
        );
      })}
    </nav>
  );
}
