// App Store app preview: a real first round, recorded from the app and encoded to the
// 6.9-inch spec (886×1920, H.264, 30 fps, under 30 s, silent stereo AAC track).
//   npx playwright test e2e/preview.spec.ts --project iphone-14 && see store/preview/
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { test } from "@playwright/test";
import { answerCorrectly, tapRandomTile } from "./helpers";

test.use({ viewport: { width: 443, height: 960 }, deviceScaleFactor: 2, video: { mode: "on", size: { width: 443, height: 960 } } });

test("record app preview", async ({ page }, info) => {
  test.skip(info.project.name !== "iphone-14");
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("cb-primed")) {
      sessionStorage.setItem("cb-primed", "1");
      localStorage.setItem("cb-flags", JSON.stringify({ onboarded: false, installOffered: true }));
    }
  });
  await page.goto("/");
  await page.getByRole("button", { name: /Bike/ }).waitFor();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /Bike/ }).click();
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: "Start a 30-second round" }).click();
  await page.locator(".countdown").waitFor({ state: "detached" });
  for (let i = 0; i < 80 && !(await page.locator(".results").count()); i++) {
    // Mostly right, the odd slip, at a human pace.
    if (i % 7 === 5) await tapRandomTile(page);
    else await answerCorrectly(page);
    await page.waitForTimeout(650 + Math.random() * 250);
  }
  await page.locator(".results").waitFor();
  await page.waitForTimeout(3000);
  const raw = await page.video()!.path();
  await page.close();
  mkdirSync("store/preview", { recursive: true });
  // Skip the blank first frames, scale the 443×960 recording 2× to spec, cap at 29.5 s, add the silent audio track Apple expects.
  execFileSync("ffmpeg", [
    "-y",
    "-ss",
    "0.4",
    "-i",
    raw,
    "-f",
    "lavfi",
    "-i",
    "anullsrc=channel_layout=stereo:sample_rate=44100",
    "-t",
    "29.5",
    "-vf",
    "scale=886:1920:flags=lanczos,fps=30,format=yuv420p",
    "-c:v",
    "libx264",
    "-profile:v",
    "high",
    "-level",
    "4.0",
    "-b:v",
    "10M",
    "-maxrate",
    "12M",
    "-bufsize",
    "20M",
    "-c:a",
    "aac",
    "-b:a",
    "256k",
    "-shortest",
    "-movflags",
    "+faststart",
    "store/preview/app-preview-6.9in.mp4",
  ]);
});
