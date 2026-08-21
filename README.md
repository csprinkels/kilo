# Kilo — Hawaiʻi, at a glance

*Kilo* (Hawaiian): to watch, observe, forecast.

Official Hawaiʻi alerts, shelters, road closures and county notices in one offline-capable page. Read-only, no account, no ads. Plan and research: `~/.claude/plans/so-i-had-this-twinkling-crab.md`.

```
feeds ──▶ Convex cron (2 min) ──▶ items table ──▶ JSON snapshots ──▶ R2 + Cloudflare CDN ──▶ Next.js static PWA
                                                        └──▶ Convex HTTP (dev / fallback read path)
```

## Run it

```bash
pnpm install
npx convex dev            # terminal 1: pushes convex/ and tails logs
pnpm dev                  # terminal 2: http://localhost:3000 (reads from the Convex HTTP endpoint in .env.local)
pnpm test                 # parser tests against fixtures/ (real Lala-week data)
npx convex run ingest:run # trigger one ingest by hand
```

`pnpm build` writes a static site to `out/` — that folder is what Cloudflare Pages serves and what Capacitor wraps in Phase 2.

## Layout

| Path | What |
|---|---|
| `lib/types.ts` | The `Item` / `Snapshot` / `Manifest` shapes shared by backend and UI |
| `convex/parsers/*.ts` | One pure `parseX(body, now): Item[]` per feed. Add a feed = add a parser + one line in `SOURCES` |
| `convex/ingest.ts` | Fetch all sources (8 s timeout each, failures isolated), upsert, deactivate vanished rows, build per-island snapshots, mirror to R2 |
| `convex/http.ts` | `GET /v1/{island}.json`, `/v1/manifest.json` with ETag + CORS |
| `app/page.tsx` | Now: weather card, one tinted notice, topic cards (storm map inside), quiet card, push card |
| `lib/data.ts` | Fetch with `If-None-Match`, last copy in localStorage, poll every 2 min + on foreground |
| `public/sw.js` | Precaches the shell and `/_next/static` chunks so the page opens with no signal |

Sources live: NWS alerts, Hawaiʻi County Civil Defense ArcGIS (shelters, roads, evacuations, hazards, schools), HDOT lane closures, HI-EMA RSS, USGS quakes (HI bbox, M2.5+), HVO volcano status, PTWC tsunami bulletins.

## Design (who this is for)

Built for everyone in Hawaiʻi, including kūpuna and people on one bar during a storm. Every screen follows one grammar — **heading → one sentence → one picture → one action** — and two levels only (Now → a topic page; an item opens once, inline). Rules, enforced by `tests/plain.test.ts` and the Playwright sweep:

- Plain words, never agency labels: `lib/plain.ts` turns every item into *headline / what to do / how urgent* ("Roads may flood in Puna until 9 PM · Do not drive through water."). Level words are **Act now / Get ready / Heads up**. The agency's own text lives behind one "Official wording" disclosure.
- Five text styles in `rem` (Merriweather headings, Inter body 19px, nothing under 16px) so the phone's text size applies; Kilo also has its own Normal / Large / Largest in Settings.
- Every tap target ≥ 44 px; no icon-only controls; colour only in pictures and in danger/warn blocks; light and dark from the same tokens.
- One freshness sentence in the same place on every page ("Checked 3:42 PM" · "No signal. Showing what your phone saved at 2:10 PM.").
- Illustrated icons: Meteocons (MIT) for weather, a small bespoke set for topics, in `public/icons/`.
- Tabs: Now · Weather · Roads · Reports. Storms, earthquakes, the volcano and tsunami are fixed cards on Now.
- Cards on paper: a card holds one thing on Now (the weather, a shelter, one topic) and one whole list everywhere else (`.card` / `.list` / `.picture` in `globals.css`; `--card` white with a soft shadow in light, a hairline ring in dark). One tinted card per page at most; never a card inside a card (pictures inside a row use `.well`).

## Sections

| Page | Data | Cadence |
|---|---|---|
| `/` Now | first run (pick your island) · warning block · Right now weather · one row per topic | 2 min |
| `/storms` | CPHC/NHC advisories → one sentence for your island, cone map, what to do, where it will be | 2 min (re-parse on new advisory) |
| `/traffic` Roads | island map with every closed segment drawn (county + HDOT LineStrings → `item.path`; offline highway packs `public/*-roads.json` from `scripts/build-roads.mjs`; official elevation and county street basemaps from `scripts/build-map-art.mjs`), crashes/signals, neighbor reports, roadwork and Waze behind a tap. **Way around:** the county's `Alternate_Route` is matched to the named highway in the pack and drawn in the accent colour (`lib/roads.ts matchDetour`); when none is listed the page says so and offers a tap-to-call Civil Defense. Kilo never computes its own detour. **Near me:** opt-in location (never stored) sorts closures by distance. Oʻahu 911 crashes are placed by dispatch neighborhood (`lib/oahuAreas.ts`, drawn as dotted rings). County rows not edited in 24 h (shelters 12 h) say "Civil Defense has not updated this since … Check before you go." | 2 min |
| `/weather` | NWS obs + forecast per town, SRF surf by shore, NDBC buoys, AirNow PM2.5 | 15 min (forecast/surf/air hourly) |
| `/quakes` | USGS M2+ 7 d, M3.5+ 30 d; Now's quake row reads the same file so they never disagree | 5 min |
| `/volcano` | HVO HANS daily update + sections, DOH SO₂/PM2.5, webcams on tap | 15 min |
| `/tsunami` | PTWC CAP level, one-tap evacuation-zone lookup — **offline**: `public/zones/{island}.json` (state GIS polygons, ~50 m, from `scripts/build-zones.mjs`, fetched once and kept by the service worker; live layer is the fallback), HI-EMA siren status | 5 min (sirens daily) |
| `/report` Reports | neighbor reports: one-screen form, plain hold reasons, Still there / Gone; moderated in the Convex dashboard (`reports` table, flip `status`) | — |

Optional env: `TURNSTILE_SECRET` + `NEXT_PUBLIC_TURNSTILE_SITEKEY` (Cloudflare Turnstile, free) turn on bot verification for reports; `DEVICE_SALT` hashes device ids.

## Bad-signal delivery (why the app behaves the way it does on one bar)

Never put the decision behind a fetch. Signaling survives a congested cell (push sockets, SMS); cold data fetches mostly don't.
- `v1/{island}/essentials.json` (≤1.5 KB, CI-gated) is fetched first with a 30 s timeout; the 30 KB snapshot only when that was fast. A slow first fetch flips the client to low-bandwidth mode (essentials only, 5-min polls, banner). Re-polls immediately on `online` / focus / visible.
- Web Push sends the island **digest** (≤3.5 KB, CI-gated): lead item with full body + up to 4 headlines. APNs/FCM keep only one stored notification per app while a phone is unreachable, so per-item pushes would lose history. The service worker stores the digest in Cache Storage; the page renders it offline and `/?island=x&item=key` opens the item. Declarative Web Push JSON (`web_push: 8030`) so Safari 18.4+ Home Screen apps show it without running the SW.
- VAPID keys live in Convex env (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`); optional `SITE_URL` makes notification links absolute. Subscriptions: `POST /v1/push/subscribe`.
- Share = one GSM-7 SMS segment (`smsText`), so a person with signal can text an alert to someone without.
- SMS as a channel is **on hold** (cost). Capacitor/APNs digests reuse the same payload later.

## Production setup (one-time, needs your Cloudflare account)

1. **R2 bucket** (e.g. `hi-status`) → Settings → connect a custom domain (e.g. `data.yourdomain`). Create an R2 API token (Object Read & Write).
2. **Convex env vars** (`npx convex env set …` or dashboard): `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`. The next cron run starts mirroring `v1/*.json`.
3. **Cache Rule** on the data hostname: *Cache everything*, respect origin `Cache-Control`. Cloudflare does **not** cache JSON by default — without this every poll hits R2. Leave *Always Online* off (it disables `stale-if-error`). Turn on Tiered Cache.
4. **Pages project** from this repo: build `pnpm build`, output `out`, env `NEXT_PUBLIC_DATA_URL=https://data.yourdomain`. Same apex/zone as the data host so there is no CORS.
5. If the web app and data end up on different origins, add an R2 CORS policy allowing `GET` + `If-None-Match` from the site (and `capacitor://localhost`, `http://localhost` later for the native wrap).
6. `npx convex deploy` for the production Convex deployment; point Pages at its values only if you keep the Convex HTTP fallback.

Verify: `curl -sD - https://data.yourdomain/v1/manifest.json | grep -i cf-cache-status` should say `HIT` on the second request.

## The iOS and Android apps

The same static export, wrapped with Capacitor (`capacitor.config.ts`; app id `com.csprinkels.kilohawaii`, name "Kilo Hawaiʻi"). Native projects live in `ios/` and `android/`; the web bundle is copied in and never committed.

```
pnpm build && npx cap sync      # rebuild the web app and copy it into both projects
npx cap open ios                # Xcode → run on a simulator or device
npx cap open android            # Android Studio (needs the SDK + a JDK installed)
```

What differs inside the app: no service worker (the bundle is already offline; WKWebView has none), Share goes through the native sheet (`lib/native.ts`), the status bar overlays the page (`env(safe-area-inset-top)`), and links into the app navigate client-side — the local server maps every extension-less URL to the root `index.html`, so nothing may do a full page load of a deep route. Web Push does not work in the iOS app; native push (APNs/FCM) is the next step. Icons and splash screens are rendered from `public/icon.svg` into `assets/` and the native catalogs.

## Deployments

Two Convex deployments in one project. **Prod** `standing-ram-435` serves kilo-lime-eta.vercel.app (`NEXT_PUBLIC_CONVEX_SITE_URL` in Vercel's production env). **Dev** `abundant-dotterel-415` is what `npx convex dev` pushes to; nothing public reads it. Ship backend changes with `npx convex deploy --yes`; secrets are set per deployment (`npx convex env set --prod …`). Both run the same crons on their own data.

## Not yet (by design)

- Big Island Video News RSS (ask permission first), county CivicPlus pages (403 to bots), HECO outage map (token-gated), Everbridge/Genasys (no feed).
- Capacitor wrap: Phase 2. Reporters on the other islands and a help board: Phase 3.
- Switched on but not yet configured: Turnstile (set `TURNSTILE_SECRET` in Convex and `NEXT_PUBLIC_TURNSTILE_SITEKEY` in Vercel), the R2/CDN mirror (four `R2_*` vars). Until then the report form has only the honeypot and timer, and data is served straight from Convex.
- Operations: `/mod/?key=…` is the moderation page; the watchdog and held-report alerts push to whoever has tapped "Notify me" there.
- The name. `APP_NAME` in `lib/brand.ts` and `public/manifest.webmanifest` are placeholders; icons are generated squares.
