import { expect, test } from "@playwright/test";
import { pauseAndResume, play, prime, setHidden, startFromHome, watchErrors } from "./helpers";

test("first launch: welcome to the first challenge in under 15 seconds, then results and Home", async ({ page }) => {
  const errors = watchErrors(page);
  await prime(page, { onboarded: false, seconds: 10 });
  const t0 = Date.now();
  await page.goto("/");
  await page.getByRole("button", { name: /Walk/ }).click();
  await page.locator(".tile").first().waitFor();
  expect(Date.now() - t0).toBeLessThan(15000);
  await play(page, 14000);
  await page.locator(".results").waitFor();
  await expect(page.getByRole("heading", { name: "First round done." })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("button", { name: "Start", exact: true })).toBeVisible();
  // Reload: onboarding is done, so it lands on Home, with the round in history.
  await page.reload();
  await expect(page.getByRole("button", { name: "Start", exact: true })).toBeVisible();
  await expect(page.getByText(/^Last time:/)).toBeVisible();
  expect(errors).toEqual([]);
});

test("pause and resume 10 times in one session with zero console errors", async ({ page }) => {
  const errors = watchErrors(page);
  await prime(page, { mode: "mix", seconds: 600 });
  await page.goto("/");
  await startFromHome(page);
  for (let i = 0; i < 10; i++) {
    await play(page, 600);
    await pauseAndResume(page);
  }
  await play(page, 800);
  await expect(page.locator(".session")).toBeVisible();
  expect(errors).toEqual([]);
});

test("background for over 3 seconds pauses the session; a glance away does not", async ({ page }) => {
  const errors = watchErrors(page);
  await prime(page, { mode: "numbers", seconds: 600 });
  await page.goto("/");
  await startFromHome(page);
  await play(page, 1500);
  await setHidden(page, true);
  await page.waitForTimeout(1000);
  await setHidden(page, false);
  await expect(page.getByText("Paused. Your session is saved.")).toHaveCount(0);
  await setHidden(page, true);
  await page.waitForTimeout(3400);
  await setHidden(page, false);
  await expect(page.getByText("Paused. Your session is saved.")).toBeVisible();
  await page.getByRole("button", { name: "Resume" }).click();
  await page.locator(".countdown").waitFor({ state: "detached" });
  await play(page, 1500);
  expect(errors).toEqual([]);
});

test("reload mid-session offers Resume your session, and it continues", async ({ page }) => {
  const errors = watchErrors(page);
  await prime(page, { mode: "recall", seconds: 600 });
  await page.goto("/");
  await startFromHome(page);
  await play(page, 9000); // past the 5-second save
  await page.reload();
  await page.getByRole("button", { name: "Resume your session" }).click();
  await expect(page.getByText("Paused. Your session is saved.")).toBeVisible();
  await page.getByRole("button", { name: "Resume" }).click();
  await page.locator(".countdown").waitFor({ state: "detached" });
  // Saved every 5 seconds: the clock comes back where the last save left it, not at zero.
  await expect(page.locator(".clock")).not.toHaveText("0:00");
  await play(page, 2000);
  await page.getByRole("button", { name: /^Pause/ }).click();
  await page.getByRole("button", { name: "End session" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "End session" }).click();
  await page.locator(".results").waitFor();
  expect(errors).toEqual([]);
});

test("works offline after one load: reload, play Rhyme, open History", async ({ page, context }) => {
  const errors = watchErrors(page);
  await prime(page, { mode: "rhyme", seconds: 6 });
  await page.goto("/");
  // One load installs the service worker and precaches everything; the next load runs from it.
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    if (reg.active?.state !== "activated") await new Promise((r) => reg.active?.addEventListener("statechange", r));
  });
  await context.setOffline(true);
  await page.reload();
  await startFromHome(page);
  await play(page, 9000);
  await page.locator(".results").waitFor();
  await page.getByRole("button", { name: "Home" }).click();
  await page.getByRole("button", { name: "History" }).click();
  await expect(page.locator(".session-item")).toHaveCount(1);
  await context.setOffline(false);
  expect(errors.filter((e) => !/ERR_INTERNET_DISCONNECTED/.test(e))).toEqual([]);
});

test("share card renders non-empty PNGs in poster and story formats", async ({ page }) => {
  await prime(page, { mode: "numbers", seconds: 5 });
  await page.goto("/");
  await page.evaluate(() => {
    // Headless Chromium can't open a share sheet; force the download path.
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => false });
  });
  await startFromHome(page);
  await play(page, 8000);
  await page.locator(".results").waitFor();
  const { statSync, readFileSync } = await import("node:fs");
  const sizes: Record<string, [number, number]> = { Poster: [1080, 1350], Story: [1080, 1920] };
  for (const format of ["Poster", "Story"]) {
    await page.getByRole("button", { name: "Share", exact: true }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("dialog").getByRole("button", { name: format }).click();
    const path = await (await download).path();
    const buf = readFileSync(path!);
    expect(statSync(path!).size).toBeGreaterThan(20_000);
    expect(buf.subarray(1, 4).toString()).toBe("PNG");
    expect([buf.readUInt32BE(16), buf.readUInt32BE(20)]).toEqual(sizes[format]);
  }
});
