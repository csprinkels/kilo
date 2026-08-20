"use client";
import ConditionIcon from "./ConditionIcon";
import type { Period } from "@/lib/pages";
import { conditionCode } from "@/lib/summary";

export type DayRow = { name: string; hi?: number; lo?: number; pop: number; code: number; night: boolean; today?: boolean };

/** Pair NWS day/night periods into rows. A leading night period becomes a "Tonight" row with a low only. */
export function rowsFromPeriods(fc: Period[]): DayRow[] {
  const rows: DayRow[] = [];
  for (let i = 0; i < fc.length; i++) {
    const p = fc[i];
    if (p.day) {
      const night = fc[i + 1] && !fc[i + 1].day ? fc[i + 1] : undefined;
      rows.push({ name: p.n, hi: p.t, lo: night?.t, pop: Math.max(p.pop, night?.pop ?? 0), code: conditionCode("", p.s), night: false, today: i === 0 });
      if (night) i++;
    } else {
      rows.push({ name: p.n, lo: p.t, pop: p.pop, code: conditionCode("", p.s), night: true, today: i === 0 });
    }
  }
  return rows;
}

/** Daily rows with hi/lo range bars on ONE shared scale (Dark Sky's trick: a mild day looks short next to a wide one). */
export default function DailyRows({ fc, nowTemp }: { fc: Period[]; nowTemp?: number }) {
  const rows = rowsFromPeriods(fc);
  const all = rows.flatMap((r) => [r.hi, r.lo]).filter((t): t is number => t != null);
  if (!all.length) return null;
  const min = Math.min(...all), max = Math.max(...all), span = Math.max(8, max - min);
  const pct = (t: number) => ((t - min) / span) * 100;
  return (
    <ul className="mt-s3 divide-y divide-line">
      {rows.map((r) => (
        <li key={r.name} className="flex min-h-12 items-center gap-s3 py-s1">
          <span className="w-[76px] shrink-0 text-body font-medium">{r.name.replace(" Night", " night")}</span>
          <ConditionIcon code={r.code} night={r.night} size={20} />
          <span className="w-9 shrink-0 text-right text-body text-ink-2 num">{r.lo != null ? `${r.lo}°` : ""}</span>
          <span className="relative h-2 flex-1 rounded-full bg-surface-2">
            {r.hi != null && r.lo != null && <span className="absolute inset-y-0 rounded-full bg-ink/25" style={{ left: `${pct(r.lo)}%`, width: `${Math.max(4, pct(r.hi) - pct(r.lo))}%` }} />}
            {r.hi == null && r.lo != null && <span className="absolute inset-y-0 w-2 rounded-full bg-ink/25" style={{ left: `${pct(r.lo)}%` }} />}
            {r.today && nowTemp != null && <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand ring-2 ring-surface" style={{ left: `${Math.max(0, Math.min(100, pct(nowTemp)))}%` }} />}
          </span>
          <span className="w-9 shrink-0 text-body font-medium num">{r.hi != null ? `${r.hi}°` : ""}</span>
          <span className="w-10 shrink-0 text-right text-label text-muted num">{r.pop >= 10 ? `${r.pop}%` : ""}</span>
        </li>
      ))}
    </ul>
  );
}
