"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import Icon, { type IconName } from "@/components/Icon";
import ItemRow, { LEVEL_TEXT, NeighborRow } from "@/components/ItemRow";
import PageShell, { Section } from "@/components/PageShell";
import EmptyState from "@/components/EmptyState";
import TileMap from "@/components/TileMap";
import { useRoads, type Segment } from "@/components/RoadMap";
import type { Island, Item } from "@/lib/types";
import { hashOf, smsText } from "@/lib/types";
import { useFeed, useStoredIsland } from "@/lib/data";
import { ISLAND_LABEL, fmtClock } from "@/lib/brand";
import { LEVEL_WORD, lastUpdated, plainAlert, type Plain, highway } from "@/lib/plain";
import { endsWord, matchDetour, milesToPath, milesWord, pathMidpoint, pathMiles, type LatLon, type RoadLine } from "@/lib/roads";
import { districtName } from "@/lib/places";
import { shareText } from "@/lib/native";

type IslandId = Exclude<Island, "state">;

// Waze's official embeddable live map (jams + crowd reports). Loaded only on tap: it's a full web app.
const WAZE: Record<IslandId, { lat: number; lon: number; zoom: number }> = {
  hawaii: { lat: 19.62, lon: -155.45, zoom: 9 }, maui: { lat: 20.8, lon: -156.33, zoom: 10 },
  oahu: { lat: 21.42, lon: -157.98, zoom: 10 }, kauai: { lat: 22.05, lon: -159.5, zoom: 10 },
};
const SOURCE: Record<IslandId, string> = {
  hawaii: "Hawaiʻi County Civil Defense and the state highways department", oahu: "Honolulu 911 dispatch and the state highways department",
  maui: "the state highways department", kauai: "the state highways department",
};
const islandName = (i: IslandId) => ISLAND_LABEL[i].split(" · ")[0];
// Who to call when the county has not listed a way around. Only Hawaiʻi County publishes closures with detours today.
const CIVIL_DEFENSE: Partial<Record<IslandId, { tel: string; shown: string }>> = { hawaii: { tel: "+18089350031", shown: "(808) 935-0031" } };
const NEAR_MILES = 5;
const APP_NOTE = "Kilo does not save your location.";
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const isRoadwork = (i: Item) => i.source === "hdot";
const isClosed = (i: Item) => /both|closed/i.test(i.status ?? "") && !/open|lane/i.test(i.status ?? "");
/** How an item is drawn; an open detour is not drawn at all. */
const segmentKind = (i: Item): Segment["kind"] | null =>
  /alternate|detour/i.test(i.status ?? "") ? null : isRoadwork(i) ? "lane" : i.type === "road_closure" && isClosed(i) ? "closed" : i.type === "road_closure" ? "lane" : "spot";

/** One sentence: the worst closure and its detour, then how many more, then crashes. Quiet days count roadwork. */
function roadsSentence(island: IslandId, closures: Item[], trouble: Item[], roadwork: number, plain: Map<string, Plain>): string {
  const parts: string[] = [];
  if (closures.length) {
    const p = plain.get(closures[0].key)!;
    parts.push(`${p.headline}.`);
    if (p.action) parts.push(p.action);
    if (closures.length > 1) parts.push(`${closures.length - 1} more ${closures.length === 2 ? "closure" : "closures"}.`);
  }
  const crashes = trouble.filter((i) => /crash/.test(i.status ?? "")).length, lights = trouble.filter((i) => /signal/.test(i.status ?? "")).length, other = trouble.length - crashes - lights;
  const bits = [crashes && plural(crashes, "crash", "crashes"), lights && plural(lights, "traffic light out", "traffic lights out"), other && plural(other, "stalled car")].filter(Boolean);
  if (bits.length) parts.push(`${bits.join(", ")} in the last few hours.`);
  if (!parts.length) parts.push(`No crashes or closures reported on ${islandName(island)}.`, roadwork ? `${plural(roadwork, "roadwork site")} today.` : "");
  return parts.filter(Boolean).join(" ");
}

export default function RoadsPage() {
  const [stored, setIsland] = useStoredIsland();
  const island: IslandId = stored === "state" ? "hawaii" : stored;
  const { snap, ess, mode } = useFeed(island);
  const now = ess?.fetchedAt || snap?.fetchedAt || 0;
  const [showMap, setShowMap] = useState(false);
  const [showWork, setShowWork] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [you, setYou] = useState<LatLon | null>(null);
  const [youMsg, setYouMsg] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const roadsPack = useRoads(island);

  const items = useMemo(() => (snap?.data?.items ?? []).filter((i) => i.type === "traffic" || i.type === "road_closure"), [snap]);
  const plain = useMemo(() => new Map(items.map((i) => [i.key, plainAlert(i, now, island)] as [string, Plain])), [items, now, island]);
  // Distance from the reader to each item, only after they asked ("2.1 miles from you"). Never stored.
  const milesFrom = (i: Item): number | undefined => !you ? undefined : i.path?.length ? milesToPath(you, i.path) : i.lat != null && i.lon != null ? milesToPath(you, [[i.lat, i.lon]]) : undefined;
  const official = items.filter((i) => i.tier !== "community" && !isRoadwork(i)).sort((a, b) => {
    if (you) { const da = milesFrom(a) ?? 1e9, db = milesFrom(b) ?? 1e9; if (da !== db) return da - db; }
    return plain.get(b.key)!.level - plain.get(a.key)!.level || b.issuedAt - a.issuedAt;
  });
  const closures = official.filter((i) => i.type === "road_closure" && isClosed(i));
  const trouble = official.filter((i) => i.type === "traffic");
  const neighbors = items.filter((i) => i.tier === "community");
  const roadwork = items.filter(isRoadwork);
  const loaded = !!snap?.data;
  const offline = !!snap?.offline && !!ess?.offline;

  const segments: Segment[] = [...official, ...roadwork].flatMap((i) => { const kind = segmentKind(i); return kind ? [{ key: i.key, kind, path: i.path, lat: i.lat, lon: i.lon, approx: i.fields?.approx === "area" }] : []; });
  const drawn = { closed: segments.filter((g) => g.kind === "closed").length, lane: segments.filter((g) => g.kind === "lane").length, spot: segments.filter((g) => g.kind === "spot" && g.lat != null && g.lon != null).length };
  const anyApprox = segments.some((g) => g.approx);
  const legend = [drawn.closed && "Red: closed.", drawn.lane && "Orange: one lane or roadwork.", drawn.spot && (anyApprox ? "Dotted circles: crashes or lights out, by neighborhood." : "Dots: crashes or lights out.")].filter(Boolean).join(" ");
  // The county sometimes enters one road three times (one row per stretch). One row per road + status; the map still draws every stretch.
  const grouped: { key: string; item: Item; also: Item[] }[] = [];
  for (const i of official) {
    const key = `${roadName(i).toLowerCase()}|${(i.status ?? "").toLowerCase()}|${i.source.split(":")[0]}`;
    const g = grouped.find((x) => x.key === key);
    if (g) g.also.push(i); else grouped.push({ key, item: i, also: [] });
  }
  const nearCount = you ? grouped.filter((g) => (milesFrom(g.item) ?? 1e9) <= NEAR_MILES).length : 0;
  const rows = showAll ? grouped : grouped.slice(0, you ? Math.max(3, nearCount) : 3);
  // One box per district, in the order the rows already have (nearest first when you asked, else most urgent first).
  const byDistrict: { name: string | null; rows: typeof rows }[] = [];
  for (const g of rows) {
    const name = g.item.districts[0] ? districtName(g.item.districts[0]) : null;
    const d = byDistrict.find((x) => x.name === name);
    if (d) d.rows.push(g); else byDistrict.push({ name, rows: [g] });
  }
  const mixedSources = new Set(official.map((i) => i.source.split(":")[0])).size > 1;
  const anyStale = rows.some((g) => lastUpdated(g.item, now).stale);
  const w = WAZE[island];

  const locate = () => {
    if (!("geolocation" in navigator)) { setYouMsg("This phone cannot share its location."); return; }
    setLocating(true); setYouMsg(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { setYou([coords.latitude, coords.longitude]); setLocating(false); },
      () => { setLocating(false); setYouMsg("Your phone would not share its location. You can still read the list below."); },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  };

  return (
    <PageShell title="Roads" sentence={loaded ? roadsSentence(island, closures, trouble, roadwork.length, plain) : undefined} island={island} onIsland={setIsland}
      fetchedAt={ess?.fetchedAt ?? snap?.fetchedAt} gen={snap?.data?.gen} offline={offline} weak={mode === "low" && !offline} source={SOURCE[island]}>
      {!loaded && offline && (
        <>
          <EmptyState kind="error" title="Can't load right now.">Try again when you have signal. In an emergency call 911.</EmptyState>
          {/* useFeed listens for "online" and re-polls a second later */}
          <button className="btn mt-s3" onClick={() => window.dispatchEvent(new Event("online"))}>Try again</button>
        </>
      )}
      {!loaded && !offline && <p className="mt-s4 text-body text-ink-2">Loading the roads on {islandName(island)}…</p>}
      {loaded && (
        <>
          <div className="picture mt-s4">
            <TileMap island={island} segments={segments} you={you ?? undefined} label={`Map of ${islandName(island)} showing ${plural(drawn.closed, "closed road")} and ${plural(drawn.lane, "roadwork site")}`} />
          </div>
          {legend && <p className="mt-s3 text-small text-ink-2">{legend}{you ? " Blue dot: you." : ""}</p>}

          {official.length > 0 && (
            you ? (
              <p className="mt-s3 max-w-[36rem] text-body text-ink">{nearCount ? `${plural(nearCount, "closure or crash", "closures and crashes")} within ${NEAR_MILES} miles of you. Closest first.` : `Nothing closed within ${NEAR_MILES} miles of you. Closest first.`}</p>
            ) : (
              <>
                <button className="btn mt-s3" onClick={locate} disabled={locating}><Icon name="crosshair" className="size-5" aria-hidden /> {locating ? "Finding you…" : "Show what is closed near me"}</button>
                <p className="mt-s1 text-small text-ink-2">{APP_NOTE}</p>
              </>
            )
          )}
          {youMsg && <p className="mt-s2 text-body text-ink-2">{youMsg}</p>}

          <Section title="Closed or blocked">
            {official.length ? (
              <>
                {anyStale && <p className="mt-s2 max-w-[36rem] text-body text-ink-2">Where it says “Last update”, Civil Defense has not changed that row since then. Check before you go.</p>}
                {byDistrict.map((d) => (
                  <div key={d.name ?? "-"}>
                    {byDistrict.length > 1 && d.name && <h3 className="now-label mt-s4">{d.name}</h3>}
                    <ul className={`list ${byDistrict.length > 1 ? "mt-s2" : "mt-s3"}`}>
                      {d.rows.map((g) => <RoadRow key={g.item.key} item={g.item} also={g.also} island={island} now={now} plain={plain.get(g.item.key)!} roads={roadsPack?.lines ?? []} miles={milesFrom(g.item)} you={you ?? undefined} district={byDistrict.length > 1 ? g.item.districts[0] : undefined} showSource={mixedSources} />)}
                    </ul>
                  </div>
                ))}
              </>
            ) : (
              <p className="mt-s2 max-w-[36rem] text-body text-ink-2">{island === "oahu" ? "Nothing reported. Crashes show up here soon after someone calls 911." : island === "hawaii" ? "Nothing reported. Closures show up here when Civil Defense lists one, or when a neighbor reports one." : "Nothing reported. Closures show up here when the county lists one."}</p>
            )}
            {grouped.length > rows.length && !showAll && <button className="btn mt-s3" onClick={() => setShowAll(true)}>Show {grouped.length - rows.length} more <Icon name="caret-down" className="size-5" aria-hidden /></button>}
          </Section>

          {island === "hawaii" && (
            <Section title="What neighbors say">
              {neighbors.length ? <ul className="list mt-s3">{neighbors.map((i) => <NeighborRow key={i.key} item={i} now={now} />)}</ul> : <p className="mt-s2 text-body text-ink-2">Nothing from neighbors today.</p>}
            </Section>
          )}

          {roadwork.length > 0 && (
            <section className="mt-s7">
              {showWork ? (
                <>
                  <h2 className="h-title">Roadwork</h2>
                  <p className="mt-s2 max-w-[36rem] text-body text-ink-2">Planned work. Expect a wait, not a closed road.</p>
                  <ul className="list mt-s3">{roadwork.map((i) => <ItemRow key={i.key} item={i} now={now} showSource={false} />)}</ul>
                </>
              ) : (
                <button className="btn btn-big" onClick={() => setShowWork(true)}><Icon name="traffic-cone" className="size-5" aria-hidden /> Show {plural(roadwork.length, "roadwork site")}</button>
              )}
            </section>
          )}

          <section className="mt-s4">
            {showMap ? (
              <div className="picture">
                <iframe title={`Live traffic map of ${islandName(island)}`} src={`https://embed.waze.com/iframe?zoom=${w.zoom}&lat=${w.lat}&lon=${w.lon}&ct=livemap`} className="block h-[26rem] w-full" loading="lazy" allow="geolocation" />
              </div>
            ) : (
              <button className="btn btn-big" onClick={() => setShowMap(true)}><Icon name="car" className="size-5" aria-hidden /> Open the live traffic map (needs a good signal)</button>
            )}
          </section>

          {island === "hawaii" && (
            <Link href="/report/?type=road_blocked" className="row mt-s4 border-t border-line">
              <span className="flex-1 text-body font-semibold text-ink">Saw something on the road? Tell your neighbors</span>
              <Icon name="caret-right" className="size-5 shrink-0 text-ink-2" aria-hidden />
            </Link>
          )}
        </>
      )}
    </PageShell>
  );
}

/** Short road name people say: "Highway 130", "Wood Valley Road". */
function roadName(item: Item) {
  const raw = isRoadwork(item) ? item.title.split(":")[0] : item.title.split(" — ")[0];
  return highway(raw.replace(/_.*$/, "")).trim();
}

/**
 * A closure or crash row, like ItemRow but with the closed stretch drawn when you open it.
 * Headline and action come from plainAlert so the words match the rest of the app.
 */
function RoadRow({ item, also = [], island, now, plain: p, roads, miles, you, district, showSource }: { item: Item; also?: Item[]; island: IslandId; now: number; plain: Plain; roads: RoadLine[]; miles?: number; you?: LatLon; district?: string; showSource?: boolean }) {
  const [open, setOpen] = useState(false);
  // The county sometimes types "None" into the detour field; plain.ts already turned that into "No way around listed yet."
  const alt = /^no way around/i.test(p.action) ? undefined : item.fields?.alternate?.trim();
  const detour = useMemo(() => (open && alt ? matchDetour(alt, roads) : []), [open, alt, roads]);
  const county = item.source.startsWith("hccda") && isClosed(item);
  const cd = CIVIL_DEFENSE[island];
  const [copied, setCopied] = useState(false);
  const glyph: IconName = item.type === "traffic" ? "car" : "traffic-cone";
  // The same colours as the map: red = closed, orange = one lane, so the list and the picture say the same thing.
  const kind = segmentKind(item);
  const tone = kind === "lane" ? "text-warn" : kind ? "text-danger" : LEVEL_TEXT[p.level];
  // Under a district heading the headline need not repeat the district.
  const title = district ? p.headline.replace(` in ${district}`, "") : p.headline;
  const updated = lastUpdated(item, now);
  const meta = [
    miles != null ? `${milesWord(miles)} from you` : "",
    p.action && !/^no way around/i.test(p.action) ? p.action.replace(/\.$/, "") : "",
    showSource ? p.source[0].toUpperCase() + p.source.slice(1) : "",
    updated.stale ? `Last update ${fmtClock(updated.at, now)}` : fmtClock(updated.at, now),
  ].filter(Boolean).join(" · ");
  const path: LatLon[] | undefined = item.path && item.path.length >= 2 ? item.path : undefined;
  const stretches = [item, ...also].filter((i) => i.path && i.path.length >= 2);
  const allPoints: LatLon[] = stretches.flatMap((i) => i.path!);
  const mid = path ? pathMidpoint(path) : item.lat != null && item.lon != null ? ([item.lat, item.lon] as LatLon) : undefined;
  const verb = item.type === "traffic" ? "" : /one lane|partial/i.test(item.status ?? "") ? "down to one lane" : isClosed(item) ? "closed" : "";
  const totalMiles = stretches.reduce((n, i) => n + pathMiles(i.path!), 0);
  const caption = path && verb ? `${roadName(item)} ${verb} ${endsWord(allPoints, island)} · ${milesWord(totalMiles)}${also.length ? ` in ${also.length + 1} stretches` : ""}` : path ? `${roadName(item)} ${endsWord(allPoints, island)} · ${milesWord(totalMiles)}` : "";
  const share = async () => {
    const text = smsText(item);
    if ((await shareText(text)) === "copied") setCopied(true);
  };
  return (
    <li id={`item-${hashOf(item.key)}`}>
      <button className="row items-start" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className={`tile mt-0.5 ${kind === "closed" ? "bg-danger-bg" : kind === "lane" ? "bg-warn-bg" : ""}`}><Icon name={`${glyph}-fill`} size={20} className={tone} /></span>
        <span className="min-w-0 flex-1">
          {(p.word || p.level >= 3) && <span className={`block text-small font-bold ${LEVEL_TEXT[p.level]}`}>{p.word ?? LEVEL_WORD[p.level]}</span>}
          <span className="block text-body font-semibold leading-snug text-ink">{title}{also.length ? ` (${also.length + 1} stretches)` : ""}</span>
          <span className="mt-0.5 block text-small text-ink-2 num">{meta}</span>
        </span>
        <Icon name="caret-down" className={`mt-2 size-5 shrink-0 text-ink-2 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div className="fade-up mb-s4 pl-9">
          {path && (
            <>
              <div className="well"><TileMap className="h-[15rem]" island={island} segments={stretches.map((i) => ({ key: i.key, kind: segmentKind(i) ?? "lane", path: i.path }))} focus={allPoints} detour={detour} you={you} label={caption} /></div>
              <p className="mt-s3 text-small text-ink-2">{caption}.{detour.length ? " Blue line: the way around." : ""}{you ? " Blue dot: you." : ""}</p>
            </>
          )}
          {county && (
            <div className="mt-s3">
              <p className="text-body font-semibold text-ink">Way around</p>
              {alt ? (
                <p className="mt-1 text-body text-ink-2">Civil Defense says: use {alt}.{detour.length ? " It is the blue line on the map." : ""}</p>
              ) : (
                <>
                  <p className="mt-1 text-body text-ink-2">Civil Defense has not listed a way around this yet. If you live nearby and need to get through, call them.</p>
                  {cd && <a className="btn mt-s2" href={`tel:${cd.tel}`}><Icon name="phone" className="size-5" aria-hidden /> Call Civil Defense {cd.shown}</a>}
                </>
              )}
            </div>
          )}
          {item.body && !path && <p className="text-body leading-relaxed text-ink-2">{item.body}</p>}
          {item.expiresAt && <p className="mt-s2 text-small text-ink-2 num">Until {fmtClock(item.expiresAt, now)}.</p>}
          <p className="mt-s2 flex flex-wrap gap-x-s4 text-small font-semibold">
            {mid && <a className="inline-flex min-h-11 items-center gap-1 text-brand" href={item.fields?.approx === "area" ? `https://maps.apple.com/?q=${encodeURIComponent(`${item.title.split(/:|—/).slice(1).join(" ").trim()}, Oahu`)}` : `https://maps.apple.com/?ll=${mid[0].toFixed(5)},${mid[1].toFixed(5)}&q=${encodeURIComponent(roadName(item))}`} target="_blank" rel="noreferrer"><Icon name="map-pin" className="size-4" aria-hidden /> Open in Maps</a>}
            {item.srcUrl && <a className="inline-flex min-h-11 items-center gap-1 text-brand" href={item.srcUrl} target="_blank" rel="noreferrer"><Icon name="arrow-square-out" className="size-4" aria-hidden /> Read it on their site</a>}
            <button className="inline-flex min-h-11 items-center gap-1 text-brand" onClick={share}><Icon name="share-network" className="size-4" aria-hidden /> {copied ? "Copied." : "Share"}</button>
          </p>
        </div>
      )}
    </li>
  );
}
