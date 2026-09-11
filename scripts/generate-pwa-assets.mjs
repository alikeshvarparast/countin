import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const logoPath = path.join(root, "public/logo.png");
const iconsDir = path.join(root, "public/icons");
const splashDir = path.join(root, "public/splash");
const BG = "#F4EFE8";

async function logoOnCream(size) {
  const { data, info } = await sharp(logoPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > 245 && data[i + 1] > 245 && data[i + 2] > 245) data[i + 3] = 0;
  }
  return sharp(data, { raw: info }).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
}

const splashes = [
  { file: "iphone-se.png", width: 750, height: 1334 },
  { file: "iphone-8-plus.png", width: 1242, height: 2208 },
  { file: "iphone-xr.png", width: 828, height: 1792 },
  { file: "iphone-xs-max.png", width: 1242, height: 2688 },
  { file: "iphone-12.png", width: 1170, height: 2532 },
  { file: "iphone-12-max.png", width: 1284, height: 2778 },
  { file: "iphone-14-pro.png", width: 1179, height: 2556 },
  { file: "iphone-14-pro-max.png", width: 1290, height: 2796 },
  { file: "iphone-16-pro.png", width: 1206, height: 2622 },
  { file: "iphone-16-pro-max.png", width: 1320, height: 2868 },
  { file: "ipad-11.png", width: 1668, height: 2388 },
  { file: "ipad-13.png", width: 2048, height: 2732 },
];

async function writePng(file, image) {
  await image.png({ compressionLevel: 9, palette: true }).toFile(file);
}

async function maskable(size, dest) {
  const mark = Math.round(size * 0.62);
  const logo = await logoOnCream(mark);
  await writePng(
    dest,
    sharp({
      create: { width: size, height: size, channels: 3, background: BG },
    }).composite([{ input: logo, gravity: "center" }]),
  );
}

async function splash({ file, width, height }) {
  const mark = Math.round(Math.min(width, height) * 0.22);
  const logo = await logoOnCream(mark);
  await writePng(
    path.join(splashDir, file),
    sharp({
      create: { width, height, channels: 3, background: BG },
    }).composite([{ input: logo, gravity: "center" }]),
  );
}

await mkdir(iconsDir, { recursive: true });
await mkdir(splashDir, { recursive: true });
await maskable(192, path.join(iconsDir, "icon-192-maskable.png"));
await maskable(512, path.join(iconsDir, "icon-512-maskable.png"));
for (const spec of splashes) await splash(spec);
console.log("Wrote maskable icons and splash screens.");
