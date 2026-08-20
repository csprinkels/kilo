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

export const rainWords = (pop: number) => (pop < 5 ? "No rain." : `${pop}% rain.`);

/** One row a day: the day, an icon, and one line in words ("High 84°, low 73°. 40% rain."). */
export default function DailyRows({ fc }: { fc: Period[] }) {
  const rows = rowsFromPeriods(fc);
  if (!rows.length) return null;
  return (
    <ul className="mt-s3 divide-y divide-line">
      {rows.map((r) => (
        <li key={r.name} className="flex min-h-14 items-center gap-s3 py-s3">
          <ConditionIcon code={r.code} night={r.night} size={32} />
          <span className="min-w-0 flex-1">
            <span className="block text-body font-semibold text-ink">{r.name.replace(" Night", " night")}</span>
            <span className="block text-body leading-snug text-ink-2 num">
              {r.hi != null && r.lo != null ? `High ${r.hi}°, low ${r.lo}°. ` : r.hi != null ? `High ${r.hi}°. ` : r.lo != null ? `Low ${r.lo}°. ` : ""}{rainWords(r.pop)}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
