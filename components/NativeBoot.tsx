"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { nativeBoot } from "@/lib/native";

/** Runs the native setup once; renders nothing. A no-op on the web. */
export default function NativeBoot() {
  const router = useRouter();
  useEffect(() => { void nativeBoot((path) => router.push(path)); }, [router]);
  return null;
}
