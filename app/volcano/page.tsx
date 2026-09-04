"use client";
import { useState } from "react";
import Icon from "@/components/Icon";
import PageShell from "@/components/PageShell";
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
// The shared pip, one step per category: teal "nothing wrong", slate, amber, brick.
const AIR_PIP = ["", "cs-pip--ok", "cs-pip--warn", "cs-pip--down"];
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

/** Same words, two blocks: the first whole sentence carries the card, the rest is body under it. Never a rewrite. */
function split(s: string): [string, string?] {
  const m = /^(.{16,}?[.!?])\s+(?=[A-Z“"])([\s\S]+)$/.exec(s.trim());
  return m ? [m[1], m[2]] : [s, undefined];
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
  const worst = Math.max(-1, ...air.map((a) => a.cat ?? -1)); // the meter runs to the worst monitor on the island
  const [airHead, airRest] = split(airSentence(air, islandName));
  const [proseHead, proseRest] = split(plainProse(k?.sections ?? {}) || "The observatory's latest update is in the official wording below.");
  const [camHead, camRest] = split("A photo from the observatory's camera. Nothing loads until you tap.");
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
        <div className="vo-stack mt-s6">
          <section className="cs-card t-volcano">
            <p className="cs-label"><Icon name="wind" size={15} />Vog</p>
            <h2 className="cs-title">{airHead}</h2>
            {airRest && <p className="cs-body">{airRest}</p>}

            {/* The island's worst reading as a four-step meter. No labels under it: the
                app's four words are whole phrases, and shortening them is not ours to do. */}
            {worst >= 0 && (
              <div className={`cs-meter${worst === 2 ? " cs-meter--warn" : ""}${worst === 3 ? " vo-meter--bad" : ""}`} aria-hidden>
                {[0, 1, 2, 3].map((i) => <span key={i} className={`cs-seg${i <= worst ? " cs-seg--now" : ""}`} />)}
              </div>
            )}

            {air.length > 0 && (
              <ul className="vo-air">
                {air.map((a) => (
                  <li key={a.name} className="cs-row cs-row--mid">
                    <span className={`cs-pip cs-pip--lg ${a.cat != null ? AIR_PIP[a.cat] : "cs-pip--none"}`} aria-hidden />
                    <span className="cs-rowmain cs-rowname">{a.name}</span>
                    <span className="cs-rowend cs-rowsub">{a.cat != null ? AIR_WORD[a.cat] : "no reading right now"}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="cs-rule" />
            <p className="cs-meta">If vog bothers you, stay inside with the windows closed and keep your medicine close. Dust masks do not stop vog.</p>
            <div className="cs-actions">
              <a className="cs-link" href="https://vog.ivhhn.org/" target="_blank" rel="noreferrer">More about vog and your health</a>
            </div>
          </section>

          {k && (
            <section className="cs-card t-volcano">
              <p className="cs-label"><Icon name="mountains" size={15} />From the observatory</p>
              <h2 className="cs-title">{proseHead}</h2>
              {proseRest && <p className="cs-body">{proseRest}</p>}
              <div className="cs-actions">
                <a className="cs-link" href={k.noticeUrl} target="_blank" rel="noreferrer">Read the full update</a>
              </div>
            </section>
          )}

          {d.cams.length > 0 && (
            <section className="cs-card t-volcano">
              <p className="cs-label"><Icon name="camera" size={15} />Crater camera</p>
              <h2 className="cs-title">{camHead}</h2>
              {camRest && <p className="cs-body">{camRest}</p>}

              {cam && (
                <figure className="cs-figure">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`https://volcanoes.usgs.gov/cams/${cam}/images/M.jpg?ts=${Math.floor(now / 600_000)}`} alt={camName ?? "Crater camera"} className="w-full" />
                  <figcaption className="vo-cam-cap">{camName}. A new photo every few minutes.</figcaption>
                </figure>
              )}

              {!cam ? (
                <button onClick={() => setCam(d.cams[0].id)} className="cs-cta cs-wide vo-cam-go">See a photo of the crater (uses a little data)</button>
              ) : (
                <label className="cs-ghost cs-wide vo-cam-go relative cursor-pointer">
                  Other cameras <Icon name="caret-down" size={18} />
                  <select aria-label="Camera" value={cam} onChange={(e) => setCam(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
                    {d.cams.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
              )}
            </section>
          )}

          {k && (
            <div className="vo-notice">
              <OfficialWording title={`USGS level: ${k.level} · Aviation color: ${k.color} (for aircraft only)${since(k.levelSince)}`} body={k.sms}>
                {ml && <p className="mt-s2">Mauna Loa — USGS level: {ml.level} · Aviation color: {ml.color}</p>}
                {Object.entries(k.sections).map(([h, body]) => (
                  <div key={h} className="mt-s4">
                    <p className="vo-sec-h">{h}</p>
                    <p className="mt-s2 whitespace-pre-line">{body}</p>
                  </div>
                ))}
              </OfficialWording>
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}
