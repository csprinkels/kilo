#!/usr/bin/env node
/**
 * Build the site for a store release and sync it into the iOS and Android projects.
 *
 * The trap this exists to close: `.env.local` points at the DEV Convex deployment, so a plain
 * `pnpm build && npx cap sync` produces an app that looks right and reads from the wrong backend.
 * A web deploy can be fixed in two minutes; a binary in review cannot. So the production hosts
 * are set here explicitly, the same ones .github/workflows/deploy.yml uses, and the build is
 * refused if they do not survive into the bundle.
 *
 * iOS entitlements, if a build ever says "App.entitlements was modified during the build":
 * with CODE_SIGN_STYLE = Automatic, Xcode syncs the entitlements FILE against the capabilities of
 * whichever provisioning profile it resolved. A Debug build resolves a development profile, whose
 * aps-environment is "development" — so a file hardcoding "production" gets rewritten mid-build, and
 * Xcode refuses. Hence one file per configuration: App.entitlements (Debug, development) and
 * AppRelease.entitlements (Release, production), wired through CODE_SIGN_ENTITLEMENTS per config.
 * Keep both free of XML comments: any plist round-trip strips them, which is the same error again.
 * The value that actually reaches the binary comes from the profile, so Release only carries
 * "production" once it is signed with a distribution profile — which is what TestFlight export uses.
 *
 *   node scripts/native.mjs            build + sync both platforms
 *   node scripts/native.mjs ios        …then open Xcode
 *   node scripts/native.mjs android    …then open Android Studio
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * A real environment variable beats a dotenv file in Next, so passing "" here does not mean "unset" —
 * it OVERRIDES .env.local. That is how a store build shipped with no Turnstile widget while the server
 * still demanded a token: every report, vote and flag came back 429 "Please complete the verification."
 * So fall back to .env.local, the one place these live locally, instead of blanking them.
 */
const fromEnvLocal = (name) => {
  try { return (readFileSync(".env.local", "utf8").match(new RegExp(`^${name}=(.*)$`, "m"))?.[1] ?? "").trim(); }
  catch { return ""; }
};
const pick = (name) => process.env[name] || fromEnvLocal(name);

const PROD = {
  NEXT_PUBLIC_CONVEX_SITE_URL: "https://standing-ram-435.convex.site",
  NEXT_PUBLIC_CONVEX_URL: "https://standing-ram-435.convex.cloud",
  // Optional. Unset is fine: the client falls back to Convex itself for reads.
  NEXT_PUBLIC_DATA_URL: pick("NEXT_PUBLIC_DATA_URL"),
  NEXT_PUBLIC_CARTO_KEY: pick("NEXT_PUBLIC_CARTO_KEY"),
  // NOT optional: TURNSTILE_SECRET is set on the Convex side, and a build with no site key posts no
  // token, which the server answers with 429 — the whole Reports screen, flagging included.
  NEXT_PUBLIC_TURNSTILE_SITEKEY: pick("NEXT_PUBLIC_TURNSTILE_SITEKEY"),
};
if (!PROD.NEXT_PUBLIC_TURNSTILE_SITEKEY) {
  console.error("\n✗ no NEXT_PUBLIC_TURNSTILE_SITEKEY (env or .env.local). The server requires a Turnstile token:");
  console.error("  reports, votes and flags would all answer 429. Set it before building for the store.");
  process.exit(1);
}

const run = (cmd, args, env) =>
  execFileSync(cmd, args, { stdio: "inherit", env: { ...process.env, ...env } });

const target = process.argv[2];
if (target && target !== "ios" && target !== "android") {
  console.error(`unknown target ${target} — expected "ios" or "android"`);
  process.exit(1);
}

console.log("· building the site against production Convex");
run("npx", ["next", "build"], PROD);

// The same check CI runs, for the same reason: an env var that resolves empty points every
// fetch at the app's own origin, where there is no /v1, and every poll 404s.
const chunks = join("out", "_next", "static", "chunks");
const bundled = readdirSync(chunks)
  .filter((f) => f.endsWith(".js"))
  .map((f) => readFileSync(join(chunks, f), "utf8"))
  .join("");
const host = new URL(PROD.NEXT_PUBLIC_CONVEX_SITE_URL).hostname;
if (!bundled.includes(host)) {
  console.error(`\n✗ ${host} is not in the built bundle — the app would ship reading from the wrong backend.`);
  process.exit(1);
}
if (bundled.includes("abundant-dotterel-415")) {
  console.error("\n✗ the DEV Convex deployment is in the bundle. Do not ship this.");
  process.exit(1);
}
if (!bundled.includes(PROD.NEXT_PUBLIC_TURNSTILE_SITEKEY)) {
  console.error("\n✗ the Turnstile site key is not in the built bundle — the report form would ship without its");
  console.error("  widget, and the server rejects a report with no token. Do not ship this.");
  process.exit(1);
}
console.log(`✓ the bundle reads from ${host}, with the Turnstile widget`);

console.log("· syncing into ios and android");
run("npx", ["cap", "sync"]);

if (target) {
  console.log(`· opening ${target}`);
  run("npx", ["cap", "open", target]);
}
