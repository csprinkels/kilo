"use client";
import { useEffect, useState } from "react";
import Icon, { type IconName } from "@/components/Icon";
import { hasVoted, voteReport } from "@/lib/report";
import type { Item, ItemType } from "@/lib/types";
import { hashOf, smsText } from "@/lib/types";
import { shareText } from "@/lib/native";
import { LEVEL_WORD, lastUpdated, plainAlert, staleLine } from "@/lib/plain";
import { fmtClock } from "@/lib/brand";
import { track } from "@/lib/stat";
import { hidePoster } from "@/lib/hidden";

export const ICON: Record<ItemType, IconName> = {
  shelter: "tent", road_closure: "traffic-cone", school: "student", advisory: "drop", storm: "wind", tsunami: "waves",
  quake: "pulse", volcano: "mountains", notice: "megaphone", evac: "siren", hazard: "warning", outage: "lightning-slash", traffic: "car",
};
export const LEVEL_TEXT: Record<number, string> = { 4: "text-danger", 3: "text-warn", 2: "text-ink", 1: "text-ink-2", 0: "text-ink-2" };

/** Map + official link + share, shared by both row kinds. Share is one text message's worth; no link to load. */
function Actions({ item }: { item: Item }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    if ((await shareText(smsText(item))) === "copied") setCopied(true);
  };
  return (
    <p className="mt-s2 flex flex-wrap gap-x-s4">
      {item.lat && item.lon && <a className="cs-btn-quiet" href={`https://maps.apple.com/?ll=${item.lat},${item.lon}&q=${encodeURIComponent(item.title)}`} target="_blank" rel="noreferrer"><Icon name="map-pin" size={16} aria-hidden /> Open in Maps</a>}
      {item.srcUrl && item.tier !== "community" && <a className="cs-btn-quiet" href={item.srcUrl} target="_blank" rel="noreferrer"><Icon name="arrow-square-out" size={16} aria-hidden /> Read it on their site</a>}
      <button className="cs-btn-quiet" onClick={share}><Icon name="share-network" size={16} aria-hidden /> {copied ? "Copied." : "Share"}</button>
    </p>
  );
}

/**
 * One official item: [level word] · plain headline · what to do · who said it. Tap the whole row for the details.
 * The row is the feed entry's shape on a hairline: a tile, the text stack, a caret.
 */
export default function ItemRow({ item, now, focus, showSource = true }: { item: Item; now: number; focus?: boolean; showSource?: boolean }) {
  if (item.tier === "community") return <NeighborRow item={item} now={now} focus={focus} />;
  return <OfficialRow item={item} now={now} focus={focus} showSource={showSource} />;
}

/** `showSource` is false when every row in the list comes from the same agency (the page says it once instead). */
function OfficialRow({ item, now, focus, showSource }: { item: Item; now: number; focus?: boolean; showSource?: boolean }) {
  const [open, setOpen] = useState(!!focus);
  const p = plainAlert(item, now);
  const stale = staleLine(item, now);
  const glyph = item.type === "outage" && item.fields?.kind ? "drop" : ICON[item.type] ?? "megaphone"; // water notices read as a drop, power stays lightning-slash
  useEffect(() => { if (focus) document.getElementById(`item-${hashOf(item.key)}`)?.scrollIntoView({ block: "center" }); }, [focus, item.key]);
  return (
    <li id={`item-${hashOf(item.key)}`} className={focus ? "bg-surface-2" : ""}>
      <button className="row items-start" onClick={() => { if (!open) track(item.tier === "community" ? "open:neighbor" : `open:${item.type}`); setOpen((o) => !o); }} aria-expanded={open}>
        {/* severity on the tile: solid brick at "act now", soft amber at "get ready", the topic's tint below that */}
        <span className={`cs-ictile mt-0.5 ${p.level >= 4 ? "cs-ictile--danger" : p.level >= 3 ? "cs-ictile--warn" : ""}`}><Icon name={`${glyph}-fill`} size={18} /></span>
        <span className="cs-entry-main">
          {(p.word || p.level >= 2) && <span className={`cs-entry-word ${LEVEL_TEXT[p.level]}`}>{p.word ?? LEVEL_WORD[p.level]}</span>}
          <span className="cs-entry-h">{p.headline}</span>
          {p.action && <span className="cs-entry-sub">{p.action}</span>}
          <span className="cs-entry-meta num">{showSource ? `${p.source[0].toUpperCase() + p.source.slice(1)} · ` : ""}{fmtClock(lastUpdated(item, now).at, now)}</span>
          {stale && <span className="cs-source num"><b>{stale}</b></span>}
        </span>
        <Icon name="caret-down" size={20} className={`cs-entry-go ${open ? "cs-entry-go--open" : ""}`} aria-hidden />
      </button>
      {open && (
        <div className="fade-up mb-s4 pl-[46px]">
          {item.body && <p className="text-[15px] leading-normal text-ink-2">{item.body}</p>}
          {item.expiresAt && <p className="mt-s2 text-[13px] text-ink-2 num">Until {fmtClock(item.expiresAt, now)}.</p>}
          <Actions item={item} />
        </div>
      )}
    </li>
  );
}

/** A neighbor's post: its own quiet ground and a tile that says who it is from, the words "Neighbor report" every time, never a level word, a colour or an edge. */
export function NeighborRow({ item, now, focus }: { item: Item; now: number; focus?: boolean }) {
  const [open, setOpen] = useState(!!focus);
  const rid = item.fields?.rid;
  const by = item.fields?.by;   // the "same poster" label; older snapshots carry none, so the control hides itself
  const [voted, setVoted] = useState<boolean | null>(null);
  const [confirms, setConfirms] = useState(Number(item.fields?.confirms ?? 0));
  const [msg, setMsg] = useState<string | null>(null);
  const votedNow = voted ?? (open && rid ? hasVoted(rid) : false);
  const cast = async (v: "still" | "gone" | "flag") => {
    if (!rid) return;
    // voteReport leaves fetch() and res.json() unguarded, so a dropped signal or a 30s timeout throws here.
    // Without this catch the tap was a silent no-op — on the one control the App Store requires.
    try {
      const out = await voteReport(rid, v);
      if (out.ok) { setVoted(true); if (v === "still") setConfirms((c) => c + 1); setMsg(v === "still" ? "Thanks. Marked as still there." : v === "gone" ? "Thanks. Marked as gone." : "Thanks. A person will look at it."); }
      else setMsg(out.error ?? "Could not send that right now.");
    } catch { setMsg("Could not send that right now. Check your signal and try again."); }
  };
  useEffect(() => { if (focus) document.getElementById(`item-${hashOf(item.key)}`)?.scrollIntoView({ block: "center" }); }, [focus, item.key]);
  const p = plainAlert(item, now);
  return (
    <li id={`item-${hashOf(item.key)}`} className="cs-neighbor">
      <button className="row items-start" onClick={() => { if (!open) track(item.tier === "community" ? "open:neighbor" : `open:${item.type}`); setOpen((o) => !o); }} aria-expanded={open}>
        <span className="cs-ictile mt-0.5"><Icon name="users-three-fill" size={18} /></span>
        <span className="cs-entry-main">
          <span className="cs-entry-word text-ink-2">Neighbor report · not checked</span>
          <span className="cs-entry-h">{p.headline}</span>
          <span className="cs-entry-meta num">{confirms + 1} {confirms ? "neighbors say it is still there" : "neighbor reported it"} · {fmtClock(item.lastConfirmedAt, now)}</span>
        </span>
        <Icon name="caret-down" size={20} className={`cs-entry-go ${open ? "cs-entry-go--open" : ""}`} aria-hidden />
      </button>
      {open && (
        <div className="fade-up pb-s4 pl-[46px]">
          {item.body && <p className="text-[15px] leading-normal text-ink-2">{item.body}</p>}
          <p className="mt-s2 text-[13px] text-ink-2">Not checked by anyone official. Call 911 in an emergency.</p>
          {votedNow ? <p className="mt-s3 text-[15px] text-ink-2">{msg ?? "You already weighed in on this one."}</p> : (
            <div className="mt-s3 flex flex-wrap items-center gap-s2">
              <button className="btn" onClick={() => cast("still")}>Still there</button>
              <button className="btn" onClick={() => cast("gone")}>Gone</button>
            </div>
          )}
          {/* Outside the ternary: reporting a post must stay reachable after "Still there" or "Gone". */}
          <p className="mt-s2">
            <button className="cs-btn-quiet" onClick={() => cast("flag")}>Flag this post</button>
          </p>
          {/* Outside the ternary: cast() only flips `voted` on success, so a failed flag, a rate limit or a
              dropped signal rendered nothing at all before this. */}
          {!votedNow && msg && <p className="mt-s3 text-[15px] text-ink-2" role="alert">{msg}</p>}
          {by && (
            <p className="mt-s2">
              <button className="cs-btn-quiet" onClick={() => hidePoster(by)}>
                Hide posts from this neighbor
              </button>
            </p>
          )}
          <Actions item={item} />
        </div>
      )}
    </li>
  );
}
