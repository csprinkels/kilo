"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "@/components/Icon";
import AskSheet from "@/components/AskSheet";

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
  const dialog = useRef<HTMLDialogElement>(null);
  const [asking, setAsking] = useState(false);
  const open = () => { setAsking(true); dialog.current?.showModal(); };
  const close = () => dialog.current?.close();
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
        <button type="button" aria-label="Ask Kilo" aria-haspopup="dialog" className="cs-dock-ask" onClick={open}>
          <Icon name="magnifying-glass" size={26} px />
        </button>
        </div>
      </nav>
      {/* ʻIo as a sheet: native <dialog> gives the focus trap, Escape and the backdrop. A tap on the
          backdrop lands on the dialog itself, which closes it. Unmounted on close, so it starts fresh. */}
      <dialog ref={dialog} className="cs-dialog" aria-label="Ask Kilo"
        onClose={() => setAsking(false)} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
        {asking && <AskSheet onClose={close} />}
      </dialog>
    </>
  );
}
