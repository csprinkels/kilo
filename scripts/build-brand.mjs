// Rasterize public/icon.svg into the web, Capacitor, iOS, and Android slots.
// Run: node scripts/build-brand.mjs
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const iconSvg = readFileSync(join(root, "public/icon.svg"), "utf8");
const markSvg = iconSvg.replace(/<rect width="512" height="512" fill="url\(#kilo-field\)"\/>/, "");

function png(svg, width) {
  return new Resvg(svg, { fitTo: { mode: "width", value: width }, font: { loadSystemFonts: false } }).render().asPng();
}

function write(rel, bytes) {
  const dest = join(root, rel);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, bytes);
  return dest;
}

function splash(bg) {
  const size = 2732;
  const icon = 640;
  const x = (size - icon) / 2;
  const r = Math.round(icon * 0.223);
  const inner = iconSvg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="${bg}"/>
    <defs><clipPath id="app-icon"><rect width="${icon}" height="${icon}" rx="${r}"/></clipPath></defs>
    <g transform="translate(${x} ${x})" clip-path="url(#app-icon)">
      <g transform="scale(${icon / 512})">${inner}</g>
    </g>
  </svg>`;
}

function roundIcon() {
  const inner = iconSvg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <defs><clipPath id="round"><circle cx="256" cy="256" r="256"/></clipPath></defs>
    <g clip-path="url(#round)">${inner}</g>
  </svg>`;
}

const solid = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#0b6b72"/></svg>`;

write("public/favicon.png", png(iconSvg, 64));
write("public/apple-touch-icon.png", png(iconSvg, 180));
write("public/icon-192.png", png(iconSvg, 192));
write("public/icon-512.png", png(iconSvg, 512));
write("assets/icon.png", png(iconSvg, 1024));
write("assets/icon-foreground.png", png(markSvg, 1024));
write("assets/icon-background.png", png(solid, 1024));
write("assets/splash.png", png(splash("#efe8dc"), 2732));
write("assets/splash-dark.png", png(splash("#141210"), 2732));

copyFileSync(join(root, "assets/icon.png"), join(root, "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"));
for (const name of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) {
  copyFileSync(join(root, "assets/splash.png"), join(root, "ios/App/App/Assets.xcassets/Splash.imageset", name));
}

const androidRes = join(root, "android/app/src/main/res");
const launcher = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const foreground = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };
const rounded = roundIcon();
for (const [density, size] of Object.entries(launcher)) {
  const dir = join(androidRes, `mipmap-${density}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "ic_launcher.png"), png(iconSvg, size));
  writeFileSync(join(dir, "ic_launcher_round.png"), png(rounded, size));
}
for (const [density, size] of Object.entries(foreground)) {
  writeFileSync(join(androidRes, `mipmap-${density}`, "ic_launcher_foreground.png"), png(markSvg, size));
}
writeFileSync(join(androidRes, "values/ic_launcher_background.xml"), `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#0B6B72</color>
</resources>
`);

const splashPng = join(root, "assets/splash.png");
for (const dir of readdirSync(androidRes)) {
  const dest = join(androidRes, dir, "splash.png");
  if (dir.startsWith("drawable") && existsSync(dest)) copyFileSync(splashPng, dest);
}

console.log("brand: icon, wordmark rasters, splash, iOS AppIcon, Android mipmaps");
