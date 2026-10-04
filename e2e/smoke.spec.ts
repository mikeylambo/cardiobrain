import { expect, test, type Page } from "@playwright/test";

const SHOTS = process.env.SHOTS_DIR;
const shot = async (page: Page, name: string) => {
  if (!SHOTS) return;
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
};

test("first look", async ({ page }, info) => {
  test.skip(info.project.name !== "iphone-14");
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto("/");
  await page.getByRole("button", { name: /Bike/ }).waitFor();
  await shot(page, "01-welcome");
  await page.getByRole("button", { name: /Bike/ }).click();
  await page.waitForTimeout(900);
  await shot(page, "02-countdown");
  await page.waitForTimeout(2600);
  await shot(page, "03-session");
  for (let i = 0; i < 8; i++) {
    const tile = page.locator(".tile:not([disabled])").first();
    if (await tile.count()) await tile.dispatchEvent("pointerdown", { button: 0 });
    await page.waitForTimeout(i === 3 ? 60 : 900);
    if (i === 3) await shot(page, "04-feedback");
  }
  await shot(page, "05-later");
  await page.waitForTimeout(25000);
  await shot(page, "06-results");
  await page.waitForTimeout(1500);
  await shot(page, "07-results-end");
  await page.getByRole("button", { name: "Continue" }).click();
  await shot(page, "08-home");
  await page.getByRole("button", { name: "Change" }).click();
  await shot(page, "09-sheet");
  expect(errors).toEqual([]);
});
