"use client";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import { Notice } from "@/components/AlertBlock";
import { API_URL } from "@/lib/data";
import { enablePush, pushStatus, type PushStatus } from "@/lib/push";
import { fmtClock } from "@/lib/brand";

type Row = { id: string; type: string; text: string; locText: string; island: string; district: string; status: "pending" | "live"; holdReason?: string; createdAt: number; expiresAt: number; confirms: number; flags: number };
const WHY: Record<string, string> = { review: "“Something else” reports are always read first", plate: "mentions a license plate", name: "mentions a person by name", flagged: "neighbors flagged it", link: "has a link", phone: "has a phone number" };
const TYPE: Record<string, string> = { crash: "Crash", signal_out: "Traffic light out", road_flooded: "Road flooded", road_blocked: "Road blocked", outage: "Power or water out", lost_pet: "Lost or found pet", other: "Something else" };

// The key arrives once in the URL (?key=…), then lives in this browser only.
const keyStore = {
  subscribe: (cb: () => void) => { addEventListener("storage", cb); return () => removeEventListener("storage", cb); },
  get: () => { const q = new URLSearchParams(location.search).get("key"); if (q) { localStorage.setItem("modKey", q); history.replaceState(null, "", "/mod/"); } return localStorage.getItem("modKey"); },
};

/** The one moderator's page: what is waiting, what went live today, Show / Hide. Not linked from anywhere; useless without the key. */
export default function ModPage() {
  const key = useSyncExternalStore(keyStore.subscribe, keyStore.get, () => null);
  const [data, setData] = useState<{ pending: Row[]; live: Row[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [push, setPush] = useState<PushStatus | null>(null);
  const [now, setNow] = useState(0);

  const load = useCallback(async () => {
    if (!key) return;
    try {
      const r = await fetch(`${API_URL}/v1/mod/reports?key=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(20_000) });
      const j = await r.json();
      if (!j.ok) { setErr(j.error ?? "Could not load."); if (r.status === 403) localStorage.removeItem("modKey"); return; }
      setErr(null); setData({ pending: j.pending, live: j.live }); setNow(Date.now());
    } catch { setErr("Could not load. Try again when you have signal."); }
  }, [key]);
  // Deferred to a microtask, the way lib/data.ts does it: the effect body itself sets no state.
  useEffect(() => {
    let live = true;
    void Promise.resolve().then(async () => {
      if (!live) return;
      await load();
      const s = await pushStatus().catch((): PushStatus => "off");
      if (live) setPush(localStorage.getItem("push.island") === "mod" && s === "on" ? "on" : s === "on" ? "off" : s);
    });
    return () => { live = false; };
  }, [load]);

  const act = async (id: string, action: "show" | "hide") => {
    setBusy(id);
    try {
      const r = await fetch(`${API_URL}/v1/mod/reports`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, id, action }) });
      const j = await r.json();
      if (!j.ok) setErr(j.error ?? "That did not work.");
      await load();
    } finally { setBusy(null); }
  };

  if (!key) {
    return (
      <main className="mx-auto w-full max-w-2xl px-5 pb-32 pt-s7">
        <h1 className="h-display">Moderation</h1>
        <p className="mt-s3 text-body text-ink-2">This page needs the moderator link. Open it from the link you were given.</p>
        <Link href="/" className="btn mt-s5">Back to Kilo</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pb-32 pt-s7">
      <h1 className="h-display">Neighbor reports to read</h1>
      <p className="mt-s2 text-body text-ink-2">Show puts a report on the Reports page for six hours. Hide takes it down for good. Nothing here is automatic.</p>

      {err && <Notice title={err} icon="warning" />}

      <div className="mt-s4 flex flex-wrap items-center gap-s3">
        <button className="btn" onClick={() => void load()}><Icon name="check-circle" size={18} /> Refresh</button>
        {push === "on"
          ? <span className="text-small text-ink-2">You get a notification when something is held.</span>
          : push === "off" || push === null
            ? <button className="btn" onClick={() => void enablePush("mod", 4).then(setPush)}><Icon name="bell" size={18} /> Notify me when something is held</button>
            : <span className="text-small text-ink-2">{push === "needs-install" ? "Add Kilo to your Home Screen to get notifications here." : push === "denied" ? "Notifications are off for Kilo in your phone's settings." : "This phone cannot show notifications."}</span>}
      </div>

      <h2 className="now-label mt-s6">Waiting{data ? ` · ${data.pending.length}` : ""}</h2>
      {!data ? <p className="mt-s3 text-body text-ink-2">Loading…</p>
        : data.pending.length === 0 ? <p className="mt-s3 text-body text-ink-2">Nothing waiting.</p>
        : <ul className="list mt-s2">{data.pending.map((r) => <ModRow key={r.id} r={r} now={now} busy={busy === r.id} onAct={act} />)}</ul>}

      <h2 className="now-label mt-s6">Live in the last day{data ? ` · ${data.live.length}` : ""}</h2>
      {data && (data.live.length === 0 ? <p className="mt-s3 text-body text-ink-2">Nothing went live today.</p>
        : <ul className="list mt-s2">{data.live.map((r) => <ModRow key={r.id} r={r} now={now} busy={busy === r.id} onAct={act} />)}</ul>)}

      <p className="mt-s7 text-small text-ink-2">A shown report appears on the Reports page within about two minutes. Hidden reports are gone for good; the neighbor is not told.</p>
    </main>
  );
}

function ModRow({ r, now, busy, onAct }: { r: Row; now: number; busy: boolean; onAct: (id: string, a: "show" | "hide") => void }) {
  return (
    <li className="py-s3">
      <p className="text-small text-ink-2 num">{TYPE[r.type] ?? r.type} · {r.locText || r.district}{r.district && r.locText ? ` · ${r.district}` : ""} · {fmtClock(r.createdAt, now)}</p>
      <p className="mt-0.5 text-body text-ink">{r.text || <span className="text-ink-2">(no text)</span>}</p>
      {r.status === "pending" && r.holdReason && <p className="mt-0.5 text-small text-warn">Held: {WHY[r.holdReason] ?? r.holdReason}.</p>}
      {r.status === "live" && (r.confirms || r.flags) ? <p className="mt-0.5 text-small text-ink-2 num">{r.confirms} still there · {r.flags} flagged</p> : null}
      <div className="mt-s2 flex gap-s2">
        {r.status === "pending" && <button className="btn btn-primary" disabled={busy} onClick={() => onAct(r.id, "show")}><Icon name="check" size={18} /> Show</button>}
        <button className="btn" disabled={busy} onClick={() => onAct(r.id, "hide")}><Icon name="x" size={18} /> Hide</button>
      </div>
    </li>
  );
}
