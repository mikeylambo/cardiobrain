// The full scripted run from the release brief: 3 minutes per mode with random taps,
// 10 pause/resume cycles, a background/foreground cycle and a reload-and-resume.
// Any console error or unhandled rejection fails the run.  npm run e2e:long
import { expect, test } from "@playwright/test";
import { pauseAndResume, play, prime, setHidden, startFromHome, watchErrors, type Mode } from "./helpers";

const MODES: Mode[] = ["numbers", "switch", "react", "recall", "rhyme", "nback", "estimate", "rotate", "mix"];
const SECONDS = Number(process.env.LONG_SECONDS ?? 180);
const SLICE = Math.round((SECONDS * 1000 * 0.45) / 10);

for (const mode of MODES) {
  test(`${mode}: 3-minute session @long`, async ({ page }) => {
    test.setTimeout(8 * 60_000);
    const errors = watchErrors(page);
    await prime(page, { mode, activity: "run", seconds: SECONDS });
    await page.goto("/");
    await startFromHome(page);
    for (let i = 0; i < 10; i++) {
      await play(page, SLICE);
      await pauseAndResume(page);
    }
    // Background past the auto-pause threshold, then come back.
    await setHidden(page, true);
    await page.waitForTimeout(3500);
    await setHidden(page, false);
    await page.getByRole("button", { name: "Resume" }).click();
    await page.locator(".countdown").waitFor({ state: "detached" });
    await play(page, 7000);
    // Crash-style reload, then resume from Home.
    await page.reload();
    await page.getByRole("button", { name: "Resume your session" }).click();
    await page.getByRole("button", { name: "Resume" }).click();
    await page.locator(".countdown").waitFor({ state: "detached" });
    await play(page, SECONDS * 1000 + 20_000);
    await expect(page.locator(".results")).toBeVisible({ timeout: 30_000 });
    const challenges = Number(await page.locator(".stat-value").nth(1).textContent());
    expect(challenges).toBeGreaterThan(20);
    expect(errors).toEqual([]);
  });
}
