import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { APP_NAME, okina } from "@/lib/brand";

const RULES: [string, string][] = [
  ["Call 911 first.", "If anyone is hurt or in danger, call 911 before posting here."],
  ["Report what you see, where and when.", "Crashes, signals out, flooded or blocked roads, power or water outages, lost or found pets. Stick to facts you observed yourself."],
  ["No people.", "Don't post names, license plates, phone numbers, home addresses, or descriptions that single someone out. Don't call anyone a thief or a suspect. Posts that do are held automatically."],
  ["No guessing.", "If you're unsure, say so. Reports show as Unverified until neighbours confirm — and even then they're neighbours, not officials."],
  ["Keep it local.", "Reports stay in the district you pick and expire on their own — a crash in two hours, a signal outage in twelve, a lost pet in a week."],
  ["Be decent.", "No threats, harassment, slurs, or dogpiling. Repeat problems get a device blocked."],
  ["We moderate after the fact, not in real time.", "Tap Report on anything that breaks these rules; three reports send a post back to review. Community reports are unverified, may be wrong or outdated, and this app is not an emergency service."],
];

export default function Guidelines() {
  return (
    <main className="relative z-[1] mx-auto w-full max-w-2xl px-5 pb-20 pt-6 text-[16px] leading-relaxed text-ink-2">
      <Link href="/report/" className="inline-flex items-center gap-1 text-sm font-medium text-muted"><ArrowLeft className="size-4" /> Back</Link>
      <h1 className="display mt-5 text-[36px] font-medium leading-[1] tracking-[-0.02em] text-ink">Community guidelines</h1>
      <p className="mt-4">The neighbour reports on {okina(APP_NAME)} work because people keep them honest and boring. Seven rules:</p>
      <ol className="mt-5 space-y-4">
        {RULES.map(([h, b], i) => (
          <li key={h} className="flex gap-3">
            <span className="display mt-0.5 w-6 shrink-0 text-[20px] text-muted">{i + 1}</span>
            <span><strong className="text-ink">{h}</strong> {b}</span>
          </li>
        ))}
      </ol>
      <h2 className="display mt-9 text-[22px] font-medium tracking-tight text-ink">What we store</h2>
      <p className="mt-2">
        Posters must be 18 or older. We store a hashed device id (not your name, phone, or account), the district, the time, and your text. Nothing else is collected: no location coordinates, no photos. Posts are purged 30 days after they expire. No ads, no selling data.
      </p>
      <p className="mt-6 text-sm text-muted">Questions or takedown requests: aloha@csprinkels.com</p>
    </main>
  );
}
