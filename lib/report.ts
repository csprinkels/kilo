"use client";
import { DATA_URL } from "./data";

export const deviceId = () => {
  let id = localStorage.getItem("deviceId");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("deviceId", id); }
  return id;
};

export type SubmitResult = { ok: true; id: string; status: "live" | "pending"; merged: boolean; expiresAt: number; holdReason?: string } | { ok: false; error: string };

export async function submitReport(body: { type: string; text: string; locText: string; island: string; district: string; openedAt: number; website: string; turnstileToken?: string }): Promise<SubmitResult> {
  const res = await fetch(`${DATA_URL}/v1/reports`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, deviceId: deviceId() }), signal: AbortSignal.timeout(30_000),
  });
  return (await res.json()) as SubmitResult;
}

const votedKey = "votes";
export const hasVoted = (rid: string) => (JSON.parse(localStorage.getItem(votedKey) ?? "[]") as string[]).includes(rid);
export async function voteReport(rid: string, vote: "still" | "gone" | "flag"): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${DATA_URL}/v1/reports/vote`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: rid, vote, deviceId: deviceId(), openedAt: Date.now() - 5000 }), signal: AbortSignal.timeout(30_000),
  });
  const out = (await res.json()) as { ok: boolean; error?: string };
  if (out.ok) localStorage.setItem(votedKey, JSON.stringify([...new Set([...(JSON.parse(localStorage.getItem(votedKey) ?? "[]") as string[]), rid])]));
  return out;
}
