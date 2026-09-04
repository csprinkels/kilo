"use client";
import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import ItemRow, { LEVEL_TEXT, NeighborRow } from "@/components/ItemRow";
import PageShell from "@/components/PageShell";
import EmptyState from "@/components/EmptyState";
import TileMap from "@/components/TileMap";
import { usePageFilter } from "@/components/PageFilter";
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
const subscribeOnline = (cb: () => void) => { addEventListener("online", cb); addEventListener("offline", cb); return () => { removeEventListener("online", cb); removeEventListener("offline", cb); }; };
const APP_NOTE = "Kilo does not save your location.";
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const isRoadwork = (i: Item) => i.source === "hdot";
const isClosed = (i: Item) => /both|closed/i.test(i.status ?? "") && !/open|lane/i.test(i.status ?? "");
/** How an item is drawn; an open detour is not drawn at all. */
const segmentKind = (i: Item): Segment["kind"] | null =>
  /alternate|detour/i.test(i.status ?? "") ? null : isRoadwork(i) ? "lane" : i.type === "road_closure" && isClosed(i) ? "closed" : i.type === "road_closure" ? "lane" : "spot";
/** The list's rail says what the map says: red = closed, orange = one lane, dotted = a spot. */
const RAIL: Record<Segment["kind"], string> = { closed: "tr-rail", lane: "tr-rail tr-rail--lane", spot: "tr-rail tr-rail--spot" };

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
  // The Waze embed is a live third-party web app: with no signal it is a grey box, so the chip
  // that reveals it has to go with it.
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);

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
  // Only the sections this island has today: a chip that filters to an empty page is worse than no chip.
  // Neither list of what is wrong on the road gets a chip. "Closed or blocked" says "or when a neighbor
  // reports one", and a neighbor's report is drawn nowhere else — not in that list, not on the map, not
  // in the hero sentence — so filtering it away would leave the page contradicting itself.
  const { bar, show, only } = usePageFilter([
    { id: "map", label: "Map" },
    ...(roadwork.length ? [{ id: "roadwork", label: "Roadwork" }] : []),
    // navigator.onLine only means an interface is up: a captive portal or a dead upstream still
    // reads as online. The feed's own verdict is the one that has actually tried to reach something.
    ...(online && !offline ? [{ id: "live", label: "Live traffic" }] : []),
  ]);

  const segments: Segment[] = [...official, ...roadwork].flatMap((i) => { const kind = segmentKind(i); return kind ? [{ key: i.key, kind, path: i.path, lat: i.lat, lon: i.lon, approx: i.fields?.approx === "area" }] : []; });
  const drawn = { closed: segments.filter((g) => g.kind === "closed").length, lane: segments.filter((g) => g.kind === "lane").length, spot: segments.filter((g) => g.kind === "spot" && g.lat != null && g.lon != null).length };
  const anyApprox = segments.some((g) => g.approx);
  // The same words as before, each now carrying the swatch it names, so the key reads at a glance.
  const keys: { sw: string; text: string }[] = [];
  if (drawn.closed) keys.push({ sw: "cs-key-sw--brick", text: "Red: closed." });
  if (drawn.lane) keys.push({ sw: "tr-swatch--lane", text: "Orange: one lane or roadwork." });
  if (drawn.spot) keys.push(anyApprox
    ? { sw: "cs-key-sw--dot tr-swatch--approx", text: "Dotted circles: crashes or lights out, by neighborhood." }
    : { sw: "cs-key-sw--dot cs-key-sw--brick", text: "Dots: crashes or lights out." });
  // Only alongside a map key, the way the old legend read: "Blue dot: you." never stood alone.
  if (you && keys.length) keys.push({ sw: "cs-key-sw--dot tr-swatch--you", text: "Blue dot: you." });
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
      {/* One column of glass cards on the paper ground, the way the mockup stacks them. */}
      <div className="mt-s5 flex flex-col gap-s3">
        {!loaded && offline && (
          <>
            <EmptyState kind="error" title="Can't load right now.">Try again when you have signal. In an emergency call 911.</EmptyState>
            {/* useFeed listens for "online" and re-polls a second later */}
            <button className="btn mt-s3" onClick={() => window.dispatchEvent(new Event("online"))}>Try again</button>
          </>
        )}
        {!loaded && !offline && <p className="text-body text-ink-2">Loading the roads on {islandName(island)}…</p>}
        {loaded && (
          <>
            {bar}
            {/* The island map is the card's picture; its key rides under it, each word wearing its own swatch. */}
            {show("map") && (
              <section className="cs-card t-roads">
                <div className="cs-figure tr-top">
                  <TileMap island={island} segments={segments} you={you ?? undefined} label={`Map of ${islandName(island)} showing ${plural(drawn.closed, "closed road")} and ${plural(drawn.lane, "roadwork site")}`} />
                </div>
                {keys.length > 0 && (
                  <div className="cs-keys">
                    {keys.map((k) => <span key={k.text} className="cs-key"><i className={`cs-key-sw ${k.sw}`} aria-hidden /> {k.text}</span>)}
                  </div>
                )}
              </section>
            )}

            {official.length > 0 && (
              <section className="cs-card">
                {you ? (
                  <p className="cs-body tr-top">{nearCount ? `${plural(nearCount, "closure or crash", "closures and crashes")} within ${NEAR_MILES} miles of you. Closest first.` : `Nothing closed within ${NEAR_MILES} miles of you. Closest first.`}</p>
                ) : (
                  <>
                    <button className="cs-ghost cs-wide tr-wide" onClick={locate} disabled={locating}><Icon name="crosshair" size={18} aria-hidden /> {locating ? "Finding you…" : "Show what is closed near me"}</button>
                    <p className="cs-meta tr-gap">{APP_NOTE}</p>
                  </>
                )}
              </section>
            )}
            {youMsg && <p className="cs-body">{youMsg}</p>}

            <section className="cs-card t-roads">
              <p className="cs-label"><Icon name="traffic-cone-fill" size={18} aria-hidden /> Closed or blocked</p>
              {official.length ? (
                <>
                  {anyStale && <p className="cs-meta">Where it says “Last update”, Civil Defense has not changed that row since then. Check before you go.</p>}
                  {byDistrict.map((d) => (
                    <div key={d.name ?? "-"}>
                      {byDistrict.length > 1 && d.name && <h3 className="cs-label tr-dist">{d.name}</h3>}
                      <ul className="tr-list">
                        {d.rows.map((g) => <RoadRow key={g.item.key} item={g.item} also={g.also} island={island} now={now} plain={plain.get(g.item.key)!} roads={roadsPack?.lines ?? []} miles={milesFrom(g.item)} you={you ?? undefined} district={byDistrict.length > 1 ? g.item.districts[0] : undefined} showSource={mixedSources} />)}
                      </ul>
                    </div>
                  ))}
                </>
              ) : (
                <p className="cs-body">{island === "oahu" ? "Nothing reported. Crashes show up here soon after someone calls 911." : island === "hawaii" ? "Nothing reported. Closures show up here when Civil Defense lists one, or when a neighbor reports one." : "Nothing reported. Closures show up here when the county lists one."}</p>
              )}
              {grouped.length > rows.length && !showAll && <button className="cs-ghost cs-wide tr-wide tr-more" onClick={() => setShowAll(true)}>Show {grouped.length - rows.length} more <Icon name="caret-down" size={16} aria-hidden /></button>}
            </section>

            {island === "hawaii" && (
              <section className="cs-card t-reports">
                <p className="cs-label"><Icon name="users-three-fill" size={18} aria-hidden /> What neighbors say</p>
                {neighbors.length ? <ul className="tr-list">{neighbors.map((i) => <NeighborRow key={i.key} item={i} now={now} />)}</ul> : <p className="cs-body">Nothing from neighbors today.</p>}
              </section>
            )}

            {/* HDOT files some closures as roadwork, and plain.ts words those "Road closed on …".
                When one of them is a closure this stops being a section and has to stay on screen. */}
            {show("roadwork", roadwork.some(isClosed)) && roadwork.length > 0 && (
              showWork || only === "roadwork" ? (
                <section className="cs-card t-roads">
                  <p className="cs-label"><Icon name="traffic-cone-fill" size={18} aria-hidden /> Roadwork</p>
                  <p className="cs-body tr-top">Planned work. Expect a wait, not a closed road.</p>
                  <ul className="tr-list">{roadwork.map((i) => <ItemRow key={i.key} item={i} now={now} showSource={false} />)}</ul>
                </section>
              ) : (
                <button className="cs-ghost cs-wide tr-wide" onClick={() => setShowWork(true)}><Icon name="traffic-cone" size={18} aria-hidden /> Show {plural(roadwork.length, "roadwork site")}</button>
              )
            )}

            {show("live") && online && !offline && (showMap || only === "live" ? (
              <section className="cs-card">
                <div className="cs-figure tr-top">
                  <iframe title={`Live traffic map of ${islandName(island)}`} src={`https://embed.waze.com/iframe?zoom=${w.zoom}&lat=${w.lat}&lon=${w.lon}&ct=livemap`} className="block h-[26rem] w-full" loading="lazy" allow="geolocation" />
                </div>
              </section>
            ) : (
              <button className="cs-ghost cs-wide tr-wide" onClick={() => setShowMap(true)}><Icon name="car" size={18} aria-hidden /> Open the live traffic map (needs a good signal)</button>
            ))}

            {island === "hawaii" && (
              <Link href="/report/?type=road_blocked" className="cs-card t-reports tr-tell">
                <span className="cs-ictile"><Icon name="note-pencil" size={21} /></span>
                <span className="cs-title">Saw something on the road? Tell your neighbors</span>
                <Icon name="caret-right" size={18} className="tr-caret" aria-hidden />
              </Link>
            )}
          </>
        )}
      </div>
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
 * The rail down the left says what the map says: red closed, orange one lane, dotted a spot.
 */
function RoadRow({ item, also = [], island, now, plain: p, roads, miles, you, district, showSource }: { item: Item; also?: Item[]; island: IslandId; now: number; plain: Plain; roads: RoadLine[]; miles?: number; you?: LatLon; district?: string; showSource?: boolean }) {
  const [open, setOpen] = useState(false);
  // The county sometimes types "None" into the detour field; plain.ts already turned that into "No way around listed yet."
  const alt = /^no way around/i.test(p.action) ? undefined : item.fields?.alternate?.trim();
  const detour = useMemo(() => (open && alt ? matchDetour(alt, roads) : []), [open, alt, roads]);
  const county = item.source.startsWith("hccda") && isClosed(item);
  const cd = CIVIL_DEFENSE[island];
  const [copied, setCopied] = useState(false);
  const kind = segmentKind(item);
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
      <button className="cs-row tr-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <i className={kind ? RAIL[kind] : "tr-rail tr-rail--spot"} aria-hidden />
        <span className="cs-rowmain">
          {(p.word || p.level >= 3) && <span className={`tr-word ${LEVEL_TEXT[p.level]}`}>{p.word ?? LEVEL_WORD[p.level]}</span>}
          <span className="cs-rowname">{title}{also.length ? ` (${also.length + 1} stretches)` : ""}</span>
          <span className="cs-rowsub num">{meta}</span>
        </span>
        <Icon name="caret-down" size={16} className={`tr-caret ${open ? "tr-caret--open" : ""}`} aria-hidden />
      </button>
      {open && (
        <div className="fade-up tr-detail">
          {path && (
            <>
              <div className="cs-figure tr-top"><TileMap className="h-[15rem]" island={island} segments={stretches.map((i) => ({ key: i.key, kind: segmentKind(i) ?? "lane", path: i.path }))} focus={allPoints} detour={detour} you={you} label={caption} /></div>
              <p className="cs-figcap">{caption}.{detour.length ? " Blue line: the way around." : ""}{you ? " Blue dot: you." : ""}</p>
            </>
          )}
          {county && (
            <>
              <div className="cs-rule" />
              <h4 className="cs-title tr-subtitle">Way around</h4>
              {alt ? (
                <p className="cs-body">Civil Defense says: use {alt}.{detour.length ? " It is the blue line on the map." : ""}</p>
              ) : (
                <>
                  <p className="cs-body">Civil Defense has not listed a way around this yet. If you live nearby and need to get through, call them.</p>
                  {cd && <div className="cs-actions"><a className="cs-cta" href={`tel:${cd.tel}`}><Icon name="phone" size={16} aria-hidden /> Call Civil Defense {cd.shown}</a></div>}
                </>
              )}
            </>
          )}
          {item.body && !path && <p className="cs-body tr-top">{item.body}</p>}
          {item.expiresAt && <p className="cs-meta tr-gap num">Until {fmtClock(item.expiresAt, now)}.</p>}
          <div className="cs-actions">
            {mid && <a className="cs-cta" href={item.fields?.approx === "area" ? `https://maps.apple.com/?q=${encodeURIComponent(`${item.title.split(/:|—/).slice(1).join(" ").trim()}, Oahu`)}` : `https://maps.apple.com/?ll=${mid[0].toFixed(5)},${mid[1].toFixed(5)}&q=${encodeURIComponent(roadName(item))}`} target="_blank" rel="noreferrer"><Icon name="map-pin" size={16} aria-hidden /> Open in Maps</a>}
            {item.srcUrl && <a className="cs-link" href={item.srcUrl} target="_blank" rel="noreferrer">Read it on their site</a>}
            <button className="cs-link" onClick={share}>{copied ? "Copied." : "Share"}</button>
          </div>
        </div>
      )}
    </li>
  );
}
