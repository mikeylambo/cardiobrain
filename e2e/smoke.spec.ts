import { expect, test } from "@playwright/test";
import { watchErrors } from "./helpers";

test("loads clean, installable, with a privacy page", async ({ page, request }) => {
  const errors = watchErrors(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Quick brain challenges you play while you move." })).toBeVisible();

  // Installability: a manifest with real PNG icons (any + maskable) and an active service worker.
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  const manifest = await (await request.get(href!)).json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.theme_color).toBe("#16181D");
  expect(manifest.categories).toEqual(["health", "fitness"]);
  const purposes = manifest.icons.map((i: { purpose: string }) => i.purpose);
  expect(purposes).toContain("any");
  expect(purposes).toContain("maskable");
  for (const icon of manifest.icons) expect((await request.get(icon.src)).headers()["content-type"]).toContain("image/png");
  const state = await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state);
  expect(["activating", "activated"]).toContain(state);

  const privacy = await request.get("/privacy.html");
  expect(await privacy.text()).toContain("CardioBrain stores your results only on your device.");
  expect(errors).toEqual([]);
});
