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
 *   node scripts/native.mjs            build + sync both platforms
 *   node scripts/native.mjs ios        …then open Xcode
 *   node scripts/native.mjs android    …then open Android Studio
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const PROD = {
  NEXT_PUBLIC_CONVEX_SITE_URL: "https://standing-ram-435.convex.site",
  NEXT_PUBLIC_CONVEX_URL: "https://standing-ram-435.convex.cloud",
  // Optional. Unset is fine: the client falls back to Convex itself for reads.
  NEXT_PUBLIC_DATA_URL: process.env.NEXT_PUBLIC_DATA_URL ?? "",
  NEXT_PUBLIC_CARTO_KEY: process.env.NEXT_PUBLIC_CARTO_KEY ?? "",
  NEXT_PUBLIC_TURNSTILE_SITEKEY: process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY ?? "",
};

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
console.log(`✓ the bundle reads from ${host}`);

console.log("· syncing into ios and android");
run("npx", ["cap", "sync"]);

if (target) {
  console.log(`· opening ${target}`);
  run("npx", ["cap", "open", target]);
}
