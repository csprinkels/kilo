"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "@/components/Icon";

/** Four destinations. Storms, earthquakes, the volcano and tsunami are rows on Now, so Now stays lit on those pages. */
const TABS: { href: string; label: string; icon: IconName; also: string[] }[] = [
  { href: "/", label: "Now", icon: "house", also: ["/storms/", "/quakes/", "/volcano/", "/tsunami/"] },
  { href: "/weather/", label: "Weather", icon: "cloud-sun", also: [] },
  { href: "/traffic/", label: "Roads", icon: "car", also: [] },
  { href: "/report/", label: "Reports", icon: "users-three", also: ["/guidelines/"] },
];
const isOn = (path: string, t: (typeof TABS)[number]) => path === t.href || t.also.some((a) => path.startsWith(a));

export default function SectionNav() {
  const path = usePathname();
  return (
    <>
      {/* wide screens: the same four, as a segmented row under the top bar, on the wordmark's left edge */}
      <div className="mt-s3 hidden md:flex">
        <nav aria-label="Sections" className="nav-wide">
          {TABS.map((t) => (
            <Link key={t.href} href={t.href} aria-current={isOn(path, t) ? "page" : undefined}><Icon name={isOn(path, t) ? `${t.icon}-fill` : t.icon} size={19} /> {t.label}</Link>
          ))}
        </nav>
      </div>
      {/* phones: a floating white rounded rectangle above the home indicator; the lit tab is filled ink inside it */}
      <nav aria-label="Sections" className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center px-4 md:hidden" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)" }}>
        <div className="cs-dock-row pointer-events-auto">
        <ul className="cs-dock">
          {TABS.map((t) => {
            const on = isOn(path, t);
            return (
              <li key={t.href}>
                <Link href={t.href} aria-current={on ? "page" : undefined} className="cs-dock-tab">
                  <Icon name={on ? `${t.icon}-fill` : t.icon} size={22} px /><span>{t.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        {/* ʻIo, detached: on Now it drops you into the field; elsewhere it takes you there. */}
        <Link href="/#ask" aria-label="Ask Kilo" className="cs-dock-ask"
          onClick={(e) => { if (path === "/") { e.preventDefault(); const el = document.getElementById("ask"); el?.scrollIntoView({ block: "center" }); el?.focus(); } }}>
          <Icon name="magnifying-glass" size={26} px />
        </Link>
        </div>
      </nav>
    </>
  );
}
