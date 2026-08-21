"use client";
import Icon, { type IconName } from "@/components/Icon";

/** Never a blank page: a calm "nothing to report", or a plain "couldn't load" with a way to try again. */
export default function EmptyState({ kind = "quiet", title, children, icon, onRetry }: { kind?: "quiet" | "error"; title: string; children?: React.ReactNode; icon?: IconName; onRetry?: () => void }) {
  const glyph = icon ?? (kind === "error" ? "wifi-slash" : "check-circle");
  return (
    <div className="mt-s4 flex items-start gap-s3">
      <Icon name={glyph} size={22} className={`mt-1 ${kind === "error" ? "text-warn" : "text-ink-2"}`} />
      <div className="min-w-0">
        <p className="text-body font-semibold text-ink">{title}</p>
        {children && <p className="mt-1 text-body text-ink-2">{children}</p>}
        {onRetry && <button className="btn mt-s3" onClick={onRetry}>Try again</button>}
      </div>
    </div>
  );
}
