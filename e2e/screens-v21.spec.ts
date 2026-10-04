// Review shots for the v2.1 features.  SHOTS_DIR=... npx playwright test e2e/screens-v21.spec.ts --project iphone-14
import { test, type Page } from "@playwright/test";
import { answerCorrectly, prime, seedHistory, startFromHome, tapRandomTile, type Activity, type Mode } from "./helpers";

const DIR = process.env.SHOTS_DIR ?? "docs/screens";
const snap = async (page: Page, name: string, settle = 450) => {
  await page.waitForTimeout(settle);
  await page.screenshot({ path: `${DIR}/${name}.png` });
};
const setPrefs = (page: Page, prefs: object) =>
  page.addInitScript((p) => {
    const cur = JSON.parse(localStorage.getItem("cb-prefs") ?? "{}");
    localStorage.setItem("cb-prefs", JSON.stringify({ ...cur, ...p }));
  }, prefs);

test.beforeEach(async ({ page: _page }, info) => test.skip(info.project.name !== "iphone-14", "shot once"));
test.use({ viewport: { width: 390, height: 844 } });

test("home, setup sheet with mix and intervals", async ({ page }) => {
  await prime(page, { activity: "bike", mode: "mix" });
  await page.goto("/");
  await seedHistory(page, 6);
  await snap(page, "v21-01-home");
  await page.getByRole("button", { name: "Change" }).click();
  await page.getByRole("radio", { name: "1/1 min" }).click();
  await snap(page, "v21-02-sheet-top", 300);
  await page.locator(".sheet").evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await snap(page, "v21-03-sheet-bottom", 300);
});

for (const [mode, activity] of [
  ["nback", "walk"],
  ["estimate", "stairs"],
  ["rotate", "run"],
] as Array<[Mode, Activity]>) {
  test(`${mode} with coach line`, async ({ page }) => {
    await prime(page, { mode, activity, seconds: 600 });
    await page.goto("/");
    await startFromHome(page);
    await snap(page, `v21-04-${mode}-coach`, 300);
    for (let i = 0; i < 4; i++) {
      await tapRandomTile(page);
      await page.waitForTimeout(1000);
    }
    await snap(page, `v21-05-${mode}`, mode === "estimate" ? 100 : 300);
  });
}

test("seated, dark, arm's length", async ({ page }) => {
  await prime(page, { mode: "numbers", activity: "still", seconds: 600 });
  await page.goto("/");
  await startFromHome(page);
  await tapRandomTile(page);
  await snap(page, "v21-06-seated", 900);
});

test("dark and arm's length", async ({ page }) => {
  await prime(page, { mode: "switch", activity: "stairs", seconds: 600 });
  await setPrefs(page, { darkSessions: true, distance: "arm" });
  await page.goto("/");
  await startFromHome(page);
  await tapRandomTile(page);
  await snap(page, "v21-07-dark-arm", 900);
});

test("interval rest card", async ({ page }) => {
  await prime(page, { mode: "numbers", activity: "run", seconds: 600 });
  await page.addInitScript(() => {
    const s = JSON.parse(localStorage.getItem("cb-setup") ?? "{}");
    localStorage.setItem("cb-setup", JSON.stringify({ ...s, intervals: "30/30", playDuring: "work" }));
  });
  await page.goto("/");
  await startFromHome(page);
  const until = Date.now() + 40000;
  while (Date.now() < until && !(await page.locator(".rest-card").count())) {
    await tapRandomTile(page);
    await page.waitForTimeout(600);
  }
  await snap(page, "v21-08-rest", 200);
});

test("results with check-ins, insights, settings", async ({ page }) => {
  await prime(page, { mode: "numbers", activity: "walk", seconds: 10 });
  await setPrefs(page, { moodCheckIn: true });
  await page.goto("/");
  await seedHistory(page, 10);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await snap(page, "v21-09-mood-before", 300);
  await page.getByRole("button", { name: "Good" }).click();
  await page.locator(".countdown").waitFor({ state: "detached" });
  for (let i = 0; i < 30 && !(await page.locator(".results").count()); i++) {
    await answerCorrectly(page);
    await page.waitForTimeout(500);
  }
  await page.locator(".results").waitFor();
  await page.getByRole("button", { name: /^7/ }).click();
  await snap(page, "v21-10-results", 1200);
  await page.locator(".results").evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await snap(page, "v21-11-results-bottom", 300);
  await page.getByRole("button", { name: "Home" }).click();
  await page.getByRole("button", { name: "Insights" }).click();
  await snap(page, "v21-12-insights");
  await page.getByRole("button", { name: "Back to Home" }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await snap(page, "v21-13-settings-top");
  await page.evaluate(() => window.scrollTo(0, 900));
  await snap(page, "v21-14-settings-mid", 300);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await snap(page, "v21-15-settings-bottom", 300);
});

test.describe("landscape", () => {
  test.use({ viewport: { width: 844, height: 390 } });
  for (const [mode, activity] of [
    ["numbers", "bike"],
    ["react", "walk"],
    ["recall", "run"],
  ] as Array<[Mode, Activity]>) {
    test(`landscape ${mode}`, async ({ page }) => {
      await prime(page, { mode, activity, seconds: 600 });
      await page.goto("/");
      await startFromHome(page);
      if (mode === "react") await page.locator(".react-cell .pop").first().waitFor();
      else if (mode === "recall") await page.locator(".tile:not([disabled])").first().waitFor({ timeout: 15000 });
      else await tapRandomTile(page);
      await snap(page, `v21-16-landscape-${mode}`, mode === "react" ? 60 : 800);
    });
  }
  test("landscape home", async ({ page }) => {
    await prime(page, { mode: "mix", activity: "stairs" });
    await page.goto("/");
    await snap(page, "v21-17-landscape-home");
  });
});
