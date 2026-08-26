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

/**
 * One row a day: icon · day · rain chance, then low ▬▬ high on a bar that shows where the day sits in the week's range.
 * The numbers are the content; the bar is a picture of them (aria-hidden). Rain shows only when it is worth knowing (≥ 20%).
 */
export default function DailyRows({ fc }: { fc: Period[] }) {
  const rows = rowsFromPeriods(fc);
  if (!rows.length) return null;
  const temps = rows.flatMap((r) => [r.hi, r.lo]).filter((t): t is number => t != null);
  const min = Math.min(...temps), span = Math.max(Math.max(...temps) - min, 1);
  const pct = (t: number) => ((t - min) / span) * 100;
  return (
    <ul className="wx-days">
      {rows.map((r) => {
        const lo = r.lo ?? r.hi!, hi = r.hi ?? r.lo!; // a night-only or day-only row is a single point on the bar
        const words = r.hi != null && r.lo != null ? `High ${r.hi}°, low ${r.lo}°. ` : r.hi != null ? `High ${r.hi}°. ` : `Low ${r.lo}°. `;
        return (
          <li key={r.name} className="wx-day">
            <span className="sr-only">{r.name}: {words}{rainWords(r.pop)}</span>
            <div className="wx-day-top" aria-hidden>
              <ConditionIcon code={r.code} night={r.night} size={32} />
              <span className="wx-day-name">{r.name.replace(" Night", " night")}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {r.pop >= 20 && <span className="wx-pop"><img src="/icons/weather/raindrop.svg" alt="" className="wx-drop" /> {r.pop}%</span>}
            </div>
            <div className="wx-day-bar" aria-hidden>
              <span className="wx-t wx-t--lo">{r.lo != null ? `${r.lo}°` : ""}</span>
              <span className="wx-bar"><i style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }} /></span>
              <span className="wx-t wx-t--hi">{r.hi != null ? `${r.hi}°` : ""}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
