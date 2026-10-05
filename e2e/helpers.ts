import pkg from "../package.json" with { type: "json" };
import type { Page } from "@playwright/test";

export type Activity = "walk" | "bike" | "stairs" | "run";
export type Mode = "mix" | "numbers" | "switch" | "react" | "recall" | "rhyme" | "nback" | "estimate" | "rotate";

/** Start the app in a known state: onboarded (or not), a given preset, an optional short session length. */
export const RELEASE = pkg.version.split(".").slice(0, 2).join(".");

export async function prime(page: Page, opts: { activity?: Activity; mode?: Mode; onboarded?: boolean; seconds?: number; installOffered?: boolean } = {}) {
  await page.addInitScript(
    (o) => {
      if (sessionStorage.getItem("cb-primed")) return;
      sessionStorage.setItem("cb-primed", "1");
      // Tests start caught up on release notes; the "Updated to" note has its own test.
      localStorage.setItem("cb-seen-release", o.release);
      localStorage.setItem("cb-flags", JSON.stringify({ onboarded: o.onboarded ?? true, installOffered: o.installOffered ?? true }));
      localStorage.setItem("cb-setup", JSON.stringify({ activity: o.activity ?? "walk", mode: o.mode ?? "numbers", duration: 10 }));
      if (o.seconds) sessionStorage.setItem("cb-test-duration-seconds", String(o.seconds));
    },
    { ...opts, release: RELEASE },
  );
}

/** Collect console errors and unhandled rejections; assert empty at the end of a test. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  return errors;
}

/** Tap a random enabled answer tile with a real pointerdown. Returns false if none is tappable. */
export async function tapRandomTile(page: Page): Promise<boolean> {
  const tiles = page.locator(".tile:not([disabled])");
  const n = await tiles.count();
  if (!n) return false;
  const tile = tiles.nth(Math.floor(Math.random() * n));
  const box = await tile.boundingBox({ timeout: 1000 }).catch(() => null);
  if (!box) return false;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.up();
  return true;
}

/** Seed history straight into IndexedDB, then reload so the app reads it. */
export async function seedHistory(page: Page, count = 14) {
  await page.evaluate(async (count) => {
    const modes = ["numbers", "switch", "mix", "react", "recall", "rhyme"];
    const acts = ["walk", "bike", "stairs", "run"];
    const now = Date.now();
    const history = Array.from({ length: count }, (_, i) => {
      const startedAt = now - i * 2.3 * 86400000 - 3600000;
      const accuracy = 0.7 + ((i * 37) % 25) / 100;
      const avgRt = 900 + ((i * 53) % 400);
      return {
        id: `seed-${i}`,
        activity: acts[i % 4],
        requestedMode: i % 3 === 0 ? "numbers" : modes[i % modes.length],
        durationSeconds: 600 + (i % 3) * 600,
        accuracy,
        avgRt,
        medianRt: avgRt,
        challenges: 180 + i * 7,
        bestStreak: 6 + (i % 9),
        totalScore: 20000,
        minLevel: 3,
        maxLevel: 9,
        switchCost: i % 2 ? 140 + i * 10 : null,
        startedAt,
        finishedAt: startedAt + 600000,
        trials: [],
      };
    });
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("cardiobrain");
      req.onupgradeneeded = () => req.result.createObjectStore("cardiobrain-data");
      req.onsuccess = () => {
        const tx = req.result.transaction("cardiobrain-data", "readwrite");
        tx.objectStore("cardiobrain-data").put(history, "history");
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  }, count);
  await page.reload();
}

/** Start from Home and wait out the 3-2-1. */
export async function startFromHome(page: Page) {
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.locator(".countdown").waitFor();
  await page.locator(".countdown").waitFor({ state: "detached", timeout: 15000 });
}

/** Pretend the app went to the background (or came back): flips visibilityState and fires the event. */
export async function setHidden(page: Page, hidden: boolean) {
  await page.evaluate((h) => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (h ? "hidden" : "visible") });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => h });
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);
}

/** Play for `ms` with random taps, correct and incorrect alike. */
export async function play(page: Page, ms: number) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (await page.locator(".results").count()) return;
    await tapRandomTile(page);
    await page.waitForTimeout(250 + Math.random() * 450);
  }
}

export async function pauseAndResume(page: Page) {
  await page.getByRole("button", { name: /^Pause/ }).click();
  await page.getByRole("heading", { name: "Paused." }).waitFor();
  await page.getByRole("button", { name: "Resume" }).click();
  await page.locator(".countdown").waitFor({ state: "detached", timeout: 10000 });
}

/** Answer the current challenge correctly (localhost test seam). Recall taps its sequence in order. */
export async function answerCorrectly(page: Page): Promise<boolean> {
  const answer = await page.evaluate(() => {
    const store = (
      globalThis as unknown as { __cbStore?: { getState: () => { active: { current: { correctAnswer: string } | null; presentedAt: number | null } | null } } }
    ).__cbStore;
    const a = store?.getState().active;
    return a?.current && a.presentedAt !== null ? a.current.correctAnswer : null;
  });
  if (!answer || answer === "withhold") return false;
  for (const id of answer.split(" ")) {
    const tile = page.locator(`.tile[data-answer="${id}"]:not([disabled])`);
    if (!(await tile.count())) return false;
    // The challenge can change or the session end between finding a tile and measuring it.
    const box = await tile.boundingBox({ timeout: 1000 }).catch(() => null);
    if (!box) return false;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.up();
  }
  return true;
}
