"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Script from "next/script";
import Icon, { type IconName } from "@/components/Icon";
import PageShell, { H2 } from "@/components/PageShell";
import { NeighborRow } from "@/components/ItemRow";
import { Notice } from "@/components/AlertBlock";
import EmptyState from "@/components/EmptyState";
import { HAWAII_DISTRICTS, districtFor } from "@/lib/places";
import { HELD_BY_DEFAULT, LOC_MAX, REPORT_TYPES, REPORT_TYPE_KEYS, TEXT_MAX, holdReason, validateReport, type HoldReason, type ReportType } from "@/lib/reportRules";
import { submitReport, type SubmitResult } from "@/lib/report";
import { track } from "@/lib/stat";
import { useFeed, useStoredIsland } from "@/lib/data";
import type { Island } from "@/lib/types";
import { fmtClock } from "@/lib/brand";

const TURNSTILE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY;
const SENTENCE = "What people nearby are seeing. Not checked by anyone official. Hurt or in danger? Call 911 first.";

/** Tile words and pictures. Labels are the everyday words, not the form's internal names. */
const TILE: Record<ReportType, { label: string; icon: IconName }> = {
  crash: { label: "Crash", icon: "car" },
  signal_out: { label: "Traffic light out", icon: "lightbulb-filament" },
  road_flooded: { label: "Road flooded", icon: "waves" },
  road_blocked: { label: "Road blocked", icon: "traffic-cone" },
  outage: { label: "Power or water out", icon: "lightning-slash" },
  lost_pet: { label: "Lost or found pet", icon: "paw-print" },
  other: { label: "Something else", icon: "question" },
};
const HOLD_WHY: Record<HoldReason, string> = {
  plate: "This mentions a license plate", phone: "This has a phone number", contact: "This has an email or a link",
  accusation: "This says who did it", address: "This has a home address", profanity: "This has strong words", caps: "This is in all capital letters",
};
const PLAIN_ERROR: Record<string, string> = {
  "Pick a report type.": "Pick what you saw.",
  "Pick a district.": "Pick which part of the island.",
  "Tell us a bit more.": "Tell us a bit more about it.",
  [`Where: 3–${LOC_MAX} characters.`]: "Tell us where. A road or town name is enough.",
  [`Details: ${TEXT_MAX} characters max.`]: "That is a bit long. Shorten it and try again.",
};

type Draft = { type?: ReportType; district?: string; locText: string; text: string; agreed: boolean };
const EMPTY: Draft = { locText: "", text: "", agreed: false };
const isType = (s: string | null): s is ReportType => !!s && s in REPORT_TYPES;

/** A card's headline in the Now card language: the picture in its bubble tile, then the serif line. */
function CardHead({ icon, children }: { icon: IconName; children: React.ReactNode }) {
  return (
    <h2 className="isl-h rp-head">
      <span className="isl-bubble"><Icon name={icon} size={20} /></span>
      {children}
    </h2>
  );
}

/** The chip-shaped way out of a card, to the rules. */
function RulesChip({ children }: { children: React.ReactNode }) {
  return (
    <p className="rp-chiprow">
      <Link href="/guidelines/" className="btn">
        <Icon name="users-three" size={18} />{children}<Icon name="caret-right" size={16} className="text-ink-2" />
      </Link>
    </p>
  );
}

export default function NeighborsPage() {
  const [island, setIsland] = useStoredIsland();
  const onHawaii = island === "hawaii" || island === "state";
  if (!onHawaii) {
    return <PageShell title="Reports" sentence="Neighbor reports are Hawaiʻi Island only for now." island={island} onIsland={setIsland}>{null}</PageShell>;
  }
  return <HawaiiNeighbors island={island} setIsland={setIsland} />;
}

function HawaiiNeighbors({ island, setIsland }: { island: Island; setIsland: (i: Island) => void }) {
  const { ess, snap, mode } = useFeed("hawaii");
  // /report/?type=road_blocked from the Roads page opens the form with that tile picked.
  const linkedType = useSyncExternalStore(() => () => {}, () => new URLSearchParams(window.location.search).get("type"), () => null);
  const [writing, setWriting] = useState<boolean | null>(null);
  const open = writing ?? isType(linkedType);
  const now = snap?.fetchedAt || ess?.fetchedAt || 0;
  const offline = !!ess?.offline && !!snap?.offline;
  const posts = (snap?.data?.items ?? []).filter((i) => i.tier === "community").sort((a, b) => b.lastConfirmedAt - a.lastConfirmedAt);

  return (
    <PageShell title="Reports" sentence={SENTENCE} island={island} onIsland={setIsland} fetchedAt={snap?.fetchedAt ?? ess?.fetchedAt} gen={snap?.data?.gen} offline={offline} weak={mode === "low" && !offline} source="your neighbors">
      <div className="now-island">
        {open ? (
          <ReportForm preset={isType(linkedType) ? linkedType : undefined} onClose={() => setWriting(false)} />
        ) : (
          <>
            <button className="btn btn-primary btn-big mt-s5" onClick={() => setWriting(true)}>
              <Icon name="note-pencil" size={20} />Report something
            </button>
            <H2>Reported near you</H2>
            {!snap?.data ? (
              offline
                ? <EmptyState kind="error" title="Can't load right now." onRetry={() => window.dispatchEvent(new Event("online"))}>Try again when you have signal. In an emergency call 911.</EmptyState>
                : <p className="isl-card rp-quiet mt-s3">Loading what neighbors reported…</p>
            ) : posts.length === 0 ? (
              <p className="isl-card rp-quiet mt-s3">Nothing reported today.</p>
            ) : (
              <ul className="list mt-s3">{posts.map((i) => <NeighborRow key={i.key} item={i} now={now} />)}</ul>
            )}
            <RulesChip>Rules for reports</RulesChip>
          </>
        )}
      </div>
    </PageShell>
  );
}

function ReportForm({ preset, onClose }: { preset?: ReportType; onClose: () => void }) {
  const [d, setD] = useState<Draft>({ ...EMPTY, type: preset });
  const [openedAt, setOpenedAt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const [result, setResult] = useState<{ r: SubmitResult; at: number } | null>(null);
  const [token, setToken] = useState<string | undefined>();

  // Words are kept on the phone until the post goes through, so a dropped signal never eats them.
  useEffect(() => {
    // A half-written or older draft must never take the form down with it: unreadable just means "start blank".
    let saved: Partial<Draft> | null = null;
    try { const raw = localStorage.getItem("reportDraft"); const v = raw ? JSON.parse(raw) : null; saved = v && typeof v === "object" ? v : null; } catch { saved = null; }
    queueMicrotask(() => { if (saved) setD((cur) => ({ ...EMPTY, ...saved, ...(cur.type ? { type: cur.type } : {}) })); setOpenedAt(Date.now()); });
  }, []);
  useEffect(() => { try { localStorage.setItem("reportDraft", JSON.stringify(d)); } catch { /* storage full: the words stay on screen */ } }, [d]);
  useEffect(() => {
    if (!TURNSTILE_KEY) return;
    (window as unknown as { onTurnstile?: (t: string) => void }).onTurnstile = (t) => setToken(t);
  }, []);

  const guessed = districtFor(d.locText);
  const district = guessed ?? d.district;
  const needPick = !guessed && d.locText.trim().length >= 3;
  const hold = holdReason(`${d.text} ${d.locText}`);
  // Ask for things in the order they appear on the screen: what, where, which part, the rest.
  const rawError = !d.type ? "Pick a report type." : d.locText.trim().length < 3 ? `Where: 3–${LOC_MAX} characters.`
    : validateReport({ type: d.type, text: d.text, locText: d.locText, island: "hawaii", district: district ?? "" });
  const problem = rawError ? (PLAIN_ERROR[rawError] ?? rawError) : !d.agreed ? "Check the box to say this is not an emergency." : null;
  const checking = !!TURNSTILE_KEY && !token;

  const send = async () => {
    setTried(true);
    if (problem || !d.type || !district || checking) return;
    setBusy(true);
    try {
      const r = await submitReport({ type: d.type, text: d.text, locText: d.locText, island: "hawaii", district, openedAt, website: "", turnstileToken: token });
      if (r.ok) track(`report:${r.status ?? "posted"}`);
      setResult({ r, at: Date.now() });
      if (r.ok) localStorage.removeItem("reportDraft");
    } catch {
      setResult({ r: { ok: false, error: "Could not send. Your words are saved. Try again when you have signal." }, at: Date.now() });
    } finally { setBusy(false); }
  };
  const again = () => { setResult(null); setD(EMPTY); setTried(false); setOpenedAt(Date.now()); };

  if (result?.r.ok) {
    const r = result.r;
    const line = r.status === "pending" ? "A person will read this first, usually within a day."
      : r.merged ? "Someone already reported this. We added your “me too”."
      : `Posted to ${district}. Neighbors see it marked “not checked”. It clears by itself around ${fmtClock(r.expiresAt, result.at)}.`;
    return (
      <section className="isl-card mt-s6">
        <CardHead icon={r.status === "pending" ? "note-pencil" : r.merged ? "users-three" : "check-circle"}>
          {r.status === "pending" ? "Saved for a person to read" : r.merged ? "Already reported" : "Posted"}
        </CardHead>
        <p className="isl-p max-w-[36rem] text-ink-2">{line}</p>
        <div className="mt-s4 flex flex-col gap-s2">
          <button className="btn btn-primary btn-big" onClick={onClose}>Back to Reports</button>
          <button className="btn btn-big" onClick={again}>Report another</button>
        </div>
      </section>
    );
  }

  return (
    <form className="mt-s2" onSubmit={(e) => { e.preventDefault(); void send(); }} noValidate>
      <Notice title="Hurt or in danger? Call 911 first.">This tells neighbors. It does not call for help.</Notice>

      <div className="isl-stack mt-s3">
        <section className="isl-card">
          <CardHead icon="camera">What did you see?</CardHead>
          <div className="rp-tiles">
            {REPORT_TYPE_KEYS.map((k) => {
              const t = TILE[k], on = d.type === k;
              return (
                <button key={k} type="button" onClick={() => setD({ ...d, type: k })} aria-pressed={on}
                  className={`rp-tile${on ? " rp-tile--on" : ""}${k === "other" ? " rp-tile--wide" : ""}`}>
                  <Icon name={`${t.icon}-fill`} size={30} />
                  <span className="inline-flex items-center gap-1">{on && <Icon name="check" className="size-5" aria-hidden />}{t.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="isl-card">
          <CardHead icon="map-pin">Where?</CardHead>
          <label htmlFor="where" className="rp-label">Near which road or town?</label>
          <input id="where" value={d.locText} maxLength={LOC_MAX} onChange={(e) => setD({ ...d, locText: e.target.value })}
            placeholder="Highway 130 by the Pāhoa post office" autoComplete="off" className="rp-field" />
          {guessed && <p className="rp-guess"><Icon name="check" size={18} />Looks like {guessed}.</p>}
          {needPick && (
            <>
              <label htmlFor="district" className="rp-label">Which part of the island?</label>
              <span className="rp-selwrap">
                <select id="district" value={d.district ?? ""} onChange={(e) => setD({ ...d, district: e.target.value || undefined })} className="rp-field rp-select">
                  <option value="">Pick one</option>
                  {Object.keys(HAWAII_DISTRICTS).map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
                <Icon name="caret-down" size={20} className="rp-caret" />
              </span>
            </>
          )}
        </section>

        <section className="isl-card">
          <CardHead icon="note-pencil">Anything else?</CardHead>
          <label htmlFor="more" className="rp-label">What you saw, not who you think did it.</label>
          <textarea id="more" value={d.text} maxLength={TEXT_MAX} rows={4} onChange={(e) => setD({ ...d, text: e.target.value })}
            placeholder={d.type ? REPORT_TYPES[d.type].hint : undefined} className="rp-field rp-area" />
          {hold
            ? <p className="isl-note rp-hold">{HOLD_WHY[hold]}, so a person will read it before it shows.</p>
            : d.type && HELD_BY_DEFAULT.includes(d.type) && <p className="isl-note rp-hold">A person reads &ldquo;Something else&rdquo; reports before they show.</p>}
        </section>

        <section className="isl-card">
          <button type="button" role="checkbox" aria-checked={d.agreed} onClick={() => setD({ ...d, agreed: !d.agreed })} className="row items-start">
            <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border-2 ${d.agreed ? "border-brand bg-brand text-brand-ink" : "border-ink-2"}`} aria-hidden>{d.agreed && <Icon name="check" className="size-5" />}</span>
            <span className="text-body text-ink">This is not an emergency and I am 18 or older.</span>
          </button>
          <hr className="rp-rule" />
          <RulesChip>Neighbor rules</RulesChip>

          {TURNSTILE_KEY && (
            <>
              <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="lazyOnload" />
              <div className="cf-turnstile mt-s3" data-sitekey={TURNSTILE_KEY} data-callback="onTurnstile" data-appearance="interaction-only" />
            </>
          )}

          {tried && problem && <p className="rp-bad" role="alert"><Icon name="warning-fill" size={20} />{problem}</p>}
          {result && !result.r.ok && <p className="rp-bad" role="alert"><Icon name="wifi-slash" size={20} />{result.r.error}</p>}
          <div className="mt-s4 flex flex-col gap-s2">
            <button type="submit" disabled={busy || checking} className="btn btn-primary btn-big disabled:opacity-60">{checking ? "Checking you are a person…" : busy ? "Sending…" : "Post to neighbors"}</button>
            <button type="button" className="btn btn-big" onClick={onClose}>Back to Reports</button>
          </div>
        </section>
      </div>

      {/* Honeypot: bots fill it, people never see it */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] size-12" onChange={() => {}} />
    </form>
  );
}
