"use client";
import { useEffect, useRef, useState } from "react";
import ConditionIcon from "./ConditionIcon";
import type { Hourly } from "@/lib/pages";
import { clock, feelsLike } from "@/lib/summary";

const hourHST = (ms: number) => new Date(ms - 10 * 3_600_000).getUTCHours();
// Four six-hour blocks on the clock.
const PERIOD = (h: number) => (h < 6 ? "Overnight" : h < 12 ? "Morning" : h < 18 ? "Afternoon" : "Evening");

type Block = { name: string; from: number; len: number; pop: number };
function periods(h: Hourly, n: number): Block[] {
  const out: Block[] = [];
  for (let i = 0; i < n; i++) {
    const name = PERIOD(hourHST(h.t0 + i * 3_600_000));
    const last = out[out.length - 1];
    if (last && last.name === name) { last.len++; last.pop = Math.max(last.pop, h.p[i]); }
    else out.push({ name, from: i, len: 1, pop: h.p[i] });
  }
  // ponytail: a block shorter than 4 hours at either end can't hold its label; fold it into its neighbour (≤ 3 h of slack).
  const fold = (a: number, b: number) => { out[b].from = Math.min(out[a].from, out[b].from); out[b].len += out[a].len; out[b].pop = Math.max(out[a].pop, out[b].pop); out.splice(a, 1); };
  if (out.length > 1 && out[0].len < 4) fold(0, 1);
  if (out.length > 1 && out[out.length - 1].len < 4) fold(out.length - 1, out.length - 2);
  return out;
}

/** Catmull-Rom → cubic Bézier path through the points. */
function smooth(pts: (readonly [number, number])[]): string {
  let d = pts.length ? `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}` : "";
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

type Metric = "t" | "fl" | "w" | "p" | "rh";
const METRICS: { id: Metric; label: string; unit: string }[] = [
  { id: "t", label: "Temperature", unit: "°" }, { id: "fl", label: "Feels like", unit: "°" },
  { id: "w", label: "Wind", unit: " mph" }, { id: "p", label: "Rain", unit: "%" }, { id: "rh", label: "Humidity", unit: "%" },
];
const series = (h: Hourly, m: Metric, n: number) =>
  (m === "t" ? h.t : m === "fl" ? h.t.map((t, i) => feelsLike(t, h.rh[i])) : m === "w" ? h.w : m === "p" ? h.p : h.rh).slice(0, n);

// The picture is drawn in px on purpose: 1 hour = 32px, like a photo; only the words scale with the reader's text size.
// PAD: room on the left so the first figure is not cut by the screen edge.
const COL = 32, PAD = 32, HEAD = 64, PLOT = 330, AXIS = 28, NOWROW = 24;

/**
 * The next 36 hours as one scrolling strip: period names with the chance of rain, then the curve with a sky icon and
 * a figure every third hour, and clock times under it. HTML for every word and icon, one SVG for lines and dots.
 */
export default function HourlyChart({ h }: { h: Hourly }) {
  const [metric, setMetric] = useState<Metric>("t");
  const n = h.t.length;
  const W = PAD + n * COL, TOTAL = HEAD + PLOT + AXIS + NOWROW;
  const unit = METRICS.find((m) => m.id === metric)!.unit;
  const main = series(h, metric, n);
  // Alternates hug the forecast: anything more than 3° off is clamped so the lines stay out of the icon stack.
  const alts = metric === "t" ? (h.alt ?? []).filter((a) => a.t.length).map((a) => a.t.slice(0, n).map((v, i) => Math.max(main[i] - 3, Math.min(main[i] + 3, v)))) : [];

  const all = [...main, ...alts.flat()];
  const vMin = Math.min(...all), vMax = Math.max(...all), span = Math.max(metric === "t" || metric === "fl" ? 6 : 10, (vMax - vMin) * 1.2);
  // The curve lives in the lower 55% of the plot; the icon + figure stack rides above it.
  const y = (v: number) => HEAD + PLOT - 14 - ((v - vMin) / span) * (PLOT * 0.55);
  const x = (i: number) => PAD + (i + 0.5) * COL;
  const pts = (s: number[]) => s.map((v, i) => [x(i), y(v)] as const);

  const marks = main.map((_, i) => i).filter((i) => i % 3 === 0);
  const blocks = periods(h, n);

  // Centre the active word in the switcher without moving the page (scrollIntoView would scroll vertically too).
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = row.current, btn = el?.querySelector<HTMLButtonElement>("[aria-pressed=true]");
    if (el && btn) el.scrollTo({ left: btn.offsetLeft + btn.offsetWidth / 2 - el.clientWidth / 2, behavior: "smooth" });
  }, [metric]);

  return (
    <div className="mt-s4">
      {/* The strip bleeds to the screen edges and is clipped by them, like a photo wider than the page. */}
      <div className="no-scrollbar -mx-5 overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
        <div className="relative" style={{ width: W, height: TOTAL }}>
          <svg width={W} height={TOTAL} viewBox={`0 0 ${W} ${TOTAL}`} className="absolute inset-0" aria-hidden>
            {blocks.slice(1).map((p) => <line key={p.from} x1={PAD + p.from * COL} y1={0} x2={PAD + p.from * COL} y2={HEAD + PLOT + AXIS} stroke="var(--line)" strokeWidth={1} />)}
            {/* where we are right now */}
            <line x1={x(0)} y1={HEAD} x2={x(0)} y2={HEAD + PLOT} stroke="var(--brand)" strokeWidth={1.5} strokeDasharray="4 4" />
            {/* other models' guesses sit behind the forecast */}
            {alts.map((a, k) => <path key={k} d={smooth(pts(a))} fill="none" stroke="var(--ink)" strokeOpacity={0.28} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />)}
            <path d={smooth(pts(main))} fill="none" stroke="var(--ink)" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
            {marks.map((i) => <circle key={i} cx={x(i)} cy={y(main[i])} r={7} fill="var(--ink)" stroke="var(--bg)" strokeWidth={3} />)}
          </svg>

          {/* Period names with the chance of rain, centred over their hours */}
          {blocks.map((p) => (
            <div key={p.from} className="absolute top-1 flex -translate-x-1/2 flex-col items-center whitespace-nowrap leading-tight" style={{ left: PAD + (p.from + p.len / 2) * COL }}>
              <span className="text-[1.375rem] font-bold text-ink">{p.name}</span>
              <span className="flex items-center gap-1 text-[1.25rem] text-ink-2 num">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/weather/raindrop.svg" alt="" className="size-5" /> {p.pop}%
              </span>
            </div>
          ))}

          {/* Sky icon over the figure over the dot, riding the curve */}
          {marks.map((i) => (
            // The stack leans a little downhill so a steep curve passes beside the figure, not through it; a --bg halo knocks out what still touches.
            <div key={i} className="absolute flex -translate-x-1/2 flex-col items-center gap-1.5 whitespace-nowrap"
              style={{ left: x(i) + Math.max(-10, Math.min(10, (y(main[Math.min(n - 1, i + 1)]) - y(main[Math.max(0, i - 1)])) * 0.4)), bottom: TOTAL - y(main[i]) + 14, filter: "drop-shadow(0 0 3px var(--bg)) drop-shadow(0 0 3px var(--bg))" }}>
              <ConditionIcon code={h.c[i]} night={!!h.n[i]} size={40} />
              <span className="text-[1.375rem] font-bold leading-none text-ink num">{main[i]}{unit}</span>
            </div>
          ))}

          {/* Clock times, and "Now" under the first */}
          {marks.map((i) => (
            <span key={i} className="absolute -translate-x-1/2 whitespace-nowrap text-[1.25rem] leading-none text-ink-2 num" style={{ left: x(i), top: HEAD + PLOT + 4 }}>{clock(h.t0 + i * 3_600_000)}</span>
          ))}
          <span className="absolute -translate-x-1/2 text-[1.25rem] font-semibold leading-none text-brand" style={{ left: x(0), top: HEAD + PLOT + AXIS + 2 }}>Now</span>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-s3 flex flex-wrap items-center justify-center gap-x-s4 gap-y-1 rounded-[1.75rem] bg-surface-2 px-s3 py-3 text-[1rem] font-semibold text-ink">
        <span className="flex items-center gap-2 whitespace-nowrap">
          <svg width="28" height="14" viewBox="0 0 28 14" aria-hidden><line x1="2" y1="7" x2="26" y2="7" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" /><circle cx="14" cy="7" r="5" fill="var(--ink)" stroke="var(--surface-2)" strokeWidth="2" /></svg>
          Forecast
        </span>
        {alts.length > 0 && (
          <span className="flex items-center gap-2">
            <svg className="shrink-0" width="28" height="14" viewBox="0 0 28 14" aria-hidden><line x1="2" y1="7" x2="26" y2="7" stroke="var(--ink)" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" /></svg>
            Alternate predictions
          </span>
        )}
      </div>

      {/* Which figure the curve shows */}
      <div ref={row} className="no-scrollbar -mx-5 mt-s2 flex overflow-x-auto px-5">
        {METRICS.map((m) => (
          <button key={m.id} type="button" aria-pressed={m.id === metric} onClick={() => setMetric(m.id)}
            className={`min-h-11 shrink-0 whitespace-nowrap px-3 text-[1.25rem] text-brand ${m.id === metric ? "font-semibold" : ""}`}>{m.label}</button>
        ))}
      </div>

      <p className="sr-only">{marks.map((i) => `${i === 0 ? "Now" : clock(h.t0 + i * 3_600_000)}: ${main[i]}${unit}.`).join(" ")}</p>
    </div>
  );
}
