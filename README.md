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
| `app/page.tsx` | Island picker, severity sections, offline / stale / watch banners, expandable cards |
| `lib/data.ts` | Fetch with `If-None-Match`, last copy in localStorage, poll every 2 min + on foreground |
| `public/sw.js` | Precaches the shell and `/_next/static` chunks so the page opens with no signal |

Sources live: NWS alerts, Hawaiʻi County Civil Defense ArcGIS (shelters, roads, evacuations, hazards, schools), HDOT lane closures, HI-EMA RSS, USGS quakes (HI bbox, M2.5+), HVO volcano status, PTWC tsunami bulletins.

## Sections

| Page | Data | Cadence |
|---|---|---|
| `/` Now | per-island feed: official items + neighbor reports, push digests, essentials | 2 min |
| `/storms` | CPHC/NHC advisories → cone, timeline, per-island outlook | 2 min (re-parse on new advisory) |
| `/traffic` | Honolulu 911 dispatch (crashes, signal problems), HCCDA/HDOT closures, Waze embed on tap | 2 min |
| `/weather` | NWS obs + forecast per town, SRF surf by shore, NDBC buoys, AirNow PM2.5 | 15 min (forecast/surf/air hourly) |
| `/quakes` | USGS M2+ 7 d, M3.5+ 30 d | 5 min |
| `/volcano` | HVO HANS daily update + sections, DOH SO₂/PM2.5, webcams on tap | 15 min |
| `/tsunami` | PTWC CAP level, one-tap evacuation-zone lookup (state GIS), HI-EMA siren status | 5 min (sirens daily) |
| `/report` | neighbor reports: 3-step form, auto-hold rules, votes; moderated in the Convex dashboard (`reports` table, flip `status`) | — |

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

## Not yet (by design)

- Big Island Video News RSS (ask permission first), county CivicPlus pages (403 to bots), HECO outage map (token-gated), Everbridge/Genasys (no feed).
- Push, offline shelter/zone pack, Capacitor wrap: Phase 2. Reporters and help board: Phase 3.
- The name. `APP_NAME` in `lib/brand.ts` and `public/manifest.webmanifest` are placeholders; icons are generated squares.
