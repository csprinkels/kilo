"use client";
import { ChevronDown } from "lucide-react";

/** The only accordion in the app: the agency's own words, for people who want them. */
export default function OfficialWording({ title, body, children }: { title: string; body?: string; children?: React.ReactNode }) {
  return (
    <details className="group mt-s3">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 text-small font-semibold text-brand [&::-webkit-details-marker]:hidden">
        Official wording <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="mt-s2 rounded-card bg-surface-2 p-s4 text-small leading-relaxed text-ink-2">
        <p className="font-semibold text-ink">{title}</p>
        {body && <p className="mt-s2 whitespace-pre-line">{body}</p>}
        {children}
      </div>
    </details>
  );
}
