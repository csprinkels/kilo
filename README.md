# Hawaiʻi Status (working title)

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
