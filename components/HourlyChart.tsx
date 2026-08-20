"use client";
import { useMemo, useState } from "react";
import { ArrowUp } from "lucide-react";
import ConditionIcon from "./ConditionIcon";
import type { Hourly } from "@/lib/pages";
import { clock } from "@/lib/summary";

/** Dark-Sky-style hourly strip: temperature curve on top, precipitation-probability bars below, night shaded, labels in HTML. */
export default function HourlyChart({ h, hours = 24, sun, title }: { h: Hourly; hours?: number; sun?: { rise: number; set: number }[]; title: string }) {
  const n = Math.min(hours, h.t.length);
  const [sel, setSel] = useState<number | null>(null);
  const W = 360, COL = W / n;
  const rainy = Math.max(...h.p.slice(0, n)) >= 30;
  const H = rainy ? 124 : 78;
  const temps = h.t.slice(0, n);
  const tMin = Math.min(...temps), tMax = Math.max(...temps), span = Math.max(6, tMax - tMin);
  const ty = (t: number) => 22 + (1 - (t - tMin) / span) * 40; // curve band y 22–62: room above for the peak label
  const x = (i: number) => i * COL + COL / 2;

  // Catmull-Rom → cubic Bézier, integer coords.
  const path = useMemo(() => {
    const pts = temps.map((t, i) => [x(i), ty(t)] as const);
    if (pts.length < 2) return "";
    let d = `M${pts[0][0].toFixed(0)},${pts[0][1].toFixed(0)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0].toFixed(0)},${c1[1].toFixed(0)} ${c2[0].toFixed(0)},${c2[1].toFixed(0)} ${p2[0].toFixed(0)},${p2[1].toFixed(0)}`;
    }
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [h, n]);

  // Night bands from the n[] flags; sun ticks from computed sunrise/sunset inside the window.
  const bands: [number, number][] = [];
  for (let i = 0; i < n; i++) if (h.n[i]) { if (bands.length && bands[bands.length - 1][1] === i) bands[bands.length - 1][1] = i + 1; else bands.push([i, i + 1]); }
  const sunX = (ms: number) => ((ms - h.t0) / 3_600_000) * COL;
  const ticks = (sun ?? []).flatMap((s) => [{ at: s.rise, kind: "rise" }, { at: s.set, kind: "set" }]).filter((t) => t.at > h.t0 && t.at < h.t0 + n * 3_600_000);

  const iMax = temps.indexOf(tMax), iMin = temps.indexOf(tMin);
  const labelAt = (i: number) => i === 0 || i === iMax || i === iMin;
  const cols = 8, per = n / cols; // 3-hour tap targets

  return (
    <figure className="mt-s3">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={title}>
        <title>{title}</title>
        {bands.map(([a, b]) => <rect key={a} x={a * COL} y={0} width={(b - a) * COL} height={H} fill="var(--night-band)" />)}
        {ticks.map((t) => <g key={`${t.kind}${t.at}`}><line x1={sunX(t.at)} x2={sunX(t.at)} y1={4} y2={H} stroke="var(--muted)" strokeWidth={1} strokeDasharray="2 3" /><text x={sunX(t.at) + 3} y={H - 4} fontSize={11} fill="var(--muted)">{t.kind === "rise" ? "sunrise" : "sunset"}</text></g>)}
        {rainy && h.p.slice(0, n).map((p, i) => p >= 10 && (
          <rect key={i} className="grow-y" style={{ ["--i" as string]: i, transformBox: "fill-box" }} x={i * COL + 1} y={H - p * 0.4} width={COL - 2} height={p * 0.4} rx={2} fill="var(--precip)" />
        ))}
        {/* baseline for bars */}
        {rainy && <line x1={0} x2={W} y1={H - 0.5} y2={H - 0.5} stroke="var(--line)" strokeWidth={1} />}
        {/* temperature area wash + curve */}
        <path d={`${path} L${x(n - 1).toFixed(0)},72 L${x(0).toFixed(0)},72 Z`} fill="currentColor" fillOpacity={0.05} className="text-ink" />
        <path d={path} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" className="text-ink" />
        {/* now marker */}
        <line x1={x(0)} x2={x(0)} y1={2} y2={H} stroke="var(--brand)" strokeWidth={1.5} strokeDasharray="2 3" />
        <circle cx={x(0)} cy={ty(temps[0])} r={4.5} fill="var(--brand)" stroke="var(--surface)" strokeWidth={2} />
        {/* selective temp labels: now, max, min */}
        {temps.map((t, i) => labelAt(i) && (
          <text key={i} x={i === 0 ? x(i) + 9 : x(i)} y={i === 0 ? ty(t) + 5 : ty(t) - 9} fontSize={13} fontWeight={600} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fill="var(--ink)" stroke="var(--surface)" strokeWidth={3} paintOrder="stroke" className="num">{t}°</text>
        ))}
        {sel !== null && <rect x={sel * per * COL} y={0} width={per * COL} height={H} fill="var(--ink)" fillOpacity={0.06} />}
      </svg>
      {/* time + icon row, 3-hour columns, 44px tap targets */}
      <div className="mt-s2 grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }} role="group" aria-label="Pick an hour for details">
        {Array.from({ length: cols }, (_, c) => {
          const i = Math.round(c * per);
          return (
            <button key={c} onClick={() => setSel(sel === c ? null : c)} aria-pressed={sel === c} className={`flex h-11 flex-col items-center justify-center rounded-chip text-micro num ${sel === c ? "bg-surface-2 text-ink" : "text-muted"}`}>
              <ConditionIcon code={h.c[i]} night={!!h.n[i]} size={18} />
              <span className="mt-0.5">{c === 0 ? "Now" : clock(h.t0 + i * 3_600_000).replace(" ", "")}</span>
            </button>
          );
        })}
      </div>
      <figcaption className="mt-s1 h-5 text-label text-ink-2 num" aria-live="polite">
        {sel !== null && (() => { const i = Math.round(sel * per); return <>{sel === 0 ? "Now" : clock(h.t0 + i * 3_600_000)} · {h.t[i]}° · {h.p[i]}% rain · <ArrowUp className="inline size-3.5 align-text-bottom" style={{ transform: `rotate(${h.wd[i] * 22.5 + 180}deg)` }} /> {h.w[i]} mph</>; })()}
      </figcaption>
    </figure>
  );
}
