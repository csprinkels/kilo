"use client";
import { APP_NAME } from "@/lib/brand";

/** The name with the mascot beside it: ʻio, the Hawaiian hawk — the kilo who reads the sky. Letters follow currentColor. */
export default function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/io-mark.png" alt="" aria-hidden width={28} height={28} className="size-7 shrink-0" />
      <span className="font-display text-[1.375rem] font-bold leading-none">{APP_NAME}</span>
    </span>
  );
}
