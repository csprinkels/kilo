"use client";
import type { LucideIcon } from "lucide-react";

/** One coloured-background banner per screen at most (sev 3–4); lower severities stay on the paper surface with a coloured rule. */
export default function Banner({ sev, icon: Icon, title, children, meta }: { sev: 1 | 2 | 3 | 4; icon: LucideIcon; title?: string; children: React.ReactNode; meta?: string }) {
  const rule = { 4: "border-sev4 text-sev4", 3: "border-sev3 text-sev3", 2: "border-sev2 text-sev2", 1: "border-sev1 text-sev1" }[sev];
  const bg = sev === 4 ? "bg-sev4-bg" : sev === 3 ? "bg-sev3-bg" : "bg-surface";
  return (
    <div role="status" className={`fade-up mt-s4 flex items-start gap-s3 rounded-card border-l-[3px] py-s3 pl-s3 pr-s4 ${rule} ${bg}`}>
      <Icon className="mt-0.5 size-6 shrink-0" aria-hidden />
      <div className="min-w-0 text-body leading-snug text-ink">
        {title && <p className="font-semibold">{title}</p>}
        <p className={title ? "mt-0.5" : ""}>{children}</p>
        {meta && <p className="mt-1 text-label text-muted num">{meta}</p>}
      </div>
    </div>
  );
}
