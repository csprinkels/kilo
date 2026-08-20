"use client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import SectionNav from "@/components/SectionNav";

export default function Page() {
  return (
    <main className="relative z-[1] mx-auto w-full max-w-2xl px-5 pb-20 pt-6">
      <Link href="/" className="inline-flex items-center gap-1 text-sm font-medium text-muted"><ArrowLeft className="size-4" /> Back</Link>
      <SectionNav />
      <h1 className="display mt-4 text-[34px] font-medium leading-[1] tracking-[-0.02em] text-ink">Tsunami</h1>
      <p className="mt-3 text-[15px] text-ink-2">Coming soon.</p>
    </main>
  );
}
