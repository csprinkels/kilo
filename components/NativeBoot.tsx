"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { nativeBoot } from "@/lib/native";
import { syncPush } from "@/lib/push";

/** Runs the native setup once; renders nothing. A no-op on the web. */
export default function NativeBoot() {
  const router = useRouter();
  useEffect(() => { void nativeBoot((path) => router.push(path)); }, [router]);
  // Web too: heals a phone whose warnings are still pointed at an island it left.
  useEffect(() => { void syncPush(); }, []);
  return null;
}
