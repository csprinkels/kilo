"use client";
import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/Icon";
import StormMap from "@/components/StormMap";
import { bearingDeg, categoryOf, distanceNm, ktToMph, nmToMi, outlookFor, stormTimeline, type Storm } from "@/lib/storm";
import { dirWord } from "@/lib/plain";
import { fmtDayTime } from "@/lib/brand";

const round5 = (n: number) => Math.round(n / 5) * 5;
const STEP_MS = 70;   // one hour of storm per tick while playing: five days in about ten seconds

/**
 * The storm's track as something you can scrub: drag from its first advisory, through now, to five
 * days out, and the dot and its gale-wind field move along the line with the time, strength and
 * distance from your island. The cone stays drawn the whole time, and the forecast part is labelled
 * as one, so a smoothly moving dot never reads as more certain than the Hurricane Center is.
 * Everything comes from storms.json, which is already on the phone: it works with no signal.
 */
export default function StormTimeline({ storm, place, compact }: { storm: Storm; place: { lat: number; lon: number; label: string }; compact?: boolean }) {
  const tl = useMemo(() => stormTimeline(storm), [storm]);
  const nowIx = Math.max(0, tl.findIndex((p) => p.kind === "now"));
  const [ix, setIx] = useState(nowIx);
  const [playing, setPlaying] = useState(false);
  const last = tl.length - 1;

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setIx((i) => {
      if (i >= last) { setPlaying(false); return i; }
      return i + 1;
    }), STEP_MS);
    return () => clearInterval(t);
  }, [playing, last]);

  // The moment gale winds could first reach this island, from the same outlook the page's sentence uses.
  const windsFrom = useMemo(() => outlookFor(storm, place).tsWindsFrom, [storm, place]);
  const windsIx = windsFrom ? tl.findIndex((p) => p.at >= windsFrom) : -1;

  const p = tl[Math.min(ix, last)];
  if (!p) return <div className="cs-figure"><StormMap storm={storm} place={place} compact={compact} /></div>;
  const miles = nmToMi(distanceNm(p.lat, p.lon, place.lat, place.lon));
  const dir = dirWord(bearingDeg(place.lat, place.lon, p.lat, p.lon));
  const what = categoryOf(p.windKt).label;
  const phase = p.kind === "past" ? "Where it was" : p.kind === "now" ? "Now" : p.outlook ? "Forecast, less certain" : "Forecast";
  const readout = `${fmtDayTime(p.at)}. ${what}, ${round5(ktToMph(p.windKt))} mph. ${(Math.round(miles / 10) * 10).toLocaleString("en-US")} miles ${dir} of ${place.label}.`;
  const pct = (i: number) => `${(i / Math.max(1, last)) * 100}%`;

  const play = () => {
    if (playing) return setPlaying(false);
    if (ix >= last) setIx(0);   // at the end, play starts over from the first advisory
    setPlaying(true);
  };

  return (
    <div className="stl">
      <div className="cs-figure"><StormMap storm={storm} place={place} compact={compact} cursor={p} /></div>

      <div className="stl-read" aria-live="off">
        <span className={`cs-pill ${p.kind === "past" ? "" : p.kind === "now" ? "cs-pill--ink" : "cs-pill--warn"}`}>{phase}</span>
        <span className="stl-when num">{fmtDayTime(p.at)}</span>
        <span className="stl-what num">{what} · {round5(ktToMph(p.windKt))} mph · {(Math.round(miles / 10) * 10).toLocaleString("en-US")} mi {dir}</span>
      </div>

      <div className="stl-bar">
        <button type="button" className="stl-play" onClick={play} aria-label={playing ? "Pause" : "Play the storm's track"}>
          <Icon name={playing ? "pause-fill" : "play-fill"} size={18} />
        </button>
        <div className="stl-track">
          <input
            type="range" min={0} max={last} step={1} value={ix}
            onChange={(e) => { setPlaying(false); setIx(Number(e.target.value)); }}
            aria-label={`Time along ${storm.name}'s track`} aria-valuetext={readout}
            style={{ ["--stl-now" as string]: pct(nowIx) }}
          />
          <span className="stl-tick stl-tick--now" style={{ left: pct(nowIx) }} aria-hidden>Now</span>
          {windsIx > 0 && <span className="stl-tick stl-tick--winds" style={{ left: pct(windsIx) }} aria-hidden>Winds</span>}
        </div>
        {ix !== nowIx && (
          <button type="button" className="stl-now cs-btn-quiet" onClick={() => { setPlaying(false); setIx(nowIx); }}>Now</button>
        )}
      </div>
      {windsFrom && (
        <p className="cs-figcap">Strong winds could reach {place.label} around {fmtDayTime(windsFrom)}. Drag or press play to watch the track; the shaded cone is where the center will probably go.</p>
      )}
      {!windsFrom && <p className="cs-figcap">Drag or press play to watch the track. The shaded cone is where the center will probably go, about 2 times out of 3.</p>}
    </div>
  );
}
