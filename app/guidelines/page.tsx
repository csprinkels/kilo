"use client";
import PageShell, { Section } from "@/components/PageShell";
import { REPORT_TYPES } from "@/lib/reportRules";

const hours = (ms: number) => Math.round(ms / 3_600_000);
const RULES: [string, string][] = [
  ["Call 911 first.", "If anyone is hurt or in danger, call 911 before you post here."],
  ["Say what you saw, where, and when.", "A crash, a light out, a flooded road, power out, a lost pet."],
  ["No names, plates, phone numbers, or home addresses.", "Do not say who you think did it. We stop those before anyone sees them."],
  ["If you are not sure, say so.", "Every post says “not checked” because a neighbor wrote it, not an official."],
  ["Posts clear by themselves.", `A crash after ${hours(REPORT_TYPES.crash.ttlMs)} hours, a light out after ${hours(REPORT_TYPES.signal_out.ttlMs)}, a lost pet after a week.`],
  ["Be kind.", "No threats, no insults, no piling on. A phone that keeps doing this gets blocked."],
  ["Help keep it clean.", "If a post breaks these rules, open it and tap “Flag this post”. Three flags and a person reviews it."],
];

export default function Guidelines() {
  return (
    <PageShell title="Neighbor rules" sentence="Seven rules that keep neighbor reports honest and useful.">
      <ol className="mt-s5 max-w-[36rem]">
        {RULES.map(([h, b], i) => (
          <li key={h} className="flex gap-s3 border-t border-line py-s4 first:border-t-0">
            <span className="h-title w-7 shrink-0 num">{i + 1}</span>
            <span className="text-body text-ink-2"><strong className="font-semibold text-ink">{h}</strong> {b}</span>
          </li>
        ))}
      </ol>
      <Section title="What we keep" sentence="A random code for your phone, not your name or number. Posts are deleted 30 days after they expire.">
        <p className="mt-s2 max-w-[36rem] text-body text-ink-2">You must be 18 or older to post. We do not keep where you are or any photos. No ads, and nothing is sold.</p>
        <p className="mt-s4 max-w-[36rem] text-body text-ink-2">Have a question, or want a post taken down? <a href="mailto:aloha@csprinkels.com" className="inline-flex min-h-11 items-center font-semibold text-brand">Email aloha@csprinkels.com</a></p>
      </Section>
    </PageShell>
  );
}
