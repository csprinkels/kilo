import type { ForecastPoint, Quadrants, Storm, WindRadii } from "../../lib/storm.ts";

export const CURRENT_STORMS_URL = "https://www.nhc.noaa.gov/CurrentStorms.json";
/** Archived forecast advisories, for back-filling the past track: .../archive/2026/cp01/cp012026.fstadv.012.shtml */
export const archiveTcmUrl = (id: string, adv: number) =>
  `https://www.nhc.noaa.gov/archive/${id.slice(4)}/${id.slice(0, 4)}/${id}.fstadv.${String(adv).padStart(3, "0")}.shtml`;

export type CurrentStorm = {
  id: string; name: string; classification: string; intensity: string; pressure: string;
  latitudeNumeric: number; longitudeNumeric: number; movementDir: number; movementSpeed: number; lastUpdate: string;
  publicAdvisory?: { advNum: string; url: string }; forecastAdvisory?: { advNum: string; url: string };
  forecastDiscussion?: { url: string }; forecastGraphics?: { url: string }; trackCone?: { kmzFile?: string };
};

/** Only storms that could matter to Hawaiʻi: Central Pacific, or Eastern Pacific already west of 130°W. */
export function relevantStorms(json: { activeStorms?: CurrentStorm[] }): CurrentStorm[] {
  return (json.activeStorms ?? []).filter((s) => s.id.startsWith("cp") || (s.id.startsWith("ep") && s.longitudeNumeric <= -130));
}

/** The NHC pages wrap the product in <pre>. */
export function preText(html: string) {
  const m = /<pre[^>]*>([\s\S]*?)<\/pre>/i.exec(html);
  return (m ? m[1] : html).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/\r/g, "");
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const coord = (v: string) => (v.endsWith("S") || v.endsWith("W") ? -1 : 1) * parseFloat(v);

/** "20/0900Z" relative to the issue date; rolls into the next month when the day wraps. */
function stampFrom(issue: Date, ddhhmm: string) {
  const m = /(\d{2})\/(\d{2})(\d{2})Z/.exec(ddhhmm);
  if (!m) return NaN;
  const [, dd, hh, mi] = m.map(Number);
  let y = issue.getUTCFullYear(), mo = issue.getUTCMonth();
  if (dd < issue.getUTCDate() - 7) mo += 1; // crossed into next month
  if (dd > issue.getUTCDate() + 7) mo -= 1; // previous month (only in past-position lines)
  if (mo > 11) { mo = 0; y += 1; }
  if (mo < 0) { mo = 11; y -= 1; }
  return Date.UTC(y, mo, dd, hh, mi);
}

function radiiFrom(block: string): WindRadii {
  const out: WindRadii = {};
  for (const m of block.matchAll(/^\s*(34|50|64) KT\.+\s*(\d+)NE\s+(\d+)SE\s+(\d+)SW\s+(\d+)NW/gm)) {
    out[Number(m[1]) as 34 | 50 | 64] = [Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])] as Quadrants;
  }
  return out;
}

const CLS: [RegExp, string][] = [
  [/^POTENTIAL TROP/, "PTC"], [/^POST-TROPICAL/, "PC"], [/^HURRICANE/, "HU"], [/^TROPICAL STORM/, "TS"],
  [/^TROPICAL DEPRESSION/, "TD"], [/^SUBTROPICAL STORM/, "SS"], [/^SUBTROPICAL DEPRESSION/, "STD"], [/^REMNANTS/, "EX"],
];

export type Tcm = Pick<Storm, "cls" | "advNum" | "issuedAt" | "nextAdvisoryAt" | "lat" | "lon" | "windKt" | "gustKt" | "pressureMb" | "moveDirDeg" | "moveKt" | "radii" | "forecast"> & { name: string };

/** Parse a Tropical Cyclone Forecast/Advisory (TCM) text product. Throws if the header can't be read. */
export function parseTcm(text: string): Tcm {
  const t = text.toUpperCase();
  const head = /^(.+?) (FORECAST\/ADVISORY|SPECIAL FORECAST\/ADVISORY) NUMBER\s+(\d+)/m.exec(t);
  const issued = /(\d{4}) UTC [A-Z]{3} ([A-Z]{3}) (\d{1,2}) (\d{4})/.exec(t);
  if (!head || !issued) throw new Error("TCM header not found");
  const [, title, , adv] = head;
  const [, hhmm, mon, day, year] = issued;
  const issue = new Date(Date.UTC(Number(year), MONTHS.indexOf(mon), Number(day), Number(hhmm.slice(0, 2)), Number(hhmm.slice(2))));
  const cls = CLS.find(([re]) => re.test(title))?.[1] ?? "TS";
  const name = title.replace(/^(POTENTIAL TROPICAL CYCLONE|POST-TROPICAL CYCLONE|HURRICANE|TROPICAL STORM|TROPICAL DEPRESSION|SUBTROPICAL STORM|SUBTROPICAL DEPRESSION|REMNANTS OF)\s+/, "");

  const center = /CENTER LOCATED NEAR\s+([\d.]+[NS])\s+([\d.]+[EW])\s+AT\s+(\d{2}\/\d{4}Z)/.exec(t);
  const move = /PRESENT MOVEMENT TOWARD THE [A-Z-]+ OR\s+(\d+) DEGREES AT\s+(\d+) KT/.exec(t);
  const pres = /MINIMUM CENTRAL PRESSURE\s+(\d+) MB/.exec(t);
  const wind = /MAX SUSTAINED WINDS\s+(\d+) KT WITH GUSTS TO\s+(\d+) KT/.exec(t);
  const next = /NEXT ADVISORY AT\s+(\d{2}\/\d{4}Z)/.exec(t);
  if (!center || !wind) throw new Error("TCM center/wind not found");

  // Current radii: the block between MAX SUSTAINED WINDS and REPEAT...
  const curBlock = t.slice(wind.index, t.indexOf("REPEAT...", wind.index));

  const forecast: ForecastPoint[] = [];
  const re = /^(FORECAST|OUTLOOK) VALID\s+(\d{2}\/\d{4}Z)\s+([\d.]+[NS])\s+([\d.]+[EW])\s*\n\s*MAX WIND\s+(\d+) KT\.\.\.GUSTS\s+(\d+) KT\.?([\s\S]*?)(?=^\s*(?:FORECAST|OUTLOOK) VALID|^EXTENDED OUTLOOK|^REQUEST FOR|^\$\$|^NEXT ADVISORY)/gm;
  const issuedAt = issue.getTime();
  for (const m of t.matchAll(re)) {
    const at = stampFrom(issue, m[2]);
    if (!Number.isFinite(at)) continue;
    forecast.push({
      hour: Math.round((at - issuedAt) / 3_600_000),
      at, lat: coord(m[3]), lon: coord(m[4]),
      windKt: Number(m[5]), gustKt: Number(m[6]),
      radii: radiiFrom(m[7]),
      outlook: m[1] === "OUTLOOK" || undefined,
    });
  }

  return {
    name: name.trim().replace(/\s+/g, " ").replace(/\b([A-Z])([A-Z]+)/g, (_, a: string, b: string) => a + b.toLowerCase()),
    cls, advNum: Number(adv), issuedAt,
    nextAdvisoryAt: next ? stampFrom(issue, next[1]) : undefined,
    lat: coord(center[1]), lon: coord(center[2]),
    windKt: Number(wind[1]), gustKt: Number(wind[2]),
    pressureMb: pres ? Number(pres[1]) : undefined,
    moveDirDeg: move ? Number(move[1]) : undefined,
    moveKt: move ? Number(move[2]) : undefined,
    radii: radiiFrom(curBlock),
    forecast,
  };
}

const PROPER = ["Hawaii", "Hawaiian", "Oahu", "Maui", "Kauai", "Molokai", "Lanai", "Niihau", "Kahoolawe", "Honolulu", "Hilo", "Kona", "Papahanaumokuakea", "Johnston", "Midway", "Big Island", "Pacific"];
/** ALL-CAPS NHC headline -> sentence case, keeping storm and place names capitalized. */
export function sentenceCase(s: string, name?: string) {
  let out = s.toLowerCase();
  for (const w of [...PROPER, name].filter(Boolean) as string[]) out = out.replace(new RegExp(`\\b${w.toLowerCase()}\\b`, "g"), w);
  return out[0].toUpperCase() + out.slice(1);
}

/** Headline + "in effect" watch/warning lines from the Public Advisory (TCP). */
export function parseTcp(text: string, name?: string): { headline?: string; warnings: string[] } {
  const headline = /^\.\.\.([\s\S]+?)\.\.\.\s*$/m.exec(text)?.[1]?.replace(/\s+/g, " ").trim();
  const section = /SUMMARY OF WATCHES AND WARNINGS IN EFFECT:\s*([\s\S]*?)(?:\n\s*\n[A-Z][^\n]*means|\n\s*\nFor storm information|\n\s*\nDISCUSSION)/i.exec(text)?.[1] ?? "";
  const warnings: string[] = [];
  let current = "";
  for (const raw of section.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (/^A .+ is in effect for/i.test(line)) { if (current) warnings.push(current); current = line.replace(/\.\.\.$/, "").trim(); }
    else if (line.startsWith("*")) current += ` — ${line.replace(/^\*\s*/, "")}`;
    else if (current) current += ` ${line}`;
  }
  if (current) warnings.push(current);
  return { headline: headline ? sentenceCase(headline, name) : undefined, warnings: warnings.map((w) => w.replace(/\s+/g, " ")) };
}
