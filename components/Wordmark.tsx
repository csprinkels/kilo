"use client";
import { APP_NAME } from "@/lib/brand";

/** Wordmark: the ʻio hawk plus Merriweather “ʻio”. Letters follow currentColor. */
export default function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/io-mark.svg" alt="" width={28} height={28} className="size-7 shrink-0" aria-hidden />
      <span className="font-display text-[1.375rem] font-bold leading-none">{APP_NAME}</span>
    </span>
  );
}

/** Large hawk for first-run and splash-like moments. Always shown next to a word. */
export function IoMark({ size = 120, className = "" }: { size?: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/icon.svg" alt="" aria-hidden width={size} height={size} className={`inline-block shrink-0 rounded-[22%] ${className}`} style={{ width: size, height: size }} />;
}
