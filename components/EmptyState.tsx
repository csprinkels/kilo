"use client";
import { CircleCheck, WifiOff, type LucideIcon } from "lucide-react";

/** Never a blank page: a calm "nothing to report" or "couldn't reach" card with a timestamp. */
export default function EmptyState({ kind = "quiet", title, children, icon }: { kind?: "quiet" | "error" | "loading"; title: string; children?: React.ReactNode; icon?: LucideIcon }) {
  const Icon = icon ?? (kind === "error" ? WifiOff : CircleCheck);
  if (kind === "loading") return <div className="mt-s4 space-y-s3" aria-hidden><div className="h-[180px] animate-pulse rounded-hero bg-surface-2" /><div className="h-[120px] animate-pulse rounded-card bg-surface-2" /></div>;
  return (
    <div className="card mt-s4 flex items-start gap-s3">
      <Icon className={`mt-0.5 size-6 shrink-0 ${kind === "error" ? "text-sev2" : "text-emerald-600 dark:text-emerald-400"}`} aria-hidden />
      <div><p className="text-body font-semibold">{title}</p>{children && <p className="mt-0.5 text-body text-ink-2">{children}</p>}</div>
    </div>
  );
}
