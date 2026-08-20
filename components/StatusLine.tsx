"use client";
import { WifiOff } from "lucide-react";
import { ago, fmtDateTime, fmtTime } from "@/lib/brand";

/** Quiet freshness line: ● Live · source · time. Dot turns amber >3 h, grey >12 h; offline shows the saved-copy time. */
export default function StatusLine({ gen, checkedAt, offline, source, right }: { gen: number; checkedAt: number; offline: boolean; source?: string; right?: React.ReactNode }) {
  const age = gen ? checkedAt - gen : 0;
  const dot = offline ? "bg-transparent ring-2 ring-sev4" : age > 12 * 3_600_000 ? "bg-sev1" : age > 3 * 3_600_000 ? "bg-sev2" : "bg-brand";
  return (
    <div className="mt-s3 flex items-center gap-s2 text-label text-muted num">
      {offline ? <WifiOff className="size-4 text-sev4" aria-hidden /> : <span className={`inline-block size-2 rounded-full ${dot}`} aria-hidden />}
      {!gen ? <span>Loading…</span> : offline ? <span><span className="font-medium text-sev4">Offline</span> · showing {fmtDateTime(gen)} data</span>
        : <span><span className="font-medium text-ink-2">{age > 12 * 3_600_000 ? "May be outdated" : "Live"}</span>{source ? ` · ${source}` : ""} · {fmtTime(gen)} <span className="text-muted">({ago(gen, checkedAt)})</span></span>}
      {right && <span className="ml-auto text-muted">{right}</span>}
    </div>
  );
}
