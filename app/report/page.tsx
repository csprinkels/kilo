"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { ArrowLeft, CarFront, CircleCheck, Clock, Dog, HelpCircle, Siren, TrafficCone, Waves, ZapOff, type LucideIcon } from "lucide-react";
import SectionNav from "@/components/SectionNav";
import { HAWAII_DISTRICTS, districtFor } from "@/lib/places";
import { HOLD_COPY, LOC_MAX, REPORT_TYPES, REPORT_TYPE_KEYS, TEXT_MAX, holdReason, validateReport, type ReportType } from "@/lib/reportRules";
import { submitReport, type SubmitResult } from "@/lib/report";
import { fmtDateTime, okina } from "@/lib/brand";

const TYPE_ICON: Record<ReportType, LucideIcon> = { crash: CarFront, signal_out: TrafficCone, road_flooded: Waves, road_blocked: TrafficCone, outage: ZapOff, lost_pet: Dog, other: HelpCircle };
const TURNSTILE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY;

type Draft = { type?: ReportType; district?: string; locText: string; text: string; agreed: boolean };
const EMPTY: Draft = { locText: "", text: "", agreed: false };

export default function ReportPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [d, setD] = useState<Draft>(EMPTY);
  const [openedAt, setOpenedAt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [token, setToken] = useState<string | undefined>();

  useEffect(() => {
    const saved = localStorage.getItem("reportDraft");
    queueMicrotask(() => { if (saved) setD({ ...EMPTY, ...JSON.parse(saved) }); setOpenedAt(Date.now()); });
  }, []);
  useEffect(() => { localStorage.setItem("reportDraft", JSON.stringify(d)); }, [d]);
  useEffect(() => {
    if (!TURNSTILE_KEY) return;
    (window as unknown as { onTurnstile?: (t: string) => void }).onTurnstile = (t) => setToken(t);
  }, []);

  const hold = useMemo(() => holdReason(`${d.text} ${d.locText}`), [d.text, d.locText]);
  const guessed = useMemo(() => districtFor(d.locText), [d.locText]);
  const error = useMemo(() => (d.type ? validateReport({ type: d.type, text: d.text, locText: d.locText, island: "hawaii", district: d.district ?? "" }) : null), [d]);

  const send = async () => {
    if (!d.type || !d.district || error || !d.agreed) return;
    setBusy(true);
    try {
      const r = await submitReport({ type: d.type, text: d.text, locText: d.locText, island: "hawaii", district: d.district, openedAt, website: "", turnstileToken: token });
      setResult(r);
      if (r.ok) { localStorage.removeItem("reportDraft"); }
    } catch {
      setResult({ ok: false, error: "Couldn't reach the server. Your draft is saved — try again when you have a better connection." });
    } finally { setBusy(false); }
  };

  return (
    <main className="relative z-[1] mx-auto w-full max-w-2xl px-5 pb-20 pt-6">
      <Link href="/" className="inline-flex items-center gap-1 text-sm font-medium text-muted"><ArrowLeft className="size-4" /> Back</Link>
      <SectionNav />
      <h1 className="display mt-4 text-[34px] font-medium leading-[1] tracking-[-0.02em] text-ink">Report something</h1>
      <p className="mt-2 flex items-start gap-2 rounded-xl bg-sev4-bg px-3 py-2 text-[14px] font-medium text-sev4"><Siren className="mt-0.5 size-4 shrink-0" /> If someone is hurt or in danger, call 911 first. This is for letting neighbours know.</p>

      {result?.ok ? (
        <Done result={result} district={d.district} onAgain={() => { setResult(null); setD(EMPTY); setStep(1); setOpenedAt(Date.now()); }} />
      ) : (
        <>
          <ol className="mt-5 flex gap-2 text-[12px] font-semibold uppercase tracking-wide text-muted" aria-label="Steps">
            {["What", "Where", "Details"].map((l, i) => <li key={l} className={`flex-1 border-t-2 pt-1 ${step > i ? "border-brand text-brand" : "border-line"}`}>{i + 1}. {l}</li>)}
          </ol>

          {step === 1 && (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {REPORT_TYPE_KEYS.map((k) => {
                const Icon = TYPE_ICON[k];
                return (
                  <button key={k} onClick={() => { setD({ ...d, type: k }); setStep(2); }} aria-pressed={d.type === k}
                    className={`flex min-h-[88px] flex-col items-start justify-between rounded-2xl border p-3 text-left transition-colors ${d.type === k ? "border-brand bg-surface" : "border-line bg-surface hover:border-ink-2"}`}>
                    <Icon className="size-5 text-brand" />
                    <span className="text-[15px] font-semibold leading-tight">{REPORT_TYPES[k].label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {step === 2 && d.type && (
            <div className="mt-4 space-y-4">
              <p className="text-[14px] text-ink-2"><strong className="text-ink">{REPORT_TYPES[d.type].label}</strong> · Hawaiʻi Island only for now.</p>
              <label className="block">
                <span className="text-[13px] font-semibold">Nearest intersection or landmark</span>
                <input value={d.locText} maxLength={LOC_MAX} onChange={(e) => setD({ ...d, locText: e.target.value, district: d.district ?? districtFor(e.target.value) })}
                  placeholder="e.g. Hwy 11 at Kurtistown, Puainako & Kilauea" autoComplete="off"
                  className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-3 text-[16px]" />
                <span className="mt-1 block text-[12px] text-muted">{d.locText.length}/{LOC_MAX}{guessed && !d.district ? ` · looks like ${okina(guessed)}` : ""}</span>
              </label>
              <label className="block">
                <span className="text-[13px] font-semibold">District</span>
                <select value={d.district ?? ""} onChange={(e) => setD({ ...d, district: e.target.value || undefined })} className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-3 text-[16px]">
                  <option value="">Pick a district…</option>
                  {Object.keys(HAWAII_DISTRICTS).map((k) => <option key={k} value={k}>{okina(k)}</option>)}
                </select>
                <span className="mt-1 block text-[12px] text-muted">Reports stay inside the district you pick.</span>
              </label>
              <div className="flex gap-2">
                <button onClick={() => setStep(1)} className="rounded-full border border-line px-4 py-2 text-[14px] font-medium">Back</button>
                <button onClick={() => setStep(3)} disabled={d.locText.trim().length < 3 || !d.district} className="rounded-full bg-brand px-5 py-2 text-[14px] font-semibold text-brand-ink disabled:opacity-40">Next</button>
              </div>
            </div>
          )}

          {step === 3 && d.type && (
            <div className="mt-4 space-y-4">
              <p className="text-[14px] text-ink-2"><strong className="text-ink">{REPORT_TYPES[d.type].label}</strong> · {d.locText} · {okina(d.district ?? "")}</p>
              <label className="block">
                <span className="text-[13px] font-semibold">Details {d.type === "other" ? "" : "(optional)"}</span>
                <textarea value={d.text} maxLength={TEXT_MAX} rows={4} onChange={(e) => setD({ ...d, text: e.target.value })} placeholder={REPORT_TYPES[d.type].hint}
                  className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-3 text-[16px]" />
                <span className="mt-1 block text-[12px] text-muted">{d.text.length}/{TEXT_MAX} · what you saw, not who you think did it</span>
              </label>
              {hold && <p className="rounded-xl bg-sev2-bg px-3 py-2 text-[13px] text-sev2">This mentions {HOLD_COPY[hold]}, so a person will review it before it shows. That usually takes under a day.</p>}
              {d.type === "other" && !hold && <p className="flex items-center gap-2 text-[13px] text-muted"><Clock className="size-3.5" /> &ldquo;Something else&rdquo; reports are reviewed by a person before they show.</p>}
              <label className="flex items-start gap-2 text-[14px]">
                <input type="checkbox" checked={d.agreed} onChange={(e) => setD({ ...d, agreed: e.target.checked })} className="mt-1 size-4" />
                <span>I&apos;ve read the <Link href="/guidelines/" className="font-medium text-brand underline underline-offset-4">community guidelines</Link>, this isn&apos;t an emergency, and I&apos;m 18 or older.</span>
              </label>
              {TURNSTILE_KEY && (
                <>
                  <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="lazyOnload" />
                  <div className="cf-turnstile" data-sitekey={TURNSTILE_KEY} data-callback="onTurnstile" data-appearance="interaction-only" />
                </>
              )}
              {/* Honeypot: bots fill it, people never see it */}
              <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px]" onChange={() => {}} />
              {error && d.text && <p className="text-[13px] text-sev4">{error}</p>}
              {result && !result.ok && <p className="rounded-xl bg-sev4-bg px-3 py-2 text-[13px] text-sev4">{result.error}</p>}
              <div className="flex gap-2">
                <button onClick={() => setStep(2)} className="rounded-full border border-line px-4 py-2 text-[14px] font-medium">Back</button>
                <button onClick={send} disabled={busy || !!error || !d.agreed || (!!TURNSTILE_KEY && !token)} className="rounded-full bg-brand px-5 py-2 text-[14px] font-semibold text-brand-ink disabled:opacity-40">{busy ? "Sending…" : "Post to neighbours"}</button>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}

function Done({ result, district, onAgain }: { result: Extract<SubmitResult, { ok: true }>; district?: string; onAgain: () => void }) {
  return (
    <div className="mt-6 rounded-2xl border border-line bg-surface p-5">
      <CircleCheck className="size-7 text-emerald-600" />
      {result.status === "pending" ? (
        <>
          <p className="display mt-2 text-[22px] font-medium">Held for review</p>
          <p className="mt-1 text-[15px] text-ink-2">{result.holdReason && result.holdReason in HOLD_COPY ? `It mentions ${HOLD_COPY[result.holdReason as keyof typeof HOLD_COPY]}, so a` : "A"} person will look at it before it shows. Usually within a day.</p>
        </>
      ) : result.merged ? (
        <>
          <p className="display mt-2 text-[22px] font-medium">Someone already reported this</p>
          <p className="mt-1 text-[15px] text-ink-2">We added your confirmation to their report in {okina(district ?? "")}. Thank you.</p>
        </>
      ) : (
        <>
          <p className="display mt-2 text-[22px] font-medium">Posted to {okina(district ?? "")}</p>
          <p className="mt-1 text-[15px] text-ink-2">It shows as <strong>Unverified</strong> until neighbours confirm, and clears on its own around {fmtDateTime(result.expiresAt)} HST.</p>
        </>
      )}
      <div className="mt-4 flex gap-2">
        <Link href="/" className="rounded-full bg-brand px-5 py-2 text-[14px] font-semibold text-brand-ink">See the board</Link>
        <button onClick={onAgain} className="rounded-full border border-line px-4 py-2 text-[14px] font-medium">Report another</button>
      </div>
    </div>
  );
}
