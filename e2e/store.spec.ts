// Store screenshots from real app states, composed on the activity colors with a short
// headline set in Archivo.  npx playwright test e2e/store.spec.ts --project iphone-14
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { test, type Page } from "@playwright/test";
import { answerCorrectly, prime, seedHistory, startFromHome, tapRandomTile, type Activity, type Mode } from "./helpers";

const OUT = "store/screenshots";
const TARGETS = [
  { dir: "ios-6.9", w: 1320, h: 2868 },
  { dir: "ios-6.5", w: 1284, h: 2778 },
  { dir: "android-phone", w: 1080, h: 2340 },
];
const COLORS: Record<Activity, [string, string]> = {
  walk: ["#0B7A6B", "#FFFFFF"],
  bike: ["#FFC400", "#16181D"],
  stairs: ["#5B2EFF", "#FFFFFF"],
  run: ["#FF4B2B", "#16181D"],
};

interface Shot {
  name: string;
  caption: string;
  activity: Activity;
  capture: (page: Page) => Promise<void>;
}

const inSession =
  (mode: Mode, activity: Activity, taps = 2) =>
  async (page: Page) => {
    await prime(page, { mode, activity, seconds: 600 });
    await page.goto("/");
    await startFromHome(page);
    for (let i = 0; i < taps; i++) {
      await tapRandomTile(page);
      await page.waitForTimeout(900);
    }
  };

const SHOTS: Shot[] = [
  { name: "1-numbers", caption: "One glance. One tap.", activity: "walk", capture: inSession("numbers", "walk") },
  {
    name: "2-react",
    caption: "Built for mid-stride.",
    activity: "stairs",
    capture: async (page) => {
      await inSession("react", "stairs", 0)(page);
      await page.locator(".react-cell .pop").first().waitFor();
      await page.waitForTimeout(80);
    },
  },
  { name: "3-switch", caption: "The rule changes. Keep\u00a0up.", activity: "bike", capture: inSession("switch", "bike", 3) },
  { name: "4-rhyme", caption: "Train your ear, not your spelling.", activity: "run", capture: inSession("rhyme", "run", 1) },
  {
    name: "5-results",
    caption: "See yourself get sharper.",
    activity: "walk",
    capture: async (page) => {
      await prime(page, { mode: "numbers", activity: "walk", seconds: 14 });
      await page.goto("/");
      await seedHistory(page, 4);
      await startFromHome(page);
      // Mostly right, one slip: a realistic good session.
      for (let i = 0; i < 40 && !(await page.locator(".results").count()); i++) {
        if (i === 5) await tapRandomTile(page);
        else await answerCorrectly(page);
        await page.waitForTimeout(650 + Math.random() * 300);
      }
      await page.locator(".results").waitFor();
      await page.waitForTimeout(1600);
    },
  },
  {
    name: "6-home",
    caption: "Offline. No\u00a0account. Yours.",
    activity: "bike",
    capture: async (page) => {
      await prime(page, { mode: "mix", activity: "bike" });
      await page.goto("/");
      await seedHistory(page, 8);
      await page.waitForTimeout(500);
    },
  },
];

test.describe.configure({ mode: "parallel" });
test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });

for (const shot of SHOTS) {
  test(`store ${shot.name}`, async ({ page, browser }, info) => {
    test.skip(info.project.name !== "iphone-14");
    await shot.capture(page);
    const raw = (await page.screenshot()).toString("base64");
    const font = readFileSync("public/fonts/archivo-latin-wdth.woff2").toString("base64");
    const [bg, fg] = COLORS[shot.activity];
    for (const t of TARGETS) {
      mkdirSync(`${OUT}/${t.dir}`, { recursive: true });
      const ctx = await browser.newContext({ viewport: { width: t.w, height: t.h }, deviceScaleFactor: 1 });
      const p = await ctx.newPage();
      const phoneW = Math.round(t.w * 0.74);
      await p.setContent(`<!doctype html><html><head><style>
        @font-face { font-family: Archivo; src: url(data:font/woff2;base64,${font}) format("woff2"); font-weight: 100 900; font-stretch: 62% 125%; }
        html, body { margin: 0; width: ${t.w}px; height: ${t.h}px; overflow: hidden; background: ${bg}; color: ${fg}; font-family: Archivo; }
        h1 { margin: 0; padding: ${Math.round(t.h * 0.045)}px ${Math.round(t.w * 0.08)}px 0; font-stretch: 62%; font-weight: 800; font-size: ${Math.round(t.w * 0.1)}px; line-height: .95; letter-spacing: -0.01em; text-wrap: balance; }
        .phone { position: absolute; left: 50%; bottom: ${Math.round(t.h * 0.035)}px; transform: translateX(-50%); width: ${phoneW}px; border-radius: ${Math.round(phoneW * 0.11)}px; overflow: hidden; border: ${Math.round(t.w * 0.012)}px solid #16181D; background: #16181D; }
        .phone img { display: block; width: 100%; }
      </style></head><body><h1>${shot.caption}</h1><div class="phone"><img src="data:image/png;base64,${raw}"></div></body></html>`);
      await p.evaluate(() => document.fonts.ready);
      writeFileSync(`${OUT}/${t.dir}/${shot.name}.png`, await p.screenshot());
      await ctx.close();
    }
  });
}
