// Dev helper: tile screenshots side by side for review.  node scripts/contact-sheet.mjs out.png a.png b.png ...
import sharp from "sharp";
const [out, ...files] = process.argv.slice(2);
const scale = Number(process.env.SCALE ?? 0.5);
const imgs = await Promise.all(
  files.map(async (f) => {
    const m = await sharp(f).metadata();
    const w = Math.round(m.width * scale);
    const h = Math.round(m.height * scale);
    return { buf: await sharp(f).resize(w, h).toBuffer(), w, h };
  }),
);
const W = imgs.reduce((a, i) => a + i.w + 12, 0);
const H = Math.max(...imgs.map((i) => i.h));
let x = 0;
const comp = imgs.map((i) => {
  const c = { input: i.buf, left: x, top: 0 };
  x += i.w + 12;
  return c;
});
await sharp({ create: { width: W, height: H, channels: 3, background: "#888888" } })
  .composite(comp)
  .png()
  .toFile(out);
