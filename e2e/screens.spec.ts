// Screenshot review set. Writes to docs/screens/ (or SHOTS_DIR).
//   npx playwright test e2e/screens.spec.ts --project iphone-14
import { test, type Page } from "@playwright/test";
import { prime, seedHistory, startFromHome, tapRandomTile, type Activity, type Mode } from "./helpers";

const DIR = process.env.SHOTS_DIR ?? "docs/screens";
const SIZES = [
  { w: 360, h: 800 },
  { w: 390, h: 844 },
];
const ACTS: Activity[] = ["walk", "bike", "stairs", "run"];

test.beforeEach(async ({ page: _page }, info) => test.skip(info.project.name !== "iphone-14", "screens are shot once, on the iPhone 14 project"));

const snap = async (page: Page, name: string, settle = 450) => {
  await page.waitForTimeout(settle);
  await page.screenshot({ path: `${DIR}/${name}.png` });
};

for (const { w, h } of SIZES) {
  const tag = `${w}x${h}`;
  test.describe(tag, () => {
    test.use({ viewport: { width: w, height: h } });

    test(`welcome, countdown, guided, transition @ ${tag}`, async ({ page }) => {
      await prime(page, { onboarded: false });
      await page.goto("/");
      await snap(page, `${tag}-01-welcome`);
      await page.getByRole("button", { name: /Stairs/ }).click();
      await snap(page, `${tag}-02-countdown`, 1200);
      await page.locator(".countdown").waitFor({ state: "detached" });
      await snap(page, `${tag}-03-guided-first`, 700);
      // Play until the first Mix transition card (10s guided blocks).
      const until = Date.now() + 20000;
      while (Date.now() < until && !(await page.locator(".transition-card").count())) {
        await tapRandomTile(page);
        await page.waitForTimeout(500);
      }
      await snap(page, `${tag}-04-mix-transition`, 200);
    });

    test(`home, sheet, empty history @ ${tag}`, async ({ page }) => {
      await prime(page, { activity: "bike", mode: "mix" });
      await page.goto("/");
      await snap(page, `${tag}-05-home-empty-bike`);
      await page.getByRole("button", { name: "Change" }).click();
      await snap(page, `${tag}-06-setup-sheet`);
      await page.getByRole("button", { name: "Close" }).click();
      await page.getByRole("button", { name: "History" }).click();
      await snap(page, `${tag}-07-history-empty`);
    });

    test(`history, detail, settings @ ${tag}`, async ({ page }) => {
      await prime(page, { activity: "run", mode: "numbers" });
      await page.goto("/");
      await seedHistory(page);
      await snap(page, `${tag}-08-home-run`);
      await page.getByRole("button", { name: "History" }).click();
      await snap(page, `${tag}-09-history`);
      await page.locator(".session-item").first().click();
      await snap(page, `${tag}-10-session-detail`);
      await page.getByRole("button", { name: "Close" }).click();
      await page.getByRole("button", { name: "Back to Home" }).click();
      await page.getByRole("button", { name: "Settings" }).click();
      await snap(page, `${tag}-11-settings`);
    });

    const modes: Array<[Mode, Activity]> = [
      ["numbers", "walk"],
      ["switch", "bike"],
      ["react", "stairs"],
      ["recall", "run"],
      ["rhyme", "walk"],
    ];
    for (const [mode, activity] of modes) {
      test(`${mode} mid-session @ ${tag}`, async ({ page }) => {
        await prime(page, { activity, mode, seconds: 600 });
        await page.goto("/");
        await startFromHome(page);
        if (mode === "recall") {
          await snap(page, `${tag}-12-${mode}-${activity}-watch`, 900);
          await page.locator(".tile:not([disabled])").first().waitFor({ timeout: 15000 });
          await tapRandomTile(page);
          await snap(page, `${tag}-12-${mode}-${activity}-repeat`, 300);
          return;
        }
        if (mode === "react") {
          await page.locator(".react-cell .pop").first().waitFor({ timeout: 5000 });
          await snap(page, `${tag}-12-${mode}-${activity}`, 60);
          return;
        }
        // Answer a few to get past level 1 visuals, then capture.
        for (let i = 0; i < 3; i++) {
          await tapRandomTile(page);
          await page.waitForTimeout(900);
        }
        await snap(page, `${tag}-12-${mode}-${activity}`, 200);
        if (mode === "numbers") {
          await page.getByRole("button", { name: /^Pause/ }).click();
          await snap(page, `${tag}-13-paused`);
        }
      });
    }

    for (const activity of ACTS) {
      test(`results ${activity} @ ${tag}`, async ({ page }) => {
        await prime(page, { activity, mode: activity === "bike" ? "switch" : "numbers", seconds: 8 });
        await page.goto("/");
        await startFromHome(page);
        const until = Date.now() + 15000;
        while (Date.now() < until && !(await page.locator(".results").count())) {
          await tapRandomTile(page);
          await page.waitForTimeout(350);
        }
        await page.locator(".results").waitFor();
        await snap(page, `${tag}-14-results-${activity}-start`, 120);
        await snap(page, `${tag}-15-results-${activity}-end`, 1400);
      });
    }
  });
}
