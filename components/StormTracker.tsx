"use client";
import { useState } from "react";
import Icon from "@/components/Icon";
import StormMap from "./StormMap";
import OfficialWording from "./OfficialWording";
import type { Island } from "@/lib/types";
import { ISLAND_POINTS, bearingDeg, categoryOf, distanceNm, ktToMph, nmToMi, type Storm } from "@/lib/storm";
import { dirWord, stormLine, windsLine } from "@/lib/plain";
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
  0: "Nothing to do. Kilo will say if that changes.",
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
  // The hero carries the level: brick edge + wash at "act now", amber edge at "get ready", plain glass below.
  const tone = level >= 4 ? " st-hero--danger" : level >= 3 ? " cs-hero--amber" : "";
  const tile = level >= 4 ? " cs-ictile--brick" : level >= 3 ? " cs-ictile--amber" : "";

  return (
    <>
      {/* Summary: winds now, then the one sentence. */}
      <article className={`cs-card cs-hero${tone}`}>
        <div className="cs-heroline">
          <span className={`cs-ictile${tile}`}><Icon name="wind-fill" size={21} className="cs-ic" /></span>
          <div className="st-herotext">
            <p className="cs-title num">{windsLine(storm)}</p>
            <p className="cs-body cs-body--hero">{line.text}</p>
          </div>
        </div>
      </article>

      {warn && (
        <p className={`st-strip${warn.level >= 4 ? " st-strip--danger" : ""}`}>
          <Icon name="warning" size={19} className="st-strip-ic" />
          <span>A {warn.kind} is out for <span className="cs-haw">{place.label}</span>.</span>
        </p>
      )}

      <section className="cs-card st-flush">
        <div className="cs-figure st-pic"><StormMap storm={storm} place={place} /></div>
        <div className="cs-rule" />
        <p className="cs-meta">The shaded shape is where the center will probably go, about 2 times out of 3. Wind and rain reach far outside it.</p>
      </section>

      <section className="cs-card">
        <p className="cs-label"><Icon name="check-circle" size={15} className="cs-ic" /> What to do</p>
        <p className="cs-body st-do">{todo}</p>
      </section>

      <section className="cs-card">
        <p className="cs-label"><Icon name="map-pin" size={15} className="cs-ic" /> Where it will be</p>
        <ul className="st-tl">
          {where.map((p) => {
            const mi = nmToMi(distanceNm(p.lat, p.lon, place.lat, place.lon));
            const closest = mi === Math.min(...where.map((q) => nmToMi(distanceNm(q.lat, q.lon, place.lat, place.lon))));
            return (
              <li key={p.hour} className={`cs-row cs-row--mid${closest ? " st-tl-peak" : ""}`}>
                <span className="cs-rowmain">
                  <span className="cs-rowname num">{fmtDayTime(p.at)}{p.outlook ? <em> · less certain</em> : ""}</span>
                  <span className="cs-rowsub num">{mi.toLocaleString("en-US")} miles {dirWord(bearingDeg(place.lat, place.lon, p.lat, p.lon))}{closest ? <> · closest to <span className="cs-haw">{place.label}</span></> : ""}</span>
                </span>
                <span className="st-mph num">{round5(ktToMph(p.windKt))} <span>mph</span></span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* The agency's own words, and the other raw source on this page, in one card. */}
      <section className="cs-card st-flush">
        <OfficialWording title={storm.headline ? `${storm.headline}.` : `${cat.label} ${storm.name}`}>
          {storm.warnings.length > 0 && <ul className="st-ql">{storm.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
          <p className="cs-meta st-adv num">Advisory {storm.advNum}, issued {fmtTime(storm.issuedAt)}{storm.nextAdvisoryAt ? `, next ${fmtTime(storm.nextAdvisoryAt)}` : ""}.</p>
          <p className="cs-meta num">{cat.label}. Winds {ktToMph(storm.windKt)} mph, gusts {ktToMph(storm.gustKt)} mph.{storm.pressureMb ? ` Pressure ${storm.pressureMb} mb.` : ""}</p>
          <p className="cs-actions">
            {storm.links.public && <a className="cs-link inline-flex min-h-11 items-center" href={storm.links.public} target="_blank" rel="noreferrer">Official advisory</a>}
            {storm.links.graphics && <a className="cs-link inline-flex min-h-11 items-center" href={storm.links.graphics} target="_blank" rel="noreferrer">Official graphics</a>}
          </p>
        </OfficialWording>
        <Imagery id={storm.id} />
      </section>
    </>
  );
}

/** Satellite pictures are ~200–300 KB each: only loaded on tap, never part of the offline payload. */
function Imagery({ id }: { id: string }) {
  const [stamp, setStamp] = useState<number | null>(null); // cache-buster chosen on tap, so render stays pure
  const floater = `https://cdn.star.nesdis.noaa.gov/FLOATER/data/${id.toUpperCase()}/GEOCOLOR/1000x1000.jpg`;
  const sector = "https://cdn.star.nesdis.noaa.gov/GOES18/ABI/SECTOR/hi/GEOCOLOR/1200x1200.jpg";
  if (stamp === null) {
    return (
      <>
        <div className="cs-rule" />
        <button onClick={() => setStamp(Math.floor(Date.now() / 600_000))} className="cs-ghost cs-wide gap-2"><Icon name="camera" size={19} className="cs-ic" /> See the satellite picture (big download)</button>
      </>
    );
  }
  return (
    <div className="st-shots">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <figure><div className="cs-figure st-shot"><img src={`${floater}?t=${stamp}`} alt="Satellite picture centerd on the storm" className="block w-full" loading="lazy" /></div><figcaption className="cs-figcap">Close-up of the storm. From NOAA.</figcaption></figure>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <figure><div className="cs-figure st-shot"><img src={`${sector}?t=${stamp}`} alt="Satellite picture of the Hawaiian Islands" className="block w-full" loading="lazy" /></div><figcaption className="cs-figcap">The Hawaiian Islands. From NOAA.</figcaption></figure>
    </div>
  );
}
