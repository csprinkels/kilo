"use client";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import PageShell, { Section } from "@/components/PageShell";
import OfficialWording from "@/components/OfficialWording";
import EmptyState from "@/components/EmptyState";
import type { Volcano, VolcanoStatus } from "@/lib/pages";
import type { Island } from "@/lib/types";
import { useJson, useStoredIsland } from "@/lib/data";
import { BANNED, SOURCE_NAME } from "@/lib/plain";
import { ISLAND_LABEL } from "@/lib/brand";

/** What is happening and what to do, from the USGS level — never the level word itself. */
function volcanoLine(name: string, v: VolcanoStatus): string {
  const where = /rift/i.test(v.where) ? `the ${v.where}` : v.where;
  if (v.level === "WARNING") return `${name} is in a dangerous eruption. Follow Civil Defense instructions now.`;
  if (v.level === "WATCH") {
    if (!v.erupting) return `${name} is restless but not erupting. Nothing to do yet.`;
    return /summit|halema/i.test(v.where) ? `${name} is erupting inside the summit crater. No homes are at risk.` : `${name} is erupting at ${where}. Check with Civil Defense if you live nearby.`;
  }
  if (v.level === "ADVISORY") return `${name} is quiet right now, between eruptions. Nothing to do.`;
  return `${name} is quiet.`;
}

// EPA category from the index number, in words people say. 0 good · 1 okay · 2 bad for asthma · 3 unhealthy for everyone
const AIR_WORD = ["good", "okay", "bad for people with asthma", "unhealthy for everyone"];
const airCat = (aqi: number) => (aqi <= 50 ? 0 : aqi <= 100 ? 1 : aqi <= 150 ? 2 : 3);
// Monitors that are not on Hawaiʻi Island; everything else is. ponytail: three names, a field on the feed if the list grows.
const MONITOR_ISLAND: Record<string, Island> = { Honolulu: "oahu", Kapolei: "oahu", Kīhei: "maui" };
const listOf = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

function airSentence(rows: { name: string; cat?: number }[], islandName: string): string {
  if (!rows.length) return `There is no air monitor on ${islandName}.`;
  const live = rows.filter((r) => r.cat != null);
  if (!live.length) return "No air readings right now.";
  const worst = Math.max(...live.map((r) => r.cat!));
  const towns = listOf(live.filter((r) => r.cat === worst).map((r) => r.name));
  if (worst === 0) return `Air is good in ${towns}.`;
  if (worst === 1) return `Air is okay in ${towns} today.`;
  if (worst === 2) return `Vog is bad for people with asthma in ${towns} today. Stay inside and skip hard exercise if it bothers you.`;
  return `Air is unhealthy for everyone in ${towns} today. Stay inside and skip hard exercise.`;
}

/** The first paragraph of the observatory's update as plain prose: ≤ 5 whole sentences, none with agency jargon. */
function plainProse(sections: Record<string, string>): string {
  const text = sections.Overview ?? Object.values(sections)[0] ?? "";
  const parts = text.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s+(?=[A-Z“"])/);
  if (text.endsWith("…") || !/[.!?]$/.test(text.trim())) parts.pop(); // the feed cuts the text; drop the half sentence
  return parts.filter((s) => !BANNED.some((re) => re.test(s))).slice(0, 5).join(" ");
}

const since = (ms?: number) => (ms ? ` · Since ${new Intl.DateTimeFormat("en-US", { timeZone: "Pacific/Honolulu", month: "short", day: "numeric" }).format(ms)}` : "");

export default function VolcanoPage() {
  // Remounting the body is how "Try again" re-runs the fetch.
  const [attempt, setAttempt] = useState(0);
  return <VolcanoBody key={attempt} onRetry={() => setAttempt((n) => n + 1)} />;
}

function VolcanoBody({ onRetry }: { onRetry: () => void }) {
  const v = useJson<Volcano>("v1/volcano.json");
  const d = v?.data;
  const [stored] = useStoredIsland();
  const island = stored === "state" ? "hawaii" : stored;
  const islandName = ISLAND_LABEL[island].split(" · ")[0];
  const [cam, setCam] = useState<string | null>(null);
  const now = v?.fetchedAt ?? 0;

  const k = d?.kilauea, ml = d?.maunaloa;
  const sentence = !v ? "Checking with the observatory…" : !d ? undefined
    : [k ? volcanoLine("Kīlauea", k) : "No update from the observatory right now.", ml && ml.level !== "NORMAL" ? volcanoLine("Mauna Loa", ml) : ""].join(" ").trim();

  const air = (d?.air ?? [])
    .filter((a) => (MONITOR_ISLAND[a.name] ?? "hawaii") === island)
    .map((a) => ({ name: a.name.replace(/\s*\(.*\)$/, ""), cat: a.aqi != null && !a.stale ? airCat(a.aqi) : undefined }))
    .slice(0, 5);
  const prose = k ? plainProse(k.sections) : "";
  const camName = d?.cams.find((c) => c.id === cam)?.name;

  return (
    <PageShell title="Kīlauea" sentence={sentence} fetchedAt={d ? v?.fetchedAt : undefined} gen={d?.upd} offline={v?.offline} source={SOURCE_NAME.hvo}>
      {v && !d && (
        <>
          <EmptyState kind="error" title="Can't load right now.">Try again when you have signal. In an emergency call 911.</EmptyState>
          <button onClick={onRetry} className="btn mt-s3">Try again</button>
        </>
      )}
      {d && (
        <>
          <Section title="Vog" sentence={airSentence(air, islandName)}>
            {air.length > 0 && (
              <ul className="mt-s2 divide-y divide-line">
                {air.map((a) => (
                  <li key={a.name} className="row text-body text-ink">
                    <span className="font-semibold">{a.name}</span> · <span className="text-ink-2">{a.cat != null ? AIR_WORD[a.cat] : "no reading right now"}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-s3 max-w-[36rem] text-body text-ink-2">If vog bothers you, stay inside with the windows closed and keep your medicine close. Dust masks do not stop vog.</p>
            <a className="inline-flex min-h-11 items-center gap-1 text-body font-semibold text-brand" href="https://vog.ivhhn.org/" target="_blank" rel="noreferrer">More about vog and your health <ChevronRight className="size-5" aria-hidden /></a>
          </Section>

          {k && (
            <Section title="From the observatory" sentence={prose || "The observatory's latest update is in the official wording below."}>
              <a className="inline-flex min-h-11 items-center gap-1 text-body font-semibold text-brand" href={k.noticeUrl} target="_blank" rel="noreferrer">Read the full update <ChevronRight className="size-5" aria-hidden /></a>
            </Section>
          )}

          {d.cams.length > 0 && (
            <Section title="Crater camera" sentence="A photo from the observatory's camera. Nothing loads until you tap.">
              {cam && (
                <figure className="picture mt-s3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`https://volcanoes.usgs.gov/cams/${cam}/images/M.jpg?ts=${Math.floor(now / 600_000)}`} alt={camName ?? "Crater camera"} className="w-full" />
                  <figcaption className="px-s4 py-s3 text-small text-ink-2">{camName}. A new photo every few minutes.</figcaption>
                </figure>
              )}
              {!cam ? (
                <button onClick={() => setCam(d.cams[0].id)} className="btn btn-big mt-s3 text-center">See a photo of the crater (uses a little data)</button>
              ) : (
                <label className="btn relative mt-s3 cursor-pointer">
                  Other cameras <ChevronDown className="size-5 text-ink-2" aria-hidden />
                  <select aria-label="Camera" value={cam} onChange={(e) => setCam(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
                    {d.cams.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
              )}
            </Section>
          )}

          {k && (
            <div className="mt-s7">
              <OfficialWording title={`USGS level: ${k.level} · Aviation color: ${k.color} (for aircraft only)${since(k.levelSince)}`} body={k.sms}>
                {ml && <p className="mt-s2">Mauna Loa — USGS level: {ml.level} · Aviation color: {ml.color}</p>}
                {Object.entries(k.sections).map(([h, body]) => (
                  <div key={h} className="mt-s3">
                    <p className="font-semibold text-ink">{h}</p>
                    <p className="mt-s1 whitespace-pre-line">{body}</p>
                  </div>
                ))}
              </OfficialWording>
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}
