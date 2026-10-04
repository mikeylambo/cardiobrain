import { expect, test } from "@playwright/test";

test.use({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  reducedMotion: "reduce"
});

async function boot(page) {
  await page.addInitScript(() => {
    localStorage.setItem("cb-onboarding", "1");
    sessionStorage.setItem("cb-test-duration-seconds", "8");
  });
  await page.goto("/");
  await expect(page.getByText("Keep moving.")).toBeVisible();
}

async function startMode(page, mode: string) {
  await page.getByRole("button", { name: "Start session" }).click();
  await expect(page.getByText("SESSION SETUP")).toBeVisible();
  if (mode === "Rhyme Rush") {
    await page.getByText("Rhyme Rush").click();
  } else {
    await page.getByRole("button", { name: mode, exact: true }).click();
  }
  await page.getByRole("button", { name: "10 MIN", exact: true }).click();
  await page.getByText("Continue to countdown").click();
  await expect(page.getByText("GO")).toBeVisible({ timeout: 6000 });
}

async function playUntilResults(page) {
  const deadline = Date.now() + 11000;
  while (Date.now() < deadline && await page.getByText("SESSION COMPLETE").count() === 0) {
    const pads = page.locator(".answer-pad:visible");
    const count = await pads.count();
    if (count > 0) {
      await pads.first().click();
    }
    await page.waitForTimeout(180);
  }
  await expect(page.getByText("SESSION COMPLETE")).toBeVisible({ timeout: 4000 });
}

test.describe("CardioBrain visual review", () => {
  test("captures first-launch onboarding", async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem("cb-onboarding"));
    await page.goto("/");
    await expect(page.getByText("One screen. One tap.")).toBeVisible();
    await page.screenshot({ path: "artifacts/onboarding-01.png", fullPage: true });
    await page.getByRole("button", { name: "Continue" }).click();
    await page.screenshot({ path: "artifacts/onboarding-02.png", fullPage: true });
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Set up a session" }).click();
  });

  test("captures every primary screen", async ({ page }) => {
    await boot(page);
    await page.screenshot({ path: "artifacts/home.png", fullPage: true });

    await page.getByRole("button", { name: "Start session" }).click();
    await expect(page.getByText("SESSION SETUP")).toBeVisible();
    await page.screenshot({ path: "artifacts/setup.png", fullPage: true });

    await page.getByText("Continue to countdown").click();
    await page.waitForTimeout(850);
    await page.screenshot({ path: "artifacts/countdown.png", fullPage: true });
    await expect(page.getByText("GO")).toBeVisible({ timeout: 6000 });
    await page.screenshot({ path: "artifacts/session-mix.png", fullPage: true });

    await page.getByRole("button", { name: /Pause session/ }).click();
    await expect(page.getByText("PAUSED")).toBeVisible();
    await page.screenshot({ path: "artifacts/pause.png", fullPage: true });

    await page.getByRole("button", { name: "End session" }).click();
    await page.getByRole("button", { name: "End & save" }).click();
    await expect(page.getByText("SESSION COMPLETE")).toBeVisible();
    await page.screenshot({ path: "artifacts/results.png", fullPage: true });

    await page.getByText("View history").click();
    await page.screenshot({ path: "artifacts/history.png", fullPage: true });
    if (await page.locator(".session-row").count()) {
      await page.locator(".session-row").first().click();
      await page.screenshot({ path: "artifacts/history-detail.png", fullPage: true });
    }

    await page.getByText("SETTINGS").click();
    await page.screenshot({ path: "artifacts/settings.png", fullPage: true });
  });

  for (const mode of ["Numbers", "Switch", "React", "Recall", "Rhyme Rush"]) {
    test(`plays ${mode} as a real short session`, async ({ page }) => {
      await boot(page);
      await startMode(page, mode);
      await expect(page.locator(".answer-pad").first()).toBeVisible({ timeout: 4000 });
      await page.screenshot({ path: `artifacts/mode-${mode.toLowerCase().replace(/[^a-z]+/g, "-")}.png`, fullPage: true });
      if (mode === "Recall") {
        const shown = page.locator(".recall-symbol .shape-glyph").first();
        await expect(shown).toBeVisible({ timeout: 3000 });
        const classes = await shown.getAttribute("class");
        const shapeClass = (classes ?? "").split(/\s+/).find((name) => name.startsWith("shape-"));
        expect(shapeClass).toBeTruthy();
        await expect(page.locator(`.answer-pad .${shapeClass}`)).toHaveCount(1);
      }
      await playUntilResults(page);
    });
  }

  test("full reset returns to first launch and clears the session history", async ({ page }) => {
    await boot(page);
    await startMode(page, "Numbers");
    await playUntilResults(page);
    await page.getByText("View history").click();
    await expect(page.locator(".session-row")).toHaveCount(1);
    await page.getByText("SETTINGS").click();
    await page.getByRole("button", { name: "Reset app" }).first().click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.getByRole("alertdialog").getByRole("button", { name: "Reset app" }).click();
    await expect(page.getByText("One screen. One tap.")).toBeVisible();
  });

  test("pause and resume survives a full short session", async ({ page }) => {
    await boot(page);
    await startMode(page, "Numbers");
    await page.locator(".answer-pad").first().click();
    await page.getByRole("button", { name: /Pause session/ }).click();
    await expect(page.getByText("PAUSED")).toBeVisible();

    await page.getByRole("button", { name: "Resume" }).click();
    await expect(page.getByText("GO")).toBeVisible({ timeout: 5000 });
    await playUntilResults(page);

    await page.getByText("View history").click();
    await expect(page.getByText("SESSIONS")).toBeVisible();
    await expect(page.locator(".session-row")).toHaveCount(1);
  });

  test("pause state survives reload and then a full short session", async ({ page }) => {
    await boot(page);
    await startMode(page, "Numbers");
    await page.locator(".answer-pad").first().click();
    await page.getByRole("button", { name: /Pause session/ }).click();
    await expect(page.getByText("PAUSED")).toBeVisible();
    await page.waitForTimeout(200);
    await page.reload();

    await expect(page.getByText("SESSION STILL OPEN")).toBeVisible();
    await page.getByText("Resume").click();
    await expect(page.getByText("GO")).toBeVisible({ timeout: 5000 });
    await playUntilResults(page);
    await page.getByText("View history").click();
    await expect(page.locator(".session-row")).toHaveCount(1);
  });

  test("mid-session interruption auto-pauses after three seconds", async ({ page }) => {
    await boot(page);
    await startMode(page, "Numbers");

    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(3200);
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await expect(page.getByText("PAUSED")).toBeVisible();
    await page.screenshot({ path: "artifacts/interruption-paused.png", fullPage: true });
  });

  test("results leads directly to the next session", async ({ page }) => {
    await boot(page);
    await startMode(page, "Numbers");
    await playUntilResults(page);
    await page.getByText("Go again").click();
    await expect(page.getByText("GO")).toBeVisible({ timeout: 6000 });
  });

  test("history survives reload", async ({ page }) => {
    await boot(page);
    await startMode(page, "Numbers");
    await playUntilResults(page);
    await page.getByText("View history").click();
    await expect(page.getByText("SESSIONS")).toBeVisible();
    await page.reload();
    await expect(page.getByText("HISTORY")).toBeVisible();
    await expect(page.locator(".session-row")).toHaveCount(1);
  });
});
