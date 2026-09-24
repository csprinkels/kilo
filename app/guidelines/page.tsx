"use client";
import PageShell from "@/components/PageShell";
import { REPORT_TYPES } from "@/lib/reportRules";
import "../support/text.css";

const hours = (ms: number) => Math.round(ms / 3_600_000);
const RULES: [string, string][] = [
  ["Call 911 first.", "If anyone is hurt or in danger, call 911 before you post here."],
  ["Say what you saw, where, and when.", "A crash, a light out, a flooded road, power out, a lost pet."],
  ["No names, plates, phone numbers, or home addresses.", "Do not say who you think did it. We stop those before anyone sees them."],
  ["If you are not sure, say so.", "Every post says “not checked” because a neighbor wrote it, not an official."],
  ["Posts clear by themselves.", `A crash after ${hours(REPORT_TYPES.crash.ttlMs)} hours, a light out after ${hours(REPORT_TYPES.signal_out.ttlMs)}, a lost pet after a week.`],
  ["Be kind.", "No threats, no insults, no piling on. A phone that keeps doing this gets blocked."],
  ["Help keep it clean.", "If a post breaks these rules, open it and tap “Flag this post”. Three flags send it back to a person, unless more neighbors have confirmed it than flagged it. To stop seeing one person entirely, open their post and tap “Hide posts from this neighbor”."],
];

export default function Guidelines() {
  return (
    <PageShell title="Neighbor rules" sentence="Seven rules that keep neighbor reports honest and useful.">
      <div className="cs-stack pg-text">
        <section className="cs-card">
          <ol className="m-0 list-none p-0">
            {RULES.map(([h, b], i) => (
              <li key={h} className="cs-row">
                <span className="h-title w-7 shrink-0 num">{i + 1}</span>
                <p className="cs-rowmain cs-body cs-flat"><strong>{h}</strong> {b}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="cs-card">
          <h2 className="cs-display cs-display--card">What we keep</h2>
          <p className="cs-body">A random code for your phone, not your name or number. Posts are deleted 30 days after they expire.</p>
          <p className="cs-body">You must be 18 or older to post. We do not keep where you are or any photos. No ads, and nothing is sold.</p>
          <p className="cs-body">Have a question, or want a post taken down? <a href="mailto:aloha@csprinkels.com">Email aloha@csprinkels.com</a></p>
        </section>
      </div>
    </PageShell>
  );
}
