// Run: node design/appstore/tools/render-premium.mjs
// Uses the same local Chrome renderer as render.sh; no network or packages needed.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../premium');
const chrome = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const profile = mkdtempSync(join(tmpdir(), 'kilo-screenshots-'));
const names = ['1-now', '2-weather', '3-roads', '4-tsunami', '5-storms'];

async function render(url, path, width, height) {
  rmSync(path, { force: true });
  const child = spawn(chrome, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    '--allow-file-access-from-files', '--force-device-scale-factor=1', '--force-color-profile=srgb',
    `--user-data-dir=${profile}`, '--virtual-time-budget=2000',
    `--window-size=${width},${height}`, `--screenshot=${path}`, url.href,
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  await new Promise((resolve, reject) => {
    let saved = false;
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Chrome render timed out: ' + stderr.slice(-2000)));
    }, 30000);
    child.stderr.on('data', chunk => {
      stderr = (stderr + chunk).slice(-4000);
      // Chrome can linger after export on macOS. Its write confirmation means the PNG is complete.
      if (stderr.includes('bytes written to file')) {
        saved = true;
        child.kill('SIGKILL');
      }
    });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('exit', code => {
      clearTimeout(timer);
      if (saved || code === 0) resolve();
      else reject(new Error('Chrome export failed: ' + stderr));
    });
  });
  const png = readFileSync(path);
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), width, 'Screenshot width');
  assert.equal(png.readUInt32BE(20), height, 'Screenshot height');
  assert.equal(png[25], 2, 'PNG must be RGB without alpha');
  console.log(path);
}

try {
  for (const [device, folder, width, height] of [
    ['iphone', 'iphone-6.9', 1320, 2868], ['ipad', 'ipad-13', 2064, 2752],
  ]) {
    mkdirSync(join(out, folder), { recursive: true });
    mkdirSync(resolve(out, '..', folder), { recursive: true });
    for (const name of names) {
      const url = pathToFileURL(join(here, 'premium.html'));
      url.search = new URLSearchParams({ d: device, n: name }).toString();
      await render(url, join(out, folder, name + '.png'), width, height);
      copyFileSync(join(out, folder, name + '.png'), resolve(out, '..', folder, name + '.png'));
    }
  }
  const sheet = pathToFileURL(join(here, 'premium-sheet.html'));
  await render(sheet, join(out, 'contact-sheet.png'), 2200, 1750);
  copyFileSync(join(out, 'contact-sheet.png'), resolve(out, '../contact-sheet.png'));
} finally {
  rmSync(profile, { recursive: true, force: true });
}
