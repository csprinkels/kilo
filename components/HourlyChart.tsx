"use client";
import ConditionIcon from "./ConditionIcon";
import type { Hourly } from "@/lib/pages";
import { clock } from "@/lib/summary";

const hourHST = (ms: number) => new Date(ms - 10 * 3_600_000).getUTCHours();
// Four six-hour blocks on the clock. Soft hyphens let a word break in a narrow column (only at the largest text size) instead of clipping.
const PERIOD = (h: number) => (h < 6 ? "Over­night" : h < 12 ? "Morn­ing" : h < 18 ? "After­noon" : "Eve­ning");

type Period = { name: string; from: number; len: number; pop: number };
function periods(h: Hourly, n: number): Period[] {
  const out: Period[] = [];
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

/**
 * Next 24 hours: period names with the chance of rain on top, then the temperature curve — a sky icon and the
 * temperature every third hour, night shaded, a dashed line at "now" — and clock times underneath.
 * Every word is HTML so the phone's text size applies; the SVG draws only the line and the shading.
 */
export default function HourlyChart({ h, hours = 24 }: { h: Hourly; hours?: number }) {
  const n = Math.min(hours, h.t.length);
  const W = 360, H = 96, COL = W / n;
  const temps = h.t.slice(0, n);
  const tMin = Math.min(...temps), tMax = Math.max(...temps), span = Math.max(6, tMax - tMin);
  const ty = (t: number) => 20 + (1 - (t - tMin) / span) * 64; // curve band y 20–84
  const x = (i: number) => i * COL + COL / 2;
  const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(2)}%`;

  // Catmull-Rom → cubic Bézier.
  const pts = temps.map((t, i) => [x(i), ty(t)] as const);
  let path = pts.length ? `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}` : "";
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    path += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }

  const bands: [number, number][] = [];
  for (let i = 0; i < n; i++) if (h.n[i]) { if (bands.length && bands[bands.length - 1][1] === i) bands[bands.length - 1][1] = i + 1; else bands.push([i, i + 1]); }
  const marks = temps.map((_, i) => i).filter((i) => i % 3 === 0);
  // The first label hangs at the left edge, so the next one can collide with it: keep only labels that clear the last drawn one.
  const labels = marks.filter((i, k) => k === 0 || x(i) - x(marks[k - 1]) > 46 || (k > 1 && x(i) - x(marks[k - 2]) > 46));
  const times = marks.filter((i) => i % 6 === 0);
  const blocks = periods(h, n);
  // Labels near an edge hang inward so the picture never clips them.
  const anchor = (i: number) => (i <= 1 ? { left: "0.25rem" } : i >= n - 2 ? { right: "0.25rem" } : { left: pct(x(i), W), transform: "translateX(-50%)" });

  // @container: the chart's own words size to the picture, and on a narrow phone every other label steps aside.
  return (
    <div className="picture @container mt-s3 pb-s3 pt-s4">
      {/* Period headings with the chance of rain, each over its own stretch of the curve */}
      <div className="grid items-start" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {blocks.map((p, k) => (
          <div key={p.from} className={`row-start-1 self-stretch px-1 text-small font-semibold leading-tight text-ink ${k ? "border-l border-line" : ""}`}
            style={{ gridColumn: `${p.from + 1} / span ${p.len}` }}>{p.name}</div>
        ))}
        {/* A second row, so a name that wraps never shoves its own rain figure out of line with the others. */}
        {blocks.map((p, k) => (
          <div key={`r${p.from}`} className={`row-start-2 flex items-center gap-1 px-1 pt-0.5 text-small text-ink-2 num ${k ? "border-l border-line" : ""}`}
            style={{ gridColumn: `${p.from + 1} / span ${p.len}` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/weather/raindrop.svg" alt="" className="size-4" /> {p.pop}%
          </div>
        ))}
      </div>

      {/* Sky at each labelled hour, above the curve */}
      <div className="relative mt-s3 h-7 @max-[19rem]:[&>span:nth-child(even)]:hidden">
        {marks.map((i) => (
          <span key={i} className="absolute -top-0.5" style={anchor(i)}>
            <ConditionIcon code={h.c[i]} night={!!h.n[i]} size={26} />
          </span>
        ))}
      </div>

      <div className="relative @max-[19rem]:[&>span:nth-child(2n+3)]:hidden">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" aria-hidden>
          {bands.map(([a, b]) => <rect key={a} x={a * COL} y={0} width={(b - a) * COL} height={H} fill="var(--night-band)" />)}
          {blocks.slice(1).map((p) => <line key={p.from} x1={p.from * COL} y1={0} x2={p.from * COL} y2={H} stroke="var(--line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
          <path d={`${path} L${x(n - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`} fill="currentColor" fillOpacity={0.06} className="text-ink" />
          <path d={path} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" className="text-ink" />
          {/* where we are on the curve right now */}
          <line x1={x(0)} y1={0} x2={x(0)} y2={H} stroke="var(--brand)" strokeWidth={1.5} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
          {marks.map((i) => <circle key={i} cx={x(i)} cy={ty(temps[i])} r={i === 0 ? 5 : 3.5} fill={i === 0 ? "var(--brand)" : "currentColor"} stroke="var(--card)" strokeWidth={2} className="text-ink" />)}
        </svg>
        {/* Temperatures ride with the curve; HTML so they follow the reader's text size */}
        {labels.map((i) => (
          <span key={i} className="absolute font-semibold text-ink num [font-size:clamp(12px,3.8cqi,1rem)]" style={{ ...anchor(i), top: pct(ty(temps[i]) - 8, H), transform: `translate(${i <= 1 || i >= n - 2 ? "0" : "-50%"}, -100%)` }}>{temps[i]}°</span>
        ))}
      </div>

      <div className="relative mt-s2 h-[1.4rem]">
        {times.map((i) => (
          <span key={i} className={`absolute whitespace-nowrap num [font-size:clamp(12px,3.8cqi,1rem)] ${i === 0 ? "font-semibold text-brand" : "text-ink-2"}`} style={anchor(i)}>
            {i === 0 ? "Now" : clock(h.t0 + i * 3_600_000)}
          </span>
        ))}
      </div>
      <p className="sr-only">
        {marks.map((i) => `${i === 0 ? "Now" : clock(h.t0 + i * 3_600_000)}: ${temps[i]} degrees.`).join(" ")}
      </p>
    </div>
  );
}
