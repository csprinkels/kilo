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
      {/* wide screens: the same four, as pills under the top bar */}
      <div className="mt-s3 hidden md:block">
        <nav aria-label="Sections" className="nav-wide">
          {TABS.map((t) => (
            <Link key={t.href} href={t.href} aria-current={isOn(path, t) ? "page" : undefined}><Icon name={isOn(path, t) ? `${t.icon}-fill` : t.icon} size={19} /> {t.label}</Link>
          ))}
        </nav>
      </div>
      {/* phones: a floating frosted pill above the home indicator; the lit tab sits on its own pill inside it */}
      <nav aria-label="Sections" className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center px-4 md:hidden" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)" }}>
        {/* Four even quarters; the label sizes itself to the bar's width so the longest label always clears the edge. */}
        <ul className="glass pointer-events-auto @container grid w-full max-w-md grid-cols-4 gap-[4px] rounded-full p-[4px]">
          {TABS.map((t) => {
            const on = isOn(path, t);
            return (
              <li key={t.href}>
                <Link href={t.href} aria-current={on ? "page" : undefined}
                  className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-full px-[2px] font-semibold leading-tight transition-colors [font-size:clamp(10px,3cqi,12px)] ${on ? "bg-surface-2 text-brand" : "text-ink-2"}`}>
                  <Icon name={on ? `${t.icon}-fill` : t.icon} size={24} px /> {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
