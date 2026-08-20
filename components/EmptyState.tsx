"use client";
import { CircleCheck, WifiOff, type LucideIcon } from "lucide-react";

/** Never a blank page: a calm "nothing to report", or a plain "couldn't load" with a way to try again. */
export default function EmptyState({ kind = "quiet", title, children, icon, onRetry }: { kind?: "quiet" | "error"; title: string; children?: React.ReactNode; icon?: LucideIcon; onRetry?: () => void }) {
  const Icon = icon ?? (kind === "error" ? WifiOff : CircleCheck);
  return (
    <div className="mt-s4 flex items-start gap-s3">
      <Icon className={`mt-1 size-6 shrink-0 ${kind === "error" ? "text-warn" : "text-ink-2"}`} aria-hidden />
      <div className="min-w-0">
        <p className="text-body font-semibold text-ink">{title}</p>
        {children && <p className="mt-1 text-body text-ink-2">{children}</p>}
        {onRetry && <button className="btn mt-s3" onClick={onRetry}>Try again</button>}
      </div>
    </div>
  );
}
