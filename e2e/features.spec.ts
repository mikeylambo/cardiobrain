// v2.1 features end to end. Speech, voice and Bluetooth are browser APIs the test
// machine lacks, so each test installs a small fake before the app loads.
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { answerCorrectly, play, prime, seedHistory, startFromHome, tapRandomTile, watchErrors, type Mode } from "./helpers";

test("daily challenge: plays, scores as Daily #N, and shows done on Home", async ({ page }) => {
  const errors = watchErrors(page);
  await prime(page, { mode: "numbers", seconds: 8 });
  await page.goto("/");
  await page.getByRole("button", { name: /^Daily #\d+/ }).click();
  await expect(page.locator(".countdown")).toContainText("Daily challenge");
  await page.locator(".countdown").waitFor({ state: "detached" });
  await play(page, 12000);
  await expect(page.getByRole("heading", { name: /^Daily #\d+ done\.$/ })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText(/Done today: \d+%/)).toBeVisible();
  expect(errors).toEqual([]);
});

test("intervals: challenges stop for recovery and come back", async ({ page }) => {
  await prime(page, { mode: "numbers", seconds: 600 });
  await page.addInitScript(() => {
    const s = JSON.parse(localStorage.getItem("cb-setup") ?? "{}");
    localStorage.setItem("cb-setup", JSON.stringify({ ...s, intervals: "30/30", playDuring: "work" }));
  });
  await page.goto("/");
  await startFromHome(page);
  await expect(page.locator(".tile").first()).toBeVisible();
  await play(page, 31000);
  await expect(page.locator(".rest-card")).toContainText("Recover");
  await expect(page.locator(".tile")).toHaveCount(0);
});

test("spoken prompts read the challenge, and eyes-free reads the answers", async ({ page }) => {
  await page.addInitScript(() => {
    const said: string[] = [];
    (window as unknown as { __said: string[] }).__said = said;
    class U {
      text: string;
      voice: unknown = null;
      lang = "";
      rate = 1;
      constructor(t: string) {
        this.text = t;
      }
    }
    Object.defineProperty(window, "SpeechSynthesisUtterance", { value: U });
    Object.defineProperty(window, "speechSynthesis", {
      value: { speak: (u: U) => said.push(u.text), cancel: () => undefined, getVoices: () => [], addEventListener: () => undefined },
    });
    localStorage.setItem("cb-prefs", JSON.stringify({ speak: true, eyesFree: true }));
  });
  await prime(page, { mode: "switch", seconds: 600 });
  await page.goto("/");
  await startFromHome(page);
  await page.waitForTimeout(500);
  const said = await page.evaluate(() => (window as unknown as { __said: string[] }).__said);
  expect(said.join(" ")).toMatch(/(Odd or even|Lower or higher)\. \d+\./);
  expect(said.join(" ")).toMatch(/Left, (Odd|Under \d+)\. Right, (Even|Over \d+)\./);
});

test("voice answers: a spoken answer counts as a tap", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    class FakeRecognition {
      continuous = false;
      interimResults = false;
      lang = "";
      onresult: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      start() {
        w.__hear = (t: string) => this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: t }], { isFinal: true })] });
      }
      stop() {}
      abort() {}
    }
    w.SpeechRecognition = FakeRecognition;
    localStorage.setItem("cb-prefs", JSON.stringify({ voiceAnswers: true }));
  });
  await prime(page, { mode: "nback", seconds: 600 });
  await page.goto("/");
  await startFromHome(page);
  await page.waitForTimeout(400);
  const want = await page.evaluate(
    () =>
      (globalThis as unknown as { __cbStore: { getState: () => { active: { current: { correctAnswer: string } } } } }).__cbStore.getState().active.current
        .correctAnswer,
  );
  await page.evaluate((w) => (window as unknown as { __hear: (t: string) => void }).__hear(w === "match" ? "yes match" : "no"), want);
  await page.waitForTimeout(100);
  const trials = await page.evaluate(
    () => (globalThis as unknown as { __cbStore: { getState: () => { active: { trials: Array<{ correct: boolean }> } } } }).__cbStore.getState().active.trials,
  );
  expect(trials).toHaveLength(1);
  expect(trials[0]!.correct).toBe(true);
});

test("heart-rate strap: connects over Bluetooth and shows live bpm in the session", async ({ page }) => {
  await page.addInitScript(() => {
    const target = new EventTarget() as EventTarget & { value?: DataView; startNotifications: () => Promise<void> };
    target.startNotifications = async () => {
      setInterval(() => {
        target.value = new DataView(new Uint8Array([0, 158]).buffer);
        target.dispatchEvent(new Event("characteristicvaluechanged"));
      }, 300);
    };
    const device = Object.assign(new EventTarget(), {
      name: "Test strap",
      gatt: { connect: async () => ({ getPrimaryService: async () => ({ getCharacteristic: async () => target }), disconnect: () => undefined }) },
    });
    Object.defineProperty(navigator, "bluetooth", { value: { requestDevice: async () => device } });
  });
  await prime(page, { mode: "numbers", seconds: 600 });
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Connect" }).click();
  await expect(page.getByText(/158 bpm now/)).toBeVisible();
  await page.getByRole("button", { name: "Back to Home" }).click();
  await startFromHome(page);
  await expect(page.locator(".hr")).toContainText("158 Z4");
});

test("start link opens straight into a session", async ({ page }) => {
  await prime(page, { mode: "numbers" });
  await page.goto("/?start=run&mode=rotate");
  await expect(page.locator(".countdown")).toContainText("Rotate");
  await expect(page.locator(".session")).toHaveAttribute("data-activity", "run");
  expect(new URL(page.url()).search).toBe("");
});

test("backup and restore round-trip", async ({ page }) => {
  await prime(page, { mode: "numbers" });
  await page.goto("/");
  await seedHistory(page, 5);
  await page.getByRole("button", { name: "Settings" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Back up (export)" }).click();
  const file = await (await download).path();
  const data = JSON.parse(readFileSync(file!, "utf8"));
  expect(data.app).toBe("CardioBrain");
  expect(data.history).toHaveLength(5);
  // Wipe, then restore on a fresh start.
  await page.getByRole("button", { name: "Delete data" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete data" }).click();
  await page.getByRole("button", { name: /Walk/ }).waitFor();
  await page.evaluate(() => localStorage.setItem("cb-flags", JSON.stringify({ onboarded: true })));
  await page.reload();
  await page.getByRole("button", { name: "Settings" }).click();
  await page.locator('input[type="file"]').setInputFiles(file!);
  await expect(page.getByText("Imported 5 sessions.")).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles(file!);
  await expect(page.getByText("Those sessions are already here. Nothing new to import.")).toBeVisible();
});

test("seated baseline then a moving session shows motion cost on Results", async ({ page }) => {
  await prime(page, { mode: "numbers", activity: "still", seconds: 10 });
  await page.goto("/");
  await startFromHome(page);
  for (let i = 0; i < 40 && !(await page.locator(".results").count()); i++) {
    await answerCorrectly(page);
    await page.waitForTimeout(250);
  }
  await expect(page.getByText(/Seated baseline saved for Numbers/)).toBeVisible();
  await page.getByRole("button", { name: "Change" }).click();
  await page.getByRole("radio", { name: "Run" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Start" }).click();
  await page.locator(".countdown").waitFor({ state: "detached" });
  for (let i = 0; i < 40 && !(await page.locator(".results").count()); i++) {
    if (i % 4 === 0) await tapRandomTile(page);
    else await answerCorrectly(page);
    await page.waitForTimeout(400);
  }
  await expect(page.getByText(/^Moving, you're .* seated and /)).toBeVisible();
});

for (const mode of ["nback", "estimate", "rotate"] as Mode[]) {
  test(`${mode}: a short session plays through clean`, async ({ page }) => {
    const errors = watchErrors(page);
    await prime(page, { mode, seconds: 15 });
    await page.goto("/");
    await startFromHome(page);
    await play(page, 20000);
    await page.locator(".results").waitFor();
    expect(Number(await page.locator(".stat-value").nth(1).textContent())).toBeGreaterThan(3);
    expect(errors).toEqual([]);
  });
}
