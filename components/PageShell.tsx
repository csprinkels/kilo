"use client";
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
    <main className="relative z-[1] mx-auto w-full max-w-2xl px-5 pb-32 md:pb-20">
      <TopBar island={island} onIsland={onIsland} />
      <SectionNav />
      {fetchedAt != null && <Freshness gen={gen ?? fetchedAt} checkedAt={fetchedAt} offline={!!offline} weak={weak} />}
      <h1 className="h-display mt-s6">{title}</h1>
      {line && <p className="mt-s2 max-w-[36rem] text-body text-ink-2">{line}</p>}
      {children}
      {source && gen ? <p className="mt-s7 text-small text-ink-2 num">From {source}. Checked {fmtClock(gen, fetchedAt)}.</p> : null}
    </main>
  );
}

/** Section heading (serif title) with an optional one-line sentence under it. */
export const H2 = ({ children, sentence, right }: { children: React.ReactNode; sentence?: React.ReactNode; right?: React.ReactNode }) => (
  <>
    <h2 className="h-title mt-s7">{children}{right ? <span className="ml-s3 font-sans text-small font-normal text-ink-2 num">{right}</span> : null}</h2>
    {sentence && <p className="mt-s2 max-w-[36rem] text-body text-ink-2">{sentence}</p>}
  </>
);

export const Section = ({ title, sentence, children }: { title: React.ReactNode; sentence?: React.ReactNode; children?: React.ReactNode }) => (
  <section className="mt-s7">
    <h2 className="h-title">{title}</h2>
    {sentence && <p className="mt-s2 max-w-[36rem] text-body text-ink-2">{sentence}</p>}
    {children}
  </section>
);
