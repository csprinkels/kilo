import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseNws } from "../convex/parsers/nws.ts";
import { parseHccda } from "../convex/parsers/hccda.ts";

const fx = (f: string) => JSON.parse(readFileSync(new URL(`../fixtures/${f}`, import.meta.url), "utf8"));
const NOW = Date.parse("2026-08-19T21:00:00-10:00");

test("NWS: Lala-week alerts map to islands, severities, and end times", () => {
  const items = parseNws(fx("nws-alerts-lala.json"), NOW);
  assert.ok(items.length > 50, `expected many items, got ${items.length}`);
  assert.ok(items.every((i) => i.key.startsWith("nws:") && i.title.length <= 120 && i.body.length <= 600));
  // Cancellations are dropped
  assert.ok(!items.some((i) => i.body.startsWith("The Flood Watch has been cancelled")));
  const hurricane = items.find((i) => i.fields?.event === "Hurricane Warning")!;
  assert.equal(hurricane.sev, 4);
  assert.equal(hurricane.type, "storm");
  assert.ok(hurricane.islands.every((x) => ["hawaii", "maui", "oahu", "kauai"].includes(x)));
  const ffw = items.find((i) => i.fields?.event === "Flash Flood Warning")!;
  assert.equal(ffw.sev, 4, "Flash Flood Warning is life-safety even though NWS says Severe");
  // expiresAt uses `ends` (event end), not `expires` (message staleness)
  const withEnds = fx("nws-alerts-lala.json").features.find(
    (f: { properties: { ends?: string; messageType: string; status: string } }) =>
      f.properties.ends && f.properties.messageType !== "Cancel" && f.properties.status === "Actual",
  );
  const match = items.find((i) => i.key === `nws:${withEnds.properties.id}`)!;
  assert.equal(match.expiresAt, Date.parse(withEnds.properties.ends));
});

test("NWS: empty active feed yields no items", () => {
  assert.deepEqual(parseNws(fx("nws-alerts.json"), NOW), []);
});

test("HCCDA: only open shelters and active closures survive; districts carried", () => {
  const shelters = parseHccda("shelters", fx("hccda-emergency_shelters.json"), NOW);
  assert.equal(shelters.length, 1);
  assert.match(shelters[0].title, /Shelter OPEN: Naalehu Elementary/);
  assert.deepEqual(shelters[0].districts, ["Kau"]);
  assert.ok(shelters[0].lat && shelters[0].lon);

  const roads = parseHccda("roads", fx("hccda-road_closures.json"), NOW);
  assert.equal(roads.length, 19, "20 active rows, one blank junk row skipped");
  assert.ok(roads.every((r) => r.type === "road_closure" && r.islands[0] === "hawaii" && r.districts.length === 1));
  assert.ok(roads.some((r) => r.status === "Closed in Both Directions" && r.sev === 2));
  assert.ok(roads.some((r) => r.status === "One Lane Open" && r.sev === 1));

  assert.equal(parseHccda("evacs", fx("hccda-evacuations.json"), NOW).length, 0, "both evacs are inactive");
  assert.equal(parseHccda("hazards", fx("hccda-hazards.json"), NOW).length, 0);
  assert.equal(parseHccda("schools", fx("hccda-school_closures.json"), NOW).length, 2);
});

test("HCCDA: malformed layer does not throw", () => {
  assert.deepEqual(parseHccda("roads", { features: [] }, NOW), []);
  assert.deepEqual(parseHccda("roads", {} as never, NOW), []);
});

test("new feeds: USGS, HVO, HDOT, HI-EMA, PTWC parse their fixtures", async () => {
  const { parseUsgs, parseHvo, parseHdot, parseHiema, parsePtwc } = await import("../convex/parsers/feeds.ts");
  const now = Date.parse("2026-08-19T21:00:00-10:00");
  const txt = (f: string) => readFileSync(new URL(`../fixtures/${f}`, import.meta.url), "utf8");

  const quakes = parseUsgs(fx("usgs-hi.json"), now);
  assert.ok(quakes.length >= 1 && quakes.length <= 20);
  assert.ok(quakes.every((q) => q.islands[0] === "hawaii" && q.type === "quake" && now - q.issuedAt < 3 * 86_400_000));
  assert.ok(quakes.some((q) => q.fields?.mag === "4.1" && q.sev === 2));

  const volcanoes = parseHvo(fx("hvo-elevated.json"), now);
  assert.equal(volcanoes.length, 1);
  assert.match(volcanoes[0].title, /Kīlauea: ADVISORY \/ YELLOW/);
  assert.equal(volcanoes[0].sev, 1, "chronic YELLOW is informational, not a warning");

  const lanes = parseHdot(fx("hdot-current.json"), now);
  assert.ok(lanes.length > 0 && lanes.length < 32, `expected dedupe by project, got ${lanes.length}`);
  assert.ok(lanes.every((l) => l.sev === 1 && ["oahu", "maui", "kauai", "hawaii"].includes(l.islands[0])));

  const notices = parseHiema(txt("hiema.rss"), now);
  assert.ok(notices.length >= 1);
  assert.match(notices[0].title, /Lala/);
  assert.ok(!/<|&#8230;/.test(notices[0].body), "HTML and entities stripped");
  assert.deepEqual(notices[0].islands, ["state"]);

  const tsunami = parsePtwc(txt("ptwc.atom"), now);
  assert.equal(tsunami.length, 0, "a week-old information statement has aged out");
  const fresh = parsePtwc(txt("ptwc.atom"), Date.parse("2026-08-12T04:00:00Z"));
  assert.equal(fresh.length, 1);
  assert.equal(fresh[0].sev, 1);
  assert.match(fresh[0].title, /TSUNAMI INFORMATION STATEMENT.*LOIHI/);
  assert.equal(fresh[0].srcUrl, "https://www.tsunami.gov/events/PHEB/2026/08/12/26224050/1/WEHW42/WEHW42.txt");
});


test("HCCDA items carry the per-layer source id", () => {
  const roads = parseHccda("roads", fx("hccda-road_closures.json"), NOW);
  assert.ok(roads.every((r) => r.source === "hccda:roads"));
});

test("bad-signal builders: essentials and digest fit their byte budgets; SMS text is one GSM-7 segment", async () => {
  const { buildEssentials, buildDigest, smsText, ESSENTIALS_BUDGET, DIGEST_BUDGET } = await import("../lib/types.ts");
  const roads = parseHccda("roads", fx("hccda-road_closures.json"), NOW);
  const shelters = parseHccda("shelters", fx("hccda-emergency_shelters.json"), NOW);
  const nws = parseNws(fx("nws-alerts-lala.json"), NOW).filter((i) => i.islands.includes("hawaii"));
  const items = [...shelters, ...nws, ...roads].sort((a, b) => b.sev - a.sev || b.issuedAt - a.issuedAt);

  const ess = buildEssentials("hawaii", items, NOW, "watch", [11, 11]);
  const essBytes = Buffer.byteLength(JSON.stringify(ess));
  assert.ok(essBytes <= ESSENTIALS_BUDGET, `essentials ${essBytes} B > ${ESSENTIALS_BUDGET}`);
  assert.equal(ess.alerts.length, 8);
  assert.equal(ess.shelters[0][0], "Naalehu Elementary School");

  const digest = buildDigest("hawaii", items, NOW, items[0].key);
  const payload = { web_push: 8030, notification: { title: digest.top[0].title, body: digest.top[0].body, navigate: "/?island=hawaii", tag: "hawaii" }, digest };
  const digBytes = Buffer.byteLength(JSON.stringify(payload));
  assert.ok(digBytes <= DIGEST_BUDGET, `digest payload ${digBytes} B > ${DIGEST_BUDGET}`);
  assert.equal(digest.top[0].key, items[0].key);
  assert.ok(digest.top.length <= 6);

  for (const i of items.slice(0, 30)) {
    const t = smsText(i);
    assert.ok(t.length <= 153, `${t.length} chars: ${t}`);
    assert.ok(/^[\x20-\x7E]+$/.test(t), `non-GSM char in: ${t}`);
  }
  assert.match(smsText({ title: "Shelter OPEN: Nāʻālehu", body: "Bring supplies — and medication…", issuedAt: Date.UTC(2026, 7, 15, 4) }), /^8\/14 6:00PM Shelter OPEN: Na'alehu Bring supplies - and medication\.\.\.$/);
});

test("HPD media releases: keyword severity and district tagging", async () => {
  const { parseHpd } = await import("../convex/parsers/feeds.ts");
  const { districtFor } = await import("../lib/places.ts");
  const now = Date.parse("2026-08-18T12:00:00Z"); // fixture spans Aug 16-20; 3-day window
  const items = parseHpd(readFileSync(new URL("../fixtures/hpd.rss", import.meta.url), "utf8"), now, (t) => { const d = districtFor(t); return d ? [d] : []; });
  assert.ok(items.length >= 5 && items.length <= 10, `${items.length} within 3 days`);
  const nine11 = items.find((i) => /911 Service Number is Non Operational/.test(i.title));
  assert.equal(nine11?.sev, 3, "911 outage is a warning");
  const crash = items.find((i) => /Two Car Crash/.test(i.title));
  assert.equal(crash?.sev, 2);
  assert.deepEqual(crash?.districts, ["Ka‘ū"], "Ocean View -> Kaʻū");
  assert.deepEqual(items.find((i) => /Nāʻālehu/.test(i.title))?.districts, ["Ka‘ū"]);
  assert.equal(districtFor("Stalled truck on Hwy 11 near Kurtistown"), "Puna");
  assert.equal(districtFor("Kailua-Kona water main break"), "North Kona");
  assert.equal(districtFor("Hawaii Island police are investigating"), undefined);
});

test("Honolulu CAD traffic: kinds, HST timestamps, short TTLs", async () => {
  const { parseHnlTraffic } = await import("../convex/parsers/feeds.ts");
  const rows = fx("hnl-traffic.json");
  const newest = rows[0]; // "08/20/2026" "12:06:59 AM"
  const now = Date.UTC(2026, 7, 20, 10, 30); // 00:30 HST Aug 20
  const items = parseHnlTraffic(rows, now);
  assert.ok(items.length > 0 && items.length < rows.length);
  assert.ok(items.every((i) => i.type === "traffic" && i.islands[0] === "oahu" && i.expiresAt! > i.issuedAt));
  assert.ok(!items.some((i) => i.fields?.category === "Traffic Complaint"), "complaints filtered out");
  const signal = items.find((i) => i.status === "signal");
  if (signal) assert.equal(signal.sev, 2);
  const first = items.find((i) => i.fields?.category === newest.type);
  if (first && newest.type in { MVC: 1, "Stalled/Hazard Veh": 1, "Traffic Incident": 1, "MVC Veh Towed": 1, "Traffic Control Device": 1 }) {
    assert.equal(first.issuedAt, Date.UTC(2026, 7, 20, 10, 6, 59), "12:06:59 AM HST = 10:06:59Z");
  }
  assert.equal(parseHnlTraffic(rows, now + 48 * 3_600_000).length, 0, "everything expires within hours");
});

test("road closures carry the closed segment as a short path; endpoints stay put; never in essentials or digest", async () => {
  const { parseHdot } = await import("../convex/parsers/feeds.ts");
  const { buildEssentials, buildDigest } = await import("../lib/types.ts");
  const { distanceNm } = await import("../lib/storm.ts");
  const { pathMiles, pathMidpoint, simplifyPath } = await import("../lib/roads.ts");
  const raw = fx("hccda-road_closures.json") as { features: { geometry: { type: string; coordinates: [number, number][] }; properties: Record<string, string | number | null> }[] };
  const roads = parseHccda("roads", raw, NOW);
  const withPath = roads.filter((r) => r.path);
  assert.ok(withPath.length >= 15, `expected most county closures to carry a path, got ${withPath.length}`);
  for (const r of withPath) {
    const orig = raw.features.find((f) => `hccda:roads:${f.properties.GlobalID}` === r.key)!.geometry.coordinates;
    assert.ok(r.path!.length <= 16 && r.path!.length >= 2, `${r.key}: ${r.path!.length} points`);
    assert.ok(r.path!.every(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon) && String(lat).split(".")[1]?.length <= 4 && String(lon).split(".")[1]?.length <= 4));
    const [a, b] = [r.path![0], r.path![r.path!.length - 1]];
    assert.ok(distanceNm(a[0], a[1], orig[0][1], orig[0][0]) * 1852 < 200, `${r.key}: start moved`);
    assert.ok(distanceNm(b[0], b[1], orig[orig.length - 1][1], orig[orig.length - 1][0]) * 1852 < 200, `${r.key}: end moved`);
  }
  const wood = roads.find((r) => /Wood Valley/.test(r.title))!;
  assert.ok(wood.path!.length >= 8 && wood.path!.length <= 16, `a 62-point road keeps only its ${wood.path!.length} most important points`);
  assert.ok(pathMiles(wood.path!) > 1 && pathMiles(wood.path!) < 15);
  assert.ok(pathMidpoint(wood.path!));
  assert.ok(roads.every((r) => "location" in (r.fields ?? {}) && "alternate" in (r.fields ?? {}) && "mileMarker" in (r.fields ?? {})));
  assert.equal(roads.find((r) => /Alternate Route/.test(r.title))?.fields?.alternate, "Detour for Highway 11 traffic OPEN to PUBLIC");
  assert.deepEqual(simplifyPath([[19.5, -155.1]]), [[19.5, -155.1]]);
  assert.deepEqual(simplifyPath([]), []);

  const lanes = parseHdot(fx("hdot-current.json"), NOW);
  assert.ok(lanes.every((l) => l.path && l.path.length <= 16 && l.path[0][0] === l.lat && l.path[0][1] === l.lon));

  const ess = JSON.stringify(buildEssentials("hawaii", roads, NOW, "normal", [1, 1]));
  const dig = JSON.stringify(buildDigest("hawaii", roads, NOW, roads[0].key));
  assert.ok(!ess.includes('"path"') && !dig.includes('"path"'));
  const snapBytes = Buffer.byteLength(JSON.stringify(roads.map((r) => r.path)));
  assert.ok(snapBytes < 8_000, `paths add ${snapBytes} B to the island snapshot`);
});
