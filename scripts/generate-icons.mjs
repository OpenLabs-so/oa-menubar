// Generates every icon the app ships from code, so the repo never depends on
// a designer's lost source file: the 1024px app icon, the macOS .icns, and
// the menu bar template icon.
//
//   node scripts/generate-icons.mjs
//
// The .icns step shells out to `sips` and `iconutil` and therefore only runs
// on macOS; the PNGs are produced everywhere.

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const iconsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src-tauri", "icons");

// ------------------------------------------------------------ png encoding

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1) {
    raw[y * (1 + width * 4)] = 0; // filter: none
    rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// --------------------------------------------------------------- drawing

/** Coverage of a rounded rectangle at a pixel, with ~1px of antialiasing. */
function roundedRectCoverage(px, py, x, y, w, h, r) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const dx = Math.max(Math.abs(px - cx) - (w / 2 - r), 0);
  const dy = Math.max(Math.abs(py - cy) - (h / 2 - r), 0);
  const dist = Math.hypot(dx, dy) - r;
  return Math.min(Math.max(0.5 - dist, 0), 1);
}

function makeCanvas(size) {
  return { size, data: Buffer.alloc(size * size * 4) };
}

function paint(canvas, coverageAt, colorAt) {
  const { size, data } = canvas;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const coverage = coverageAt(x + 0.5, y + 0.5);
      if (coverage <= 0) continue;
      const [r, g, b] = colorAt(x + 0.5, y + 0.5);
      const i = (y * size + x) * 4;
      const alpha = coverage;
      const existing = data[i + 3] / 255;
      const outAlpha = alpha + existing * (1 - alpha);
      if (outAlpha === 0) continue;
      data[i] = Math.round((r * alpha + data[i] * existing * (1 - alpha)) / outAlpha);
      data[i + 1] = Math.round((g * alpha + data[i + 1] * existing * (1 - alpha)) / outAlpha);
      data[i + 2] = Math.round((b * alpha + data[i + 2] * existing * (1 - alpha)) / outAlpha);
      data[i + 3] = Math.round(outAlpha * 255);
    }
  }
}

// The three-bar mark, shared by the app icon and the tray icon.
function barsFor(size, { barWidth, gap, radius, baseline, heights }) {
  const total = barWidth * 3 + gap * 2;
  const x0 = (size - total) / 2;
  return heights.map((height, index) => ({
    x: x0 + index * (barWidth + gap),
    y: baseline - height,
    w: barWidth,
    h: height,
    r: radius,
  }));
}

// ------------------------------------------------------------- app icon

const APP = 1024;
const app = makeCanvas(APP);

// Brand-blue plate with a gentle vertical gradient, inset the way macOS
// icons are so the rounded square floats on transparency.
const inset = 100;
const plate = { x: inset, y: inset, w: APP - inset * 2, h: APP - inset * 2, r: 210 };
const top = [0x3d, 0x84, 0xf7];
const bottom = [0x1c, 0x5a, 0xd4];
paint(
  app,
  (px, py) => roundedRectCoverage(px, py, plate.x, plate.y, plate.w, plate.h, plate.r),
  (px, py) => {
    const t = Math.min(Math.max((py - plate.y) / plate.h, 0), 1);
    return top.map((channel, i) => channel + (bottom[i] - channel) * t);
  }
);

for (const bar of barsFor(APP, {
  barWidth: 118,
  gap: 58,
  radius: 40,
  baseline: 726,
  heights: [236, 460, 336],
})) {
  paint(
    app,
    (px, py) => roundedRectCoverage(px, py, bar.x, bar.y, bar.w, bar.h, bar.r),
    () => [255, 255, 255]
  );
}

mkdirSync(iconsDir, { recursive: true });
writeFileSync(join(iconsDir, "icon.png"), encodePng(APP, APP, app.data));

// ------------------------------------------------------------ tray icon

// A template image: pure black, alpha carries the shape, macOS recolors it
// for light and dark menu bars. 44px so the 22pt slot gets a 2x bitmap.
const TRAY = 44;
const tray = makeCanvas(TRAY);
for (const bar of barsFor(TRAY, {
  barWidth: 7,
  gap: 4,
  radius: 2.4,
  baseline: 35,
  heights: [13, 26, 19],
})) {
  paint(
    tray,
    (px, py) => roundedRectCoverage(px, py, bar.x, bar.y, bar.w, bar.h, bar.r),
    () => [0, 0, 0]
  );
}
writeFileSync(join(iconsDir, "tray.png"), encodePng(TRAY, TRAY, tray.data));

// ---------------------------------------------------------------- .icns

if (process.platform === "darwin") {
  const iconset = join(iconsDir, "icon.iconset");
  rmSync(iconset, { recursive: true, force: true });
  mkdirSync(iconset);
  const source = join(iconsDir, "icon.png");
  for (const [name, size] of [
    ["icon_16x16.png", 16],
    ["icon_16x16@2x.png", 32],
    ["icon_32x32.png", 32],
    ["icon_32x32@2x.png", 64],
    ["icon_128x128.png", 128],
    ["icon_128x128@2x.png", 256],
    ["icon_256x256.png", 256],
    ["icon_256x256@2x.png", 512],
    ["icon_512x512.png", 512],
    ["icon_512x512@2x.png", 1024],
  ]) {
    execFileSync("sips", ["-z", String(size), String(size), source, "--out", join(iconset, name)], {
      stdio: "ignore",
    });
  }
  execFileSync("iconutil", ["-c", "icns", iconset, "-o", join(iconsDir, "icon.icns")]);
  rmSync(iconset, { recursive: true, force: true });
}

console.log("icons written to src-tauri/icons/");
