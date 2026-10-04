// Renders every icon, splash and social image from the one mark.
//   node scripts/build-icons.mjs
// Mark-only images use sharp. Images with type use Chromium (Playwright) so they are
// set in the real Archivo, not a fallback.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { chromium } from "@playwright/test";
import { executablePath } from "./chromium.mjs";

const root = new URL("..", import.meta.url).pathname;
const out = (p) => root + p;
mkdirSync(out("public/icons"), { recursive: true });
mkdirSync(out("public/splash"), { recursive: true });
mkdirSync(out("assets"), { recursive: true });

const ASPHALT = "#16181D";
const CHALK = "#F4F4F1";
const SIGNAL = "#FFC400";

/** The mark: a thick ring broken at the upper right, a solid dot in the break. `scale` is the share of the canvas it fills. */
const markSvg = (size, scale, { bg = ASPHALT, ring = CHALK, dot = SIGNAL, radius = 0 } = {}) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="${radius}" fill="${bg}"/>
  <g transform="translate(32 32) scale(${scale}) translate(-32 -32)">
    <path d="M39.52 11.33 A22 22 0 1 0 52.67 24.48" fill="none" stroke="${ring}" stroke-width="9"/>
    <circle cx="47.56" cy="16.44" r="5.6" fill="${dot}"/>
  </g>
</svg>`;

const png = (svg, file) => sharp(Buffer.from(svg)).png().toFile(out(file));

await png(markSvg(192, 0.68), "public/icons/icon-192.png");
await png(markSvg(512, 0.68), "public/icons/icon-512.png");
// Maskable: artwork inside the 80% safe zone (the mark spans ~54% here).
await png(markSvg(512, 0.54), "public/icons/icon-maskable-512.png");
await png(markSvg(180, 0.68), "public/apple-touch-icon.png");
// Capacitor masters.
await png(markSvg(1024, 0.68), "assets/icon-only.png");
await png(markSvg(1024, 0.68), "assets/icon-foreground.png");
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: ASPHALT } })
  .png()
  .toFile(out("assets/icon-background.png"));

const splashSvg = (w, h) => {
  const m = Math.round(Math.min(w, h) * 0.28);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect width="${w}" height="${h}" fill="${ASPHALT}"/>
    <svg x="${(w - m) / 2}" y="${(h - m) / 2}" width="${m}" height="${m}" viewBox="0 0 64 64">
      <path d="M39.52 11.33 A22 22 0 1 0 52.67 24.48" fill="none" stroke="${CHALK}" stroke-width="9"/>
      <circle cx="47.56" cy="16.44" r="5.6" fill="${SIGNAL}"/>
    </svg></svg>`;
};
await png(splashSvg(2732, 2732), "assets/splash.png");
await png(splashSvg(2732, 2732), "assets/splash-dark.png");

// iOS launch images: [css width, css height, pixel ratio]
const DEVICES = [
  [440, 956, 3],
  [402, 874, 3],
  [430, 932, 3],
  [393, 852, 3],
  [428, 926, 3],
  [390, 844, 3],
  [375, 812, 3],
  [414, 896, 3],
  [414, 896, 2],
  [375, 667, 2],
];
const links = [];
for (const [w, h, r] of DEVICES) {
  const file = `splash/launch-${w * r}x${h * r}.png`;
  await png(splashSvg(w * r, h * r), `public/${file}`);
  links.push(
    `    <link rel="apple-touch-startup-image" media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)" href="/${file}" />`,
  );
}
const html = readFileSync(out("index.html"), "utf8").replace(
  /    <!-- SPLASH -->[\s\S]*?<!-- \/SPLASH -->\n|    <!-- SPLASH -->\n/,
  `    <!-- SPLASH -->\n${links.join("\n")}\n    <!-- /SPLASH -->\n`,
);
writeFileSync(out("index.html"), html);

// Social images, set in Archivo.
const font = readFileSync(out("public/fonts/archivo-latin-wdth.woff2")).toString("base64");
const social = (w, h) => `<!doctype html><html><head><style>
  @font-face { font-family: Archivo; src: url(data:font/woff2;base64,${font}) format("woff2"); font-weight: 100 900; font-stretch: 62% 125%; }
  html, body { margin: 0; width: ${w}px; height: ${h}px; font-family: Archivo; }
  body { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; }
  .b { display: flex; flex-direction: column; justify-content: flex-end; padding: 36px; font-stretch: 62%; font-weight: 800; font-size: 84px; line-height: .9; }
  .head { position: absolute; left: 56px; top: 48px; right: 56px; color: #fff; }
  .mark { display: flex; align-items: center; gap: 18px; font-stretch: 75%; font-weight: 800; font-size: 44px; color: ${CHALK}; }
  .lede { margin-top: 26px; font-stretch: 62%; font-weight: 800; font-size: 68px; line-height: .95; color: ${CHALK}; max-width: 19ch; }
  .top { position: absolute; inset: 0 0 42% 0; background: ${ASPHALT}; }
</style></head><body>
  <div class="b" style="background:#0B7A6B;color:#fff">Walk</div>
  <div class="b" style="background:#FFC400;color:#16181D">Bike</div>
  <div class="b" style="background:#5B2EFF;color:#fff">Stairs</div>
  <div class="b" style="background:#FF4B2B;color:#16181D">Run</div>
  <div class="top"></div>
  <div class="head"><div class="mark">${markSvg(56, 0.9, { bg: "none" }).replace(/<\?xml[^>]*>/, "")}CardioBrain</div>
  <div class="lede">Quick brain challenges you play while you move.</div></div>
</body></html>`;
const browser = await chromium.launch({ executablePath });
for (const [w, h, file] of [
  [1200, 630, "public/og-image.png"],
  [1200, 600, "public/twitter-card.png"],
]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.setContent(social(w, h));
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out(file) });
  await page.close();
}
await browser.close();
console.log("icons, splash and social images written");
