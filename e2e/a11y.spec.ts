// Automated accessibility audit (axe-core, WCAG 2.2 A and AA rules) on every main screen.
// It catches structure and naming problems; a real VoiceOver and TalkBack pass on a
// device is still needed for the rest (see STORE_RELEASE.md).
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { play, prime, seedHistory, startFromHome, type Mode } from "./helpers";

const audit = async (page: Page, where: string) => {
  await page.locator("#splash").waitFor({ state: "detached" });
  await page.waitForTimeout(500);
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const problems = r.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length}) ${v.nodes[0]?.target.join(" ")}`);
  expect(problems, where).toEqual([]);
};

test.beforeEach(async ({ page: _page }, info) => test.skip(info.project.name !== "pixel-7", "audited once"));

test("welcome, home, sheet, history, insights, settings", async ({ page }) => {
  await prime(page, { onboarded: false });
  await page.goto("/");
  await audit(page, "welcome");
  await page.evaluate(() => localStorage.setItem("cb-flags", JSON.stringify({ onboarded: true, installOffered: true })));
  await page.reload();
  await seedHistory(page, 8);
  await audit(page, "home");
  await page.getByRole("button", { name: "Change" }).click();
  await audit(page, "setup sheet");
  await page.getByRole("button", { name: "Close" }).click();
  for (const [link, where] of [
    ["History", "history"],
    ["Insights", "insights"],
    ["Settings", "settings"],
  ]) {
    await page.getByRole("button", { name: link!, exact: true }).click();
    await audit(page, where!);
    await page.getByRole("button", { name: "Back to Home" }).click();
  }
});

for (const mode of ["numbers", "switch", "react", "recall", "rhyme", "nback", "estimate", "rotate"] as Mode[]) {
  test(`session: ${mode}`, async ({ page }) => {
    await prime(page, { mode, activity: "stairs", seconds: 600 });
    await page.goto("/");
    await startFromHome(page);
    await page.waitForTimeout(mode === "recall" ? 2500 : 900);
    await audit(page, mode);
    await page.getByRole("button", { name: /^Pause/ }).click();
    await audit(page, `${mode} paused`);
  });
}

test("results", async ({ page }) => {
  await prime(page, { mode: "numbers", activity: "bike", seconds: 6 });
  await page.goto("/");
  await startFromHome(page);
  await play(page, 9000);
  await page.locator(".results").waitFor();
  await page.waitForTimeout(1300);
  await audit(page, "results");
});
