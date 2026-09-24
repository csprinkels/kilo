"use client";
import { useState } from "react";
import Icon from "@/components/Icon";
import StormMap from "./StormMap";
import OfficialWording from "./OfficialWording";
import type { Island } from "@/lib/types";
import { ISLAND_POINTS, bearingDeg, categoryOf, distanceNm, ktToMph, nmToMi, outlookFor, type Storm } from "@/lib/storm";
import { LEVEL_WORD, dirWord, stormLine, windsLine } from "@/lib/plain";
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
  const outlook = outlookFor(storm, place);
  // +12/24/36/48/72 h, then the two outlook points; the 60 h point adds nothing a reader needs.
  const where = storm.forecast.filter((p) => Math.round(p.hour / 12) !== 5);
  // The storm card is the page's one hero: brick at "act now", warm at "get ready", plain white below.
  const tone = level >= 4 ? " cs-hero cs-hero--danger" : level >= 3 ? " cs-hero cs-hero--warn" : "";
  const tile = level >= 3 ? " cs-ictile--danger" : level >= 2 ? " cs-ictile--warn" : "";

  return (
    <>
      {/* The storm: topic head, the one sentence, the track, the numbers, the agency. */}
      <article className={`cs-card t-storms${tone}`}>
        <div className="cs-tophead">
          <span className={`cs-ictile cs-ictile--lg${tile}`}><Icon name="wind-fill" size={20} /></span>
          <span className="cs-tophead-t">
            <span className="cs-label">{LEVEL_WORD[level] ?? "Storm"}</span>
            <h2 className="cs-display cs-display--card num">{windsLine(storm)}</h2>
          </span>
        </div>
        <p className="cs-body">{line.text}</p>
        {warn && (
          <p className="cs-note">
            <Icon name="warning" size={18} />
            <span className={warn.level >= 4 ? "cs-danger" : undefined}>A {warn.kind} is out for <span className="cs-haw">{place.label}</span>.</span>
          </p>
        )}
        <div className="cs-figure"><StormMap storm={storm} place={place} /></div>
        <p className="cs-figcap">The shaded shape is where the center will probably go, about 2 times out of 3. Wind and rain reach far outside it.</p>
        <div className="cs-grid2">
          <p><Icon name="wind" size={18} /><b>{round5(ktToMph(storm.windKt))} mph</b><span>at storm center</span></p>
          {storm.moveKt != null && storm.moveDirDeg != null && <p><Icon name="navigation-arrow" size={18} /><b>{ktToMph(storm.moveKt)} mph</b><span>moving {dirWord(storm.moveDirDeg)}</span></p>}
          {!outlook.movingAway && <p><Icon name="map-pin" size={18} /><b>{(Math.round(nmToMi(outlook.closest.distNm) / 10) * 10).toLocaleString("en-US")} miles</b><span>closest, {fmtDayTime(outlook.closest.at)}</span></p>}
          <p><Icon name="warning-fill" size={18} /><b>Advisory {storm.advNum}</b><span>{fmtTime(storm.issuedAt)}</span></p>
        </div>
        <div className="cs-foot">
          <span className="cs-foot-note">From the Central Pacific Hurricane Center</span>
          {storm.links.public && <a className="cs-btn-ink" href={storm.links.public} target="_blank" rel="noreferrer">Hurricane Center</a>}
        </div>
      </article>

      <section className="cs-card t-storms">
        <div className="cs-tophead">
          <span className="cs-ictile cs-ictile--lg"><Icon name="check-circle" size={20} /></span>
          <span className="cs-tophead-t">
            <span className="cs-label">Storm</span>
            <h2 className="cs-display cs-display--card">What to do</h2>
          </span>
        </div>
        <p className="cs-body">{todo}</p>
      </section>

      <section className="cs-card t-storms">
        <div className="cs-tophead">
          <span className="cs-ictile cs-ictile--lg"><Icon name="map-pin" size={20} /></span>
          <span className="cs-tophead-t">
            <span className="cs-label">Storm</span>
            <h2 className="cs-display cs-display--card">Where it will be</h2>
          </span>
        </div>
        <ul className="st-tl">
          {where.map((p) => {
            const mi = nmToMi(distanceNm(p.lat, p.lon, place.lat, place.lon));
            const closest = mi === Math.min(...where.map((q) => nmToMi(distanceNm(q.lat, q.lon, place.lat, place.lon))));
            return (
              <li key={p.hour} className="cs-row cs-row--mid">
                <span className="cs-rowmain">
                  <span className="cs-rowname num">{fmtDayTime(p.at)}{p.outlook ? <em> · less certain</em> : ""}</span>
                  <span className="cs-rowsub num">{mi.toLocaleString("en-US")} miles {dirWord(bearingDeg(place.lat, place.lon, p.lat, p.lon))}{closest ? <> · closest to <span className="cs-haw">{place.label}</span></> : ""}</span>
                </span>
                <span className="cs-rowend st-mph num">{round5(ktToMph(p.windKt))} <span>mph</span></span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* The agency's own words, and the other raw source on this page, in one card. */}
      <section className="cs-card t-storms">
        <div className="cs-tophead">
          <span className="cs-ictile cs-ictile--lg"><Icon name="megaphone" size={20} /></span>
          <span className="cs-tophead-t">
            <span className="cs-label">Official wording</span>
            <h2 className="cs-display cs-display--card">{storm.name}</h2>
          </span>
        </div>
        <OfficialWording title={storm.headline ? `${storm.headline}.` : `${cat.label} ${storm.name}`}>
          {storm.warnings.length > 0 && <ul className="st-ql">{storm.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
          <p className="cs-meta st-adv num">Advisory {storm.advNum}, issued {fmtTime(storm.issuedAt)}{storm.nextAdvisoryAt ? `, next ${fmtTime(storm.nextAdvisoryAt)}` : ""}.</p>
          <p className="cs-meta num">{cat.label}. Winds {ktToMph(storm.windKt)} mph, gusts {ktToMph(storm.gustKt)} mph.{storm.pressureMb ? ` Pressure ${storm.pressureMb} mb.` : ""}</p>
          <p className="cs-actions">
            {storm.links.public && <a className="cs-btn-quiet" href={storm.links.public} target="_blank" rel="noreferrer">Official advisory</a>}
            {storm.links.graphics && <a className="cs-btn-quiet" href={storm.links.graphics} target="_blank" rel="noreferrer">Official graphics</a>}
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
        <button onClick={() => setStamp(Math.floor(Date.now() / 600_000))} className="cs-btn-ink cs-wide st-shot-go"><Icon name="camera" size={19} /> See the satellite picture (big download)</button>
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
