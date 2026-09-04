"use client";
import { useEffect, useRef, useState } from "react";
import type { Tide } from "@/lib/pages";
import { clock } from "@/lib/summary";
import { fmtTime } from "@/lib/brand";

/**
 * The next day and a half of tide, drawn in the hourly chart's language: one curve, a dashed line at
 * now, clock times underneath.
 *
 * What a reader is actually after is the turns, not the height at 3pm — "when is it high" is the
 * question — so the highs and lows are the only figures called out. The curve is there to say how
 * fast it is moving and which way, which a table of four times cannot.
 */

/** Catmull-Rom → cubic Bézier, the same smoothing the hourly curve uses. */
function smooth(pts: (readonly [number, number])[]): string {
  let d = pts.length ? `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}` : "";
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

// Same floor density as the hourly strip, so the two read as one family: 1 hour = 14px, wider when
// there is room. RANGE is the curve's own height; what is left under it holds the low labels.
const COL = 14, PAD = 30, HEAD = 36, PLOT = 158, RANGE = 96, AXIS = 24, NOWROW = 20;
// Half of the widest turn label ("High 10.5 ft" over "12:00 AM"), for keeping one off the edge.
const HALFLBL = 46;

const ft = (v: number) => `${v.toFixed(1)} ft`;

/** How many hours the chart draws, matching the hourly weather strip beside it. */
const HOURS = 36;

export default function TideChart({ tide }: { tide: Tide }) {
  // The stored window starts whenever it was last fetched, which can be hours ago. Slice from the
  // real current hour so the dashed line labelled "Now" is now.
  const [nowHour] = useState(() => Math.floor(Date.now() / 3_600_000) * 3_600_000);
  const skip = Math.min(Math.max(0, Math.round((nowHour - tide.t0) / 3_600_000)), Math.max(0, tide.h.length - 2));
  const t0 = tide.t0 + skip * 3_600_000;
  const h = tide.h.slice(skip, skip + HOURS);
  const n = h.length;
  const last = t0 + (n - 1) * 3_600_000;
  const hl = tide.hl.filter((p) => p.t >= t0 && p.t <= last);

  const wrap = useRef<HTMLDivElement>(null);
  const [col, setCol] = useState(COL);
  useEffect(() => {
    const el = wrap.current;
    if (!el || !("ResizeObserver" in window)) return;
    const fit = () => setCol(Math.max(COL, (el.clientWidth - PAD * 2) / n));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [n]);
  const fits = col > COL;

  const W = PAD + n * col, TOTAL = HEAD + PLOT + AXIS + NOWROW;
  const vMin = Math.min(...h), vMax = Math.max(...h);
  // A flat day must not blow up into a full-height wave: the span has a floor of a foot.
  const span = Math.max(1, vMax - vMin);
  const y = (v: number) => HEAD + 10 + RANGE - ((v - vMin) / span) * RANGE;
  // Hours are whole, but a turn lands at 10:18. Placing it by its real time is the difference
  // between a dot on the peak and a dot beside it.
  const xAt = (ms: number) => PAD + ((ms - t0) / 3_600_000 + 0.5) * col;
  const x = (i: number) => PAD + (i + 0.5) * col;

  const pts = h.map((v, i) => [x(i), y(v)] as const);
  const base = HEAD + PLOT;
  const line = smooth(pts);
  const area = `${line} L${x(n - 1).toFixed(1)},${base} L${x(0).toFixed(1)},${base} Z`;
  const marks = h.map((_, i) => i).filter((i) => i % 3 === 0);

  return (
    <>
      <div className={`wx-strip${fits ? " wx-strip--fits" : ""}`}>
        <div ref={wrap} className="no-scrollbar wx-scroll">
          <div className="wx-chart" style={{ width: W, height: TOTAL }}>
            <svg width={W} height={TOTAL} viewBox={`0 0 ${W} ${TOTAL}`} aria-hidden>
              <path d={area} fill="var(--precip)" fillOpacity={0.1} />
              <line x1={PAD} y1={base} x2={W} y2={base} stroke="var(--hairline)" strokeWidth={1} />
              <line x1={x(0)} y1={HEAD} x2={x(0)} y2={base} stroke="var(--brand)" strokeWidth={1.5} strokeDasharray="4 4" />
              <path d={line} fill="none" stroke="var(--precip)" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
              {hl.map((p) => (
                <circle key={p.t} cx={xAt(p.t)} cy={y(p.v)} r={5} fill="var(--precip)" stroke="var(--card)" strokeWidth={2.5} />
              ))}
              <circle cx={x(0)} cy={y(h[0])} r={5} fill="var(--brand)" stroke="var(--card)" strokeWidth={2.5} />
            </svg>

            {/* The turns. A high is labelled above its dot and a low below, which is how the eye
                already reads a wave — and it keeps both labels off the curve. */}
            {hl.map((p) => {
              // A turn near either end would hang half a label off the strip, which is clipped away.
              // Nudge it back inside rather than dropping it: the first high is often the one today.
              const cx = xAt(p.t);
              const nudge = Math.max(0, HALFLBL - cx) - Math.max(0, cx + HALFLBL - W);
              return (
              <div key={p.t} className="td-turn"
                style={{ left: cx, transform: `translateX(calc(-50% + ${nudge.toFixed(1)}px))`,
                  ...(p.hi ? { bottom: TOTAL - y(p.v) + 12 } : { top: y(p.v) + 12 }) }}>
                <b>{p.hi ? "High" : "Low"} {ft(p.v)}</b>
                <span>{fmtTime(p.t)}</span>
              </div>
              );
            })}

            {marks.map((i) => (
              <span key={i} className="wx-clk" style={{ left: x(i), top: base + 4 }}>{clock(t0 + i * 3_600_000)}</span>
            ))}
            <span className="wx-nowlbl" style={{ left: x(0), top: base + AXIS + 2 }}>Now</span>
          </div>
        </div>
      </div>

      <p className="cs-figcap">
        Right now the water is {ft(h[0])} above the average low tide at {tide.name}. NOAA predicts these
        heights; a big swell or a storm surge can push it higher than any of them.
      </p>

      <p className="sr-only">
        {hl.map((p) => `${p.hi ? "High" : "Low"} tide ${ft(p.v)} at ${fmtTime(p.t)}.`).join(" ")}
      </p>
    </>
  );
}
