"use client";
import Icon, { type IconName } from "@/components/Icon";

/** Never a blank page: a calm "nothing to report", or a plain "couldn't load" with a way to try again. A tile, a title, a line, a button — inside whatever card the page gives it. */
export default function EmptyState({ kind = "quiet", title, children, icon, onRetry }: { kind?: "quiet" | "error"; title: string; children?: React.ReactNode; icon?: IconName; onRetry?: () => void }) {
  const glyph = icon ?? (kind === "error" ? "wifi-slash" : "check-circle");
  return (
    <div className="cs-lead mt-s4">
      <span className={`cs-ictile ${kind === "error" ? "cs-ictile--warn" : ""}`}><Icon name={glyph} size={18} /></span>
      <div className="cs-lead-t">
        <p className="cs-lead-h">{title}</p>
        {children && <p className="cs-lead-p">{children}</p>}
        {onRetry && <button className="cs-btn-ink mt-s3" onClick={onRetry}>Try again</button>}
      </div>
    </div>
  );
}
