"use client";
import { useEffect, useMemo, useState } from "react";

/**
 * The background is the status display: sky, sun, sea and rain carry the state,
 * the cards only annotate it. No WebGL, no canvas, no images — one SVG whose
 * colours are interpolated from the hour, so 6:47 PM is a real position between
 * keyframes rather than the nearest pre-baked frame.
 */

/** Stylised silhouettes, not survey coastlines. Each path is normalised to a
 *  0 0 100 100 box; spanMi is the real east-west extent, so one scale bar sizes
 *  all eight correctly against each other. */
const ISLANDS = [
  { slug: "hawaii", name: "Hawaiʻi", spanMi: 81.4, peakAt: [45, 42], peak: "Maunakea (13,803 ft)", town: "Hilo",
    path: "M17.6 0L28.7 1.5L38.5 10.3L49 16.2L63.6 24.3L74.8 39.7L93.6 55.1L80.3 67.6L66.4 75L49 86L32.9 100L17.6 79.4L16.2 60.3L6.4 39.7L16.2 30.9L22.4 16.9L19 5.1Z" },
  { slug: "maui", name: "Maui", spanMi: 45.2, peakAt: [72, 55], peak: "Haleakalā (10,023 ft)", town: "Wailuku",
    path: "M16.7 16.9L22.2 21.2L26.4 29.9L31.9 35.8L45.8 31.4L62.5 31.4L76.4 40.2L100 56.2L93.1 72.2L76.4 76.6L48.6 82.4L38.9 79.5L34.7 62L26.4 51.8L23.6 53.3L11.1 48.9L2.8 40.2L0 28.5L8.3 19.8Z" },
  { slug: "oahu", name: "Oʻahu", spanMi: 40.5, peakAt: [22, 45], peak: "Kaʻala (4,025 ft)", town: "Honolulu",
    path: "M0 34L15.9 32.3L27 29.7L34.9 23L42.5 15.5L50.8 12.9L57.1 21.3L68.3 38.2L85.7 53.4L90.5 65.2L100 78.7L93.7 85.5L74.6 88.9L65.1 80.4L54 77.1L50.8 68.5L44.4 77.1L41.3 78.7L25.4 80.4L19 66.9L14.3 56.8L6.3 41.6Z" },
  { slug: "kauai", name: "Kauaʻi", spanMi: 30.1, peakAt: [50, 50], peak: "Kawaikini (5,243 ft)", town: "Līhuʻe",
    path: "M78 12.5L58 16.8L42 14.7L28 23.2L6 44.6L0 57.5L14 68.2L26 72.5L40 83.2L70 89.6L78 85.3L90 72.5L98 46.8L96 31.8L86 21.1Z" },
  { slug: "molokai", name: "Molokaʻi", spanMi: 39.3, peakAt: [80, 50], peak: "Kamakou (4,961 ft)", town: "Kaunakakai",
    path: "M0 45.7L2.4 37.5L15.2 38.9L47.2 38.1L53.6 35.5L59.2 38.9L68 41.5L79.2 43.2L95.2 43.2L100 46.6L95.2 50.9L84 62.5L72.8 64.5L48.8 58.5L28 57.7L12 57.7L1.6 56.3Z" },
  { slug: "lanai", name: "Lānaʻi", spanMi: 17.4, peakAt: [55, 50], peak: "Lānaʻihale (3,366 ft)", town: "Lānaʻi City",
    path: "M26.9 6.9L42.3 8.9L61.5 11L92.3 35.6L100 56.2L80.8 76.7L61.5 84.9L42.3 93.2L23.1 84.9L0 60.3L7.7 31.5L11.5 15.1Z" },
  { slug: "niihau", name: "Niʻihau", spanMi: 12.2, peakAt: [45, 55], peak: "Pānīʻau (1,250 ft)", town: "Puʻuwai",
    path: "M38.9 0L50 4L57.5 12L76.2 36L79.9 52L68.6 68L53.7 88L46.3 100L35.1 80L27.6 52L20.2 32L23.9 12Z" },
  { slug: "kahoolawe", name: "Kahoʻolawe", spanMi: 11.6, peakAt: [55, 42], peak: "Puʻu Moaʻulanui (1,483 ft)", town: "uninhabited",
    path: "M0 50L11.8 31.4L23.5 25.2L35.3 21.5L58.8 19.1L82.4 25.2L100 38L89 49L96 62L64.7 74.8L41.2 81L17.6 68.6Z" },
] as const;

type Frame = { sky: string[]; sun: string; sea: string[]; land: string; rim: string; haze: string; hazeA: number };

const NIGHT: Frame = { sky: ["#0a1420", "#12283a", "#1c3b52"], sun: "#c8d8f0", sea: ["#122430", "#0d1a24", "#091319"], land: "#16211c", rim: "#2e4348", haze: "#0a1622", hazeA: 0.3 };
const DAY: Frame   = { sky: ["#4f96bf", "#8ec8db", "#cfe9ee"], sun: "#fff8e8", sea: ["#3a8a8a", "#4a9eaa", "#88d4d0"], land: "#6a9a5e", rim: "#d4e8e0", haze: "#dff0f2", hazeA: 0.09 };
const DAWN: Frame  = { sky: ["#3a4a72", "#c98a78", "#f2c79a"], sun: "#ffb87a", sea: ["#4a6a7c", "#3c5768", "#2e4454"], land: "#3e4a3e", rim: "#9fb2a8", haze: "#e8b48a", hazeA: 0.14 };
const DUSK: Frame  = { sky: ["#2e3a68", "#7e5f83", "#e08e68"], sun: "#ff9a6a", sea: ["#3a5a68", "#2e4a58", "#243c48"], land: "#39433a", rim: "#8a9a94", haze: "#e0946a", hazeA: 0.15 };

const KEY = [
  { h: 0, f: NIGHT }, { h: 5, f: NIGHT }, { h: 6.3, f: DAWN }, { h: 8.2, f: DAY },
  { h: 16.8, f: DAY }, { h: 18.6, f: DUSK }, { h: 20, f: NIGHT }, { h: 24, f: NIGHT },
];

const SUNRISE = 6.0;
const SUNSET = 18.77;

const toRGB = (h: string) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toHex = (c: number[]) => "#" + (((1 << 24) + (c[0] << 16) + (c[1] << 8) + c[2]) | 0).toString(16).slice(1);

/** Clamp first: toHex bit-packs, so an out-of-range channel borrows the next byte. */
function mix(a: string, b: string, t: number) {
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  const A = toRGB(a), B = toRGB(b);
  return toHex([0, 1, 2].map((i) => Math.round(A[i] + (B[i] - A[i]) * u)));
}

function lum(h: string) {
  const c = toRGB(h).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** The header never sits on the bare sky — each state brings its own scrim. The
 *  day state washes cream and prints ink; the night state washes dark and prints
 *  cream. 0.373 is the day wash's alpha at the text centre line. Take the day
 *  state only while ink still clears 4.5:1 on it; the night state is safe by
 *  construction. Don't "fix" this by always picking the higher-contrast state —
 *  cream-on-dark wins at every hour, which collapses the inversion entirely. */
const INK_AA = 0.3842;
const dayReads = (sky0: string) => lum(mix(sky0, "#fffaf2", 0.373)) >= INK_AA;

function frameAt(h: number): Frame {
  let i = 0;
  while (i < KEY.length - 2 && h > KEY[i + 1].h) i++;
  const a = KEY[i], b = KEY[i + 1];
  let t = b.h === a.h ? 0 : (h - a.h) / (b.h - a.h);
  t = Math.max(0, Math.min(1, t));
  t = t * t * (3 - 2 * t); // smoothstep — no easing lib
  const m3 = (x: readonly string[], y: readonly string[]) => [mix(x[0], y[0], t), mix(x[1], y[1], t), mix(x[2], y[2], t)];
  return {
    sky: m3(a.f.sky, b.f.sky), sun: mix(a.f.sun, b.f.sun, t), sea: m3(a.f.sea, b.f.sea),
    land: mix(a.f.land, b.f.land, t), rim: mix(a.f.rim, b.f.rim, t),
    haze: mix(a.f.haze, b.f.haze, t), hazeA: a.f.hazeA + (b.f.hazeA - a.f.hazeA) * t,
  };
}

function clock(h: number) {
  const m = ((Math.round(h * 60) % 1440) + 1440) % 1440;
  const hh = Math.floor(m / 60), mm = m % 60;
  const d = hh % 12 === 0 ? 12 : hh % 12;
  return `${d}:${mm < 10 ? "0" : ""}${mm} ${hh < 12 ? "AM" : "PM"}`;
}

/** Deterministic — Math.random() here would differ between server and client
 *  render and trip a hydration mismatch. Tiled along the fall vector so the CSS
 *  keyframe loops seamlessly; nothing recomputes per frame. */
const RAIN = (() => {
  let s = 20260825;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const bx = rnd() * 442, by = rnd() * 120;
    for (let k = -1; k < 6; k++) out.push({ x: (((bx - 36 * k) % 442) + 442) % 442 - 40, y: by + 120 * k });
  }
  return out;
})();

const VB_W = 402, VB_H = 800, SEA_Y = 508, PX_PER_MI = 3.214;

export default function ArchipelagoScreen() {
  // Fixed for the server render; the real clock lands in the effect below.
  const [hour, setHour] = useState(18.6);
  const [rain, setRain] = useState(0);
  const [slug, setSlug] = useState<string>("hawaii");
  const [live, setLive] = useState(false);

  useEffect(() => { syncNow(); }, []);

  function syncNow() {
    const d = new Date();
    setHour(Math.round((d.getHours() + d.getMinutes() / 60) * 4) / 4);
    setLive(true);
  }

  const isle = ISLANDS.find((i) => i.slug === slug) ?? ISLANDS[0];
  const f = useMemo(() => frameAt(hour), [hour]);

  // Rain darkens and desaturates the whole scene — storms are not just wetter.
  const wet = (c: string) => mix(c, "#4a5560", rain * 0.42);
  const sky = f.sky.map(wet), sea = f.sea.map(wet);
  const inkHeader = dayReads(sky[0]);

  const isDay = hour >= SUNRISE && hour <= SUNSET;
  const t = isDay
    ? (hour - SUNRISE) / (SUNSET - SUNRISE)
    : (hour > SUNSET ? hour - SUNSET : hour + 24 - SUNSET) / (24 - SUNSET + SUNRISE);
  const orbX = 44 + t * 314;
  const orbY = SEA_Y - 46 - Math.sin(t * Math.PI) * 352;
  // Hold the disc invisible right at the horizon so it never visibly teleports.
  const orbA = Math.min(1, Math.sin(t * Math.PI) * 5);

  const w = isle.spanMi * PX_PER_MI;
  const h = w; // paths are normalised square; aspect lives inside the path
  const x = (VB_W - w) / 2;
  const y = SEA_Y - h * 0.92;
  const [px, py] = isle.peakAt;

  return (
    <>
      <div className="arc-scene" aria-hidden>
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="arc-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={sky[0]} />
              <stop offset="0.58" stopColor={sky[1]} />
              <stop offset="1" stopColor={sky[2]} />
            </linearGradient>
            <radialGradient id="arc-halo">
              <stop offset="0" stopColor={f.sun} stopOpacity="0.5" />
              <stop offset="1" stopColor={f.sun} stopOpacity="0" />
            </radialGradient>
          </defs>

          <rect width={VB_W} height={SEA_Y} fill="url(#arc-sky)" />
          <g opacity={orbA}>
            <circle cx={orbX} cy={orbY} r="86" fill="url(#arc-halo)" />
            <circle cx={orbX} cy={orbY} r="21" fill={f.sun} />
          </g>

          {/* island: shadow rim first, then land, then two summit rings */}
          <g transform={`translate(${x} ${y}) scale(${w / 100})`}>
            <path d={isle.path} fill={f.rim} opacity="0.55" transform="translate(0 1.6)" />
            <path d={isle.path} fill={f.land} />
            <ellipse cx={px} cy={py} rx="17" ry="10" fill="none" stroke={f.rim} strokeWidth="0.9" opacity="0.4" />
            <ellipse cx={px} cy={py} rx="9" ry="5" fill="none" stroke={f.rim} strokeWidth="0.9" opacity="0.5" />
          </g>

          <rect y={SEA_Y} width={VB_W} height={VB_H - SEA_Y} fill={sea[0]} />
          <path d={`M0 ${SEA_Y + 54} Q 100 ${SEA_Y + 44} 201 ${SEA_Y + 54} T 402 ${SEA_Y + 54} V ${VB_H} H 0 Z`} fill={sea[1]} />
          <path d={`M0 ${SEA_Y + 152} Q 120 ${SEA_Y + 140} 220 ${SEA_Y + 152} T 402 ${SEA_Y + 150} V ${VB_H} H 0 Z`} fill={sea[2]} />

          <rect width={VB_W} height={VB_H} fill={f.haze} opacity={f.hazeA} />

          {rain > 0 && (
            <g className="arc-rain" stroke="#e8f0f0" strokeWidth="1.1" strokeLinecap="round" opacity={rain * 0.5}>
              {RAIN.map((r, i) => (
                <line key={i} x1={r.x} y1={r.y} x2={r.x - 7.8} y2={r.y + 26} />
              ))}
            </g>
          )}
        </svg>
      </div>

      <div className="arc-content">
        <header className={`mock-kilo arc-head${inkHeader ? "" : " arc-head-inv"}`}>
          <span className="word">Kilo</span>
          <span className="place">{isle.town === "uninhabited" ? isle.name : `${isle.town} · ${isle.name}`}</span>
          <span className="gear">Settings</span>
        </header>
        <p className={`mock-fresh arc-fresh${inkHeader ? "" : " arc-head-inv"}`}>
          {live ? `Checked ${clock(hour)}` : `Preview · ${clock(hour)}`}
        </p>

        <article className="arc-card">
          <h1 className="arc-h">Nothing in your way</h1>
          <p className="arc-p">
            {isle.slug === "hawaii"
              ? "The island is quiet. Kīlauea is resting, the water is running, and no roads are closed."
              : `${isle.name} is quiet. The water is running and no roads are closed.`}
          </p>
          <p className="arc-note">{isle.peak} · {isle.town}</p>
        </article>

        <section className="arc-panel" aria-label="Background controls">
          <p className="arc-lab">Island</p>
          <div className="arc-chips">
            {ISLANDS.map((i) => (
              <button
                key={i.slug}
                type="button"
                className={`arc-chip${i.slug === slug ? " on" : ""}`}
                aria-pressed={i.slug === slug}
                onClick={() => setSlug(i.slug)}
              >
                {i.name}
              </button>
            ))}
          </div>

          <label className="arc-row" htmlFor="arc-time">
            <span className="arc-lab">Time</span>
            <input
              id="arc-time" type="range" min={0} max={23.75} step={0.25} value={hour}
              aria-valuetext={clock(hour)}
              onChange={(e) => { setHour(Number(e.target.value)); setLive(false); }}
            />
            <output className="arc-val">{clock(hour)}</output>
          </label>

          <label className="arc-row" htmlFor="arc-rain">
            <span className="arc-lab">Rain</span>
            <input
              id="arc-rain" type="range" min={0} max={1} step={0.01} value={rain}
              aria-valuetext={`${Math.round(rain * 100)}%`}
              onChange={(e) => setRain(Number(e.target.value))}
            />
            <output className="arc-val">{Math.round(rain * 100)}%</output>
          </label>

          <button type="button" className="arc-btn" onClick={syncNow}>
            {live ? "Synced to now" : "Sync to now"}
          </button>
          <p className="arc-fine">
            Sky, sun, sea and rain are one interpolation over the hour — no WebGL, no images.
            In the real app the two sliders are a clock read and a forecast number.
          </p>
        </section>
      </div>
    </>
  );
}
