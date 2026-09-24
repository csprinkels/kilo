"use client";
import Link from "next/link";
import Icon from "./Icon";
import SectionNav from "./SectionNav";
import TopBar from "./TopBar";
import Freshness from "./Freshness";
import type { Island } from "@/lib/types";
import { fmtClock } from "@/lib/brand";

/**
 * The one skeleton every page uses: top bar · freshness · title · one sentence · content · "From {agency}. Checked {time}." footer.
 * `sentence` is the plain-language line under the title (≤ 20 words). `source` is the agency in plain words ("the National Weather Service").
 */
export default function PageShell({
  title, sentence, blurb, island, onIsland, fetchedAt, gen, offline, weak, source, children,
}: {
  title: React.ReactNode; sentence?: React.ReactNode; blurb?: React.ReactNode; island?: Island; onIsland?: (i: Island) => void;
  fetchedAt?: number; gen?: number; offline?: boolean; weak?: boolean; source?: string; children: React.ReactNode;
}) {
  const line = sentence ?? blurb;
  return (
    <main className="relative z-[1] mx-auto w-full max-w-2xl px-4 pb-32 md:pb-20">
      <TopBar island={island} onIsland={onIsland} />
      <SectionNav />
      {fetchedAt != null && <Freshness gen={gen ?? 0} checkedAt={fetchedAt} offline={!!offline} weak={weak} />}
      <h1 className="h-display mt-s6">{title}</h1>
      {line && <p className="mt-s2 max-w-[36rem] text-[15px] leading-normal text-ink-2">{line}</p>}
      {children}
      {source && gen ? <p className="mt-s5 text-[13px] leading-snug text-mute num">From {source}. Checked {fmtClock(gen, fetchedAt)}.</p> : null}
      {/* the settings row is the card row every page ends on */}
      <Link href="/sources/" className="cs-settings mt-s3">
        <span className="cs-ictile cs-ictile--ink"><Icon name="gear" size={18} /></span>
        <span className="cs-settings-t">Settings and about</span>
        <Icon name="caret-right" size={16} className="cs-ic" />
      </Link>
    </main>
  );
}

/** Section heading with an optional one-line sentence under it. */
export const H2 = ({ children, sentence, right }: { children: React.ReactNode; sentence?: React.ReactNode; right?: React.ReactNode }) => (
  <>
    <h2 className="h-title mt-s7">{children}{right ? <span className="ml-s3 font-sans text-small font-normal text-ink-2 num">{right}</span> : null}</h2>
    {sentence && <p className="mt-s2 max-w-[36rem] text-[15px] leading-normal text-ink-2">{sentence}</p>}
  </>
);

export const Section = ({ title, sentence, children, id }: { title: React.ReactNode; sentence?: React.ReactNode; children?: React.ReactNode; id?: string }) => (
  <section id={id} className="mt-s7 scroll-mt-s4">
    <h2 className="h-title">{title}</h2>
    {sentence && <p className="mt-s2 max-w-[36rem] text-[15px] leading-normal text-ink-2">{sentence}</p>}
    {children}
  </section>
);
