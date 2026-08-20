"use client";
import type { Hourly } from "@/lib/pages";
import { clock } from "@/lib/summary";

const hourHST = (ms: number) => new Date(ms - 10 * 3_600_000).getUTCHours();
// Four six-hour blocks on the clock. Soft hyphens let a word break in a narrow column (only at the largest text size) instead of clipping.
const PERIOD = (h: number) => (h < 6 ? "Night" : h < 12 ? "Morn\u00ADing" : h < 18 ? "After\u00ADnoon" : "Eve\u00ADning");

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
 * Next 24 hours: period names with the chance of rain on top, the temperature curve with a label every third hour, clock times underneath.
 * All words are HTML so the phone's text size applies; the SVG only draws the line.
 */
export default function HourlyChart({ h, hours = 24 }: { h: Hourly; hours?: number }) {
  const n = Math.min(hours, h.t.length);
  const W = 360, H = 100, COL = W / n;
  const temps = h.t.slice(0, n);
  const tMin = Math.min(...temps), tMax = Math.max(...temps), span = Math.max(6, tMax - tMin);
  const ty = (t: number) => 36 + (1 - (t - tMin) / span) * 56; // curve band y 36–92; room above for the labels
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
  const times = marks.filter((i) => i % 6 === 0);
  const pos = (i: number) => (i === 0 ? { left: "0.5rem" } : { left: pct(x(i), W), transform: "translateX(-50%)" });
  const blocks = periods(h, n);

  return (
    <div className="picture mt-s4 py-s3">
      <div className="grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {blocks.map((p, k) => (
          <div key={p.from} className={`text-small ${k ? "border-l border-line pl-1.5" : "pl-s2"}`} style={{ gridColumn: `${p.from + 1} / span ${p.len}` }}>
            <span className="block text-ink">{p.name}</span>
            <span className="block text-ink-2 num">{p.pop}% rain</span>
          </div>
        ))}
      </div>
      <div className="relative mt-s2">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" aria-hidden>
          {bands.map(([a, b]) => <rect key={a} x={a * COL} y={0} width={(b - a) * COL} height={H} fill="var(--night-band)" />)}
          <path d={`${path} L${x(n - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`} fill="currentColor" fillOpacity={0.06} className="text-ink" />
          <path d={path} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" className="text-ink" />
          {marks.map((i) => <circle key={i} cx={x(i)} cy={ty(temps[i])} r={i === 0 ? 5 : 3.5} fill={i === 0 ? "var(--brand)" : "currentColor"} stroke="var(--surface)" strokeWidth={2} className="text-ink" />)}
        </svg>
        {marks.filter((i) => i > 0).map((i) => (
          <span key={i} className="absolute text-small font-semibold text-ink num" style={{ left: pct(x(i), W), top: pct(ty(temps[i]) - 7, H), transform: "translate(-50%, -100%)" }}>{temps[i]}°</span>
        ))}
      </div>
      <div className="relative mt-s1 h-[1.4rem]">
        {times.map((i) => <span key={i} className="absolute whitespace-nowrap text-small text-ink-2 num" style={pos(i)}>{i === 0 ? "Now" : clock(h.t0 + i * 3_600_000)}</span>)}
      </div>
    </div>
  );
}
