"use client";
import { useState } from "react";
import Icon from "@/components/Icon";
import StormMap from "./StormMap";
import OfficialWording from "./OfficialWording";
import { Section } from "./PageShell";
import type { Island } from "@/lib/types";
import { ISLAND_POINTS, bearingDeg, categoryOf, distanceNm, ktToMph, nmToMi, type Storm } from "@/lib/storm";
import { dirWord, stormLine } from "@/lib/plain";
import { fmtDayTime, fmtTime } from "@/lib/brand";

const round5 = (n: number) => Math.round(n / 5) * 5;
const ISLAND_RE: Record<Exclude<Island, "state">, RegExp> = {
  hawaii: /Hawai.?i (Island|County)|Big Island/i, maui: /\bMaui|Moloka.?i|L[aā]na.?i|Kaho.?olawe/i, oahu: /O.?ahu/i, kauai: /Kaua.?i|Ni.?ihau/i,
};

/** Does an official watch/warning name this island? Returns the plain kind and its level. */
function islandWarning(storm: Storm, island: Exclude<Island, "state">) {
  const mine = storm.warnings.filter((w) => ISLAND_RE[island].test(w));
  const KINDS: [RegExp, string, number][] = [[/hurricane warning/i, "hurricane warning", 4], [/hurricane watch/i, "hurricane watch", 3], [/tropical storm warning/i, "tropical storm warning", 3], [/tropical storm watch/i, "tropical storm watch", 2]];
  const hit = KINDS.find(([re]) => mine.some((w) => re.test(w)));
  return hit ? { kind: hit[1], level: hit[2] } : undefined;
}

const WHAT_TO_DO: Record<number, string> = {
  0: "Nothing to do. ʻio will say if that changes.",
  1: "Too early to act. Check back tomorrow morning. Make sure you have a week of water and medicine anyway.",
  3: "Get ready now. Fill the car, charge phones, get cash, water and medicine for a week. Know where you would go.",
  4: "Finish getting ready today. Bring in anything loose. Once the wind starts, stay inside. If Civil Defense says leave, leave.",
};

export default function StormTracker({ storm, island }: { storm: Storm; island: Exclude<Island, "state"> }) {
  const place = ISLAND_POINTS[island];
  const line = stormLine(storm, place);
  const warn = islandWarning(storm, island);
  const level = Math.max(line.level, warn?.level ?? 0);
  const todo = WHAT_TO_DO[level >= 4 ? 4 : level >= 2 ? 3 : level];
  const cat = categoryOf(storm.windKt, storm.cls);
  // +12/24/36/48/72 h, then the two outlook points; the 60 h point adds nothing a reader needs.
  const where = storm.forecast.filter((p) => Math.round(p.hour / 12) !== 5);

  return (
    <>
      <p className="mt-s4 max-w-[36rem] text-body text-ink">{line.text}</p>
      {warn && <p className={`mt-s2 max-w-[36rem] text-body font-semibold ${warn.level >= 4 ? "text-danger" : "text-warn"}`}>A {warn.kind} is out for {place.label}.</p>}

      <div className="picture mt-s4"><StormMap storm={storm} place={place} /></div>
      <p className="mt-s3 max-w-[36rem] text-small text-ink-2">The shaded shape is where the center will probably go, about 2 times out of 3. Wind and rain reach far outside it.</p>

      <Section title="What to do" sentence={todo} />

      <Section title="Where it will be">
        <ul className="list mt-s3">
          {where.map((p) => {
            const mi = nmToMi(distanceNm(p.lat, p.lon, place.lat, place.lon));
            const closest = mi === Math.min(...where.map((q) => nmToMi(distanceNm(q.lat, q.lon, place.lat, place.lon))));
            return (
              <li key={p.hour} className="flex items-center gap-s3 py-s3 num">
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-semibold text-ink">{fmtDayTime(p.at)}{p.outlook ? <span className="font-normal text-ink-2"> · less certain</span> : ""}</span>
                  <span className="block text-small text-ink-2">{mi.toLocaleString("en-US")} miles {dirWord(bearingDeg(place.lat, place.lon, p.lat, p.lon))}{closest ? <span className="font-semibold text-brand"> · closest to {place.label}</span> : ""}</span>
                </span>
                <span className="shrink-0 text-right text-body text-ink">{round5(ktToMph(p.windKt))} <span className="text-small text-ink-2">mph</span></span>
              </li>
            );
          })}
        </ul>
      </Section>

      <Imagery id={storm.id} />

      <OfficialWording title={storm.headline ? `${storm.headline}.` : `${cat.label} ${storm.name}`}>
        {storm.warnings.length > 0 && <ul className="mt-s2 list-disc pl-s4">{storm.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
        <p className="mt-s2 num">Advisory {storm.advNum}, issued {fmtTime(storm.issuedAt)}{storm.nextAdvisoryAt ? `, next ${fmtTime(storm.nextAdvisoryAt)}` : ""}.</p>
        <p className="num">{cat.label}. Winds {ktToMph(storm.windKt)} mph, gusts {ktToMph(storm.gustKt)} mph.{storm.pressureMb ? ` Pressure ${storm.pressureMb} mb.` : ""}</p>
        <p className="mt-s2 flex flex-wrap gap-x-s4">
          {storm.links.public && <a className="inline-flex min-h-11 items-center font-semibold text-brand" href={storm.links.public} target="_blank" rel="noreferrer">Official advisory</a>}
          {storm.links.graphics && <a className="inline-flex min-h-11 items-center font-semibold text-brand" href={storm.links.graphics} target="_blank" rel="noreferrer">Official graphics</a>}
        </p>
      </OfficialWording>
    </>
  );
}

/** Satellite pictures are ~200–300 KB each: only loaded on tap, never part of the offline payload. */
function Imagery({ id }: { id: string }) {
  const [stamp, setStamp] = useState<number | null>(null); // cache-buster chosen on tap, so render stays pure
  const floater = `https://cdn.star.nesdis.noaa.gov/FLOATER/data/${id.toUpperCase()}/GEOCOLOR/1000x1000.jpg`;
  const sector = "https://cdn.star.nesdis.noaa.gov/GOES18/ABI/SECTOR/hi/GEOCOLOR/1200x1200.jpg";
  if (stamp === null) {
    return <button onClick={() => setStamp(Math.floor(Date.now() / 600_000))} className="btn btn-big mt-s5"><Icon name="camera" className="size-5" aria-hidden /> See the satellite picture (big download)</button>;
  }
  return (
    <div className="mt-s5 grid gap-s4 sm:grid-cols-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <figure><div className="picture"><img src={`${floater}?t=${stamp}`} alt="Satellite picture centerd on the storm" className="block w-full" loading="lazy" /></div><figcaption className="mt-s2 text-small text-ink-2">Close-up of the storm. From NOAA.</figcaption></figure>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <figure><div className="picture"><img src={`${sector}?t=${stamp}`} alt="Satellite picture of the Hawaiian Islands" className="block w-full" loading="lazy" /></div><figcaption className="mt-s2 text-small text-ink-2">The Hawaiian Islands. From NOAA.</figcaption></figure>
    </div>
  );
}
