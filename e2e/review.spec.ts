// Layout and accessibility floor, checked on every main screen at 360px wide:
// no horizontal scroll, every control at least 48px, answer tiles at least 96px,
// every button named, and the stimulus on one line.
import { expect, test, type Page } from "@playwright/test";
import { play, prime, seedHistory, startFromHome, type Mode } from "./helpers";

test.use({ viewport: { width: 360, height: 800 } });

/** Layout floor. Retried briefly, so a word mid-fit (FitText settles over a frame or two) isn't flagged; anything lasting is. */
async function checkFloor(page: Page, where: string) {
  await expect.poll(() => floorReport(page), { message: where, timeout: 2000 }).toEqual([]);
}

async function floorReport(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    if (document.documentElement.scrollWidth > window.innerWidth + 1) out.push(`horizontal scroll: ${document.documentElement.scrollWidth}px`);
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("button, a[href], [role=radio], [role=switch]"))) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const name = el.getAttribute("aria-label") || el.textContent?.trim();
      if (!name) out.push(`unnamed control: ${el.outerHTML.slice(0, 80)}`);
      // Inline text links inside a sentence are exempt from the size floor (WCAG 2.5.8 inline exception).
      if (el.tagName === "A" && el.closest("p")) continue;
      if (r.height < 47.5) out.push(`small target (${Math.round(r.width)}x${Math.round(r.height)}): ${name}`);
      if (el.classList.contains("tile") && r.height < 95.5) out.push(`tile under 96px: ${name}`);
    }
    for (const s of Array.from(document.querySelectorAll<HTMLElement>(".stimulus"))) {
      if (s.getBoundingClientRect().height > parseFloat(getComputedStyle(s).fontSize) * 1.6) out.push(`stimulus wraps: ${s.textContent}`);
      const box = s.parentElement!.getBoundingClientRect();
      if (s.getBoundingClientRect().right > box.right + 1) out.push(`stimulus clipped: ${s.textContent}`);
    }
    return out;
  });
}

test("home, setup sheet, history, settings", async ({ page }, info) => {
  test.skip(info.project.name !== "pixel-7");
  await prime(page, { activity: "stairs", mode: "mix" });
  await page.goto("/");
  await seedHistory(page);
  await checkFloor(page, "home");
  await page.getByRole("button", { name: "Change" }).click();
  await checkFloor(page, "setup sheet");
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "History" }).click();
  await checkFloor(page, "history");
  await page.getByRole("button", { name: "Back to Home" }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await checkFloor(page, "settings");
});

test("welcome", async ({ page }, info) => {
  test.skip(info.project.name !== "pixel-7");
  await prime(page, { onboarded: false });
  await page.goto("/");
  await checkFloor(page, "welcome");
});

for (const mode of ["numbers", "switch", "react", "recall", "rhyme", "nback", "estimate", "rotate"] as Mode[]) {
  test(`session: ${mode}`, async ({ page }, info) => {
    test.skip(info.project.name !== "pixel-7");
    await prime(page, { mode, seconds: 600 });
    await page.goto("/");
    await startFromHome(page);
    await page.waitForTimeout(mode === "recall" ? 2500 : 1200);
    await checkFloor(page, mode);
    await page.getByRole("button", { name: /^Pause/ }).click();
    await checkFloor(page, `${mode} paused`);
  });
}

test("results, with text at 200%", async ({ page }, info) => {
  test.skip(info.project.name !== "pixel-7");
  await prime(page, { mode: "numbers", seconds: 4 });
  await page.goto("/");
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await startFromHome(page);
  await play(page, 8000);
  await page.locator(".results").waitFor({ timeout: 15000 });
  await page.waitForTimeout(1500);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);
});

test.describe("landscape phone", () => {
  test.use({ viewport: { width: 800, height: 360 } });
  for (const mode of ["numbers", "react", "recall", "estimate"] as Mode[]) {
    test(`landscape session: ${mode}`, async ({ page }, info) => {
      test.skip(info.project.name !== "pixel-7");
      await prime(page, { mode, seconds: 600 });
      await page.goto("/");
      await startFromHome(page);
      await page.waitForTimeout(mode === "recall" ? 2500 : 1200);
      const r = await page.evaluate(() => {
        const tiles = Array.from(document.querySelectorAll<HTMLElement>(".tile")).map((t) => t.getBoundingClientRect());
        return {
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          offscreen: tiles.some((b) => b.bottom > innerHeight + 1 || b.right > innerWidth + 1),
          minH: Math.min(...tiles.map((b) => b.height)),
        };
      });
      expect(r.overflow).toBe(false);
      expect(r.offscreen).toBe(false);
      expect(r.minH).toBeGreaterThanOrEqual(48);
    });
  }
});

test("settings, insights and seated session meet the floor", async ({ page }, info) => {
  test.skip(info.project.name !== "pixel-7");
  await prime(page, { activity: "still", mode: "numbers", seconds: 600 });
  await page.goto("/");
  await seedHistory(page);
  await page.getByRole("button", { name: "Insights" }).click();
  await checkFloor(page, "insights");
  await page.getByRole("button", { name: "Back to Home" }).click();
  await startFromHome(page);
  await page.waitForTimeout(800);
  await checkFloor(page, "seated session");
});
