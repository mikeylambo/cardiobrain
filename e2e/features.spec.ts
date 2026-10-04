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
  await expect(page.getByText(/Daily #\d+ done: \d+%/)).toBeVisible();
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
  await page.getByRole("button", { name: "Settings", exact: true }).click();
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
  await page.getByRole("button", { name: "Settings", exact: true }).click();
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
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles(file!);
  await expect(page.getByText("Imported 5 sessions.")).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles(file!);
  await expect(page.getByText("Those sessions are already here. Nothing new to import.")).toBeVisible();
});

test("seated baseline then a moving session shows motion cost on Results", async ({ page }) => {
  await prime(page, { mode: "numbers", activity: "still", seconds: 10 });
  await page.goto("/");
  await startFromHome(page);
  for (const until = Date.now() + 25_000; Date.now() < until && !(await page.locator(".results").count());) {
    await answerCorrectly(page);
    await page.waitForTimeout(250);
  }
  await expect(page.getByText(/Seated baseline saved for Numbers/)).toBeVisible();
  await page.getByRole("button", { name: "Change" }).click();
  await page.getByRole("radio", { name: "Run" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Start" }).click();
  await page.locator(".countdown").waitFor({ state: "detached" });
  for (let i = 0, until = Date.now() + 25_000; Date.now() < until && !(await page.locator(".results").count()); i++) {
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

test("Try it on Insights runs a one-minute practice and returns to Insights", async ({ page }) => {
  await prime(page, { mode: "numbers", seconds: 6 });
  await page.goto("/");
  await page.getByRole("button", { name: "Insights", exact: true }).click();
  await page.getByRole("button", { name: "Try Rotate for one minute" }).click();
  await page.locator(".countdown").waitFor({ state: "detached" });
  await play(page, 10000);
  await expect(page.getByRole("heading", { name: "Practice done." })).toBeVisible();
  await expect(page.getByText("Rotate practice")).toBeVisible();
  await page.getByRole("button", { name: "Back to Insights" }).click();
  await expect(page.getByRole("heading", { name: "Insights" })).toBeVisible();
});

test("a session can be deleted from its detail sheet", async ({ page }) => {
  await prime(page, { mode: "numbers" });
  await page.goto("/");
  await seedHistory(page, 3);
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.locator(".session-item")).toHaveCount(3);
  await page.locator(".session-item").first().click();
  await page.getByRole("button", { name: "Delete this session" }).click();
  await expect(page.locator(".session-item")).toHaveCount(2);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator(".session-item")).toHaveCount(3);
  await page.locator(".session-item").first().click();
  await page.getByRole("button", { name: "Delete this session" }).click();
  await expect(page.locator(".session-item")).toHaveCount(2);
});

test("keyboard: number keys answer, Space pauses and resumes, the resume countdown can be skipped", async ({ page }) => {
  await prime(page, { mode: "numbers", seconds: 600 });
  await page.goto("/");
  await page.locator("#splash").waitFor({ state: "detached" });
  await page.keyboard.press("Enter");
  await page.locator(".countdown").waitFor({ state: "detached" });
  await page.waitForTimeout(400);
  await page.keyboard.press("1");
  await page.waitForTimeout(200);
  const trials = await page.evaluate(
    () => (globalThis as unknown as { __cbStore: { getState: () => { active: { trials: unknown[] } } } }).__cbStore.getState().active.trials.length,
  );
  expect(trials).toBe(1);
  await page.waitForTimeout(800);
  await page.keyboard.press(" ");
  await expect(page.getByText("Paused. Your session is saved.")).toBeVisible();
  await page.keyboard.press(" ");
  const t0 = Date.now();
  await page.getByRole("button", { name: "Tap to go now" }).click();
  await page.locator(".countdown").waitFor({ state: "detached" });
  expect(Date.now() - t0).toBeLessThan(1500);
});

test("the full splash plays once; the next open is quick", async ({ page }) => {
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.dataset.splash ?? "full")).toBe("full");
  await page.locator("#splash").waitFor({ state: "detached" });
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.dataset.splash)).toBe("quick");
});

test("Settings shows the version, What's new, and a problem report that includes recorded errors", async ({ page }) => {
  await prime(page);
  await page.goto("/");
  await page.locator("#splash").waitFor({ state: "detached" });
  await page.evaluate(() =>
    setTimeout(() => {
      throw new Error("boom-for-the-report");
    }),
  );
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByText(/^CardioBrain \d+\.\d+\.\d+$/)).toBeVisible();
  await page.getByRole("button", { name: "What's new" }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByText(/^Version \d/)
      .first(),
  ).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Report a problem" }).click();
  await page.getByLabel("What happened?").fill("The tiles froze");
  await page.getByText("What's included").click();
  const preview = page.locator(".report-preview");
  await expect(preview).toContainText("What happened: The tiles froze");
  await expect(preview).toContainText("boom-for-the-report");
  await expect(preview).toContainText(/Version: \d+\.\d+\.\d+/);
});

test("a 10-minute session opens with a warm-up at an easier level, and 5 minutes is offered", async ({ page }) => {
  await prime(page, { mode: "numbers", seconds: 600 });
  await page.goto("/");
  await page.locator("#splash").waitFor({ state: "detached" });
  await page.getByRole("button", { name: "Change" }).click();
  await expect(page.getByRole("radio", { name: "5 min" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await page.evaluate(() => {
    const store = (globalThis as unknown as { __cbStore: { setState: (s: object) => void } }).__cbStore;
    store.setState({ progress: { numbers: { level: 6, trialsSeen: 40, recent: [], lastChangeAt: -99 } } });
  });
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.locator(".countdown").waitFor({ state: "detached" });
  await expect(page.locator(".phase-tag")).toHaveText("Warm-up");
  const level = await page.evaluate(
    () =>
      (globalThis as unknown as { __cbStore: { getState: () => { active: { current: { level: number; eased?: boolean } } } } }).__cbStore.getState().active
        .current,
  );
  expect(level.eased).toBe(true);
  expect(level.level).toBe(4);
});

test.describe("tablet in landscape", () => {
  test.use({ viewport: { width: 1180, height: 820 }, isMobile: false, hasTouch: true });
  test("the session spreads out: challenge on the left, answers on the right", async ({ page }) => {
    await prime(page, { mode: "numbers", seconds: 600 });
    await page.goto("/");
    await page.locator("#splash").waitFor({ state: "detached" });
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await page.locator(".countdown").waitFor({ state: "detached" });
    const stage = (await page.locator(".stage").boundingBox())!;
    const tiles = (await page.locator(".tiles").boundingBox())!;
    expect(tiles.x).toBeGreaterThan(stage.x + stage.width - 1);
    expect(stage.width + tiles.width).toBeGreaterThan(900);
  });
});

test("a challenge link opens that daily, and Results says how you did against your friend", async ({ page }) => {
  await prime(page, { seconds: 6 });
  const today = await page.evaluate(() => new Date().toLocaleDateString("en-CA"));
  await page.goto(`/?daily=${today}&beat=50`);
  await page.locator(".countdown").waitFor({ state: "detached", timeout: 15_000 });
  for (let i = 0; i < 6; i++) {
    if (await page.locator(".results").count()) break;
    await tapRandomTile(page);
    await page.waitForTimeout(500);
  }
  await page.locator(".results").waitFor({ timeout: 15_000 });
  await expect(page.locator(".rival-line")).toContainText("friend's 50%");
  expect(await page.evaluate(() => localStorage.getItem("cb-challenge"))).toBeNull();
});

test("a pending challenge waits on Home and can be skipped", async ({ page }) => {
  await prime(page);
  await page.goto("/");
  const today = await page.evaluate(() => new Date().toLocaleDateString("en-CA"));
  await page.evaluate((d) => localStorage.setItem("cb-challenge", JSON.stringify({ daily: d, score: 70 })), today);
  await page.reload();
  await expect(page.getByRole("button", { name: /Beat a friend's 70% on Daily #/ })).toBeVisible();
  await page.getByRole("button", { name: "Skip the friend's challenge" }).click();
  await expect(page.getByRole("button", { name: /^Daily #/ })).toBeVisible();
});

test("Insights charts seated vs. moving, and History can reset a level", async ({ page }) => {
  await prime(page);
  await page.goto("/");
  await page.locator("#splash").waitFor({ state: "detached" });
  await page.evaluate(() => {
    const mk = (activity: string, accuracy: number, i: number) => ({
      id: `m${i}`,
      activity,
      requestedMode: "numbers",
      durationSeconds: 600,
      accuracy,
      avgRt: 900,
      medianRt: 900,
      challenges: 40,
      bestStreak: 5,
      totalScore: 0,
      minLevel: 1,
      maxLevel: 5,
      switchCost: null,
      startedAt: Date.now() - i * 3600_000,
      finishedAt: Date.now() - i * 3600_000 + 600_000,
      trials: [],
      rtBasis: "correct",
    });
    const s = (globalThis as unknown as { __cbStore: { setState: (s: object) => void } }).__cbStore;
    s.setState({
      history: [mk("walk", 0.8, 1), mk("still", 0.9, 2)],
      progress: { numbers: { level: 7, trialsSeen: 50, recent: [], lastChangeAt: -99 } },
    });
  });
  await page.getByRole("button", { name: "Insights", exact: true }).click();
  await expect(page.locator(".motion-row:not(.axis)")).toHaveCount(1);
  await expect(page.locator(".motion-diff").first()).toHaveText("−10");
  await page.getByRole("button", { name: "Back to Home" }).click();
  await page.getByRole("button", { name: "History", exact: true }).click();
  await page.getByRole("button", { name: "Reset a level" }).click();
  await page.getByRole("button", { name: "Reset Numbers" }).click();
  await expect(page.getByRole("status").filter({ hasText: "find your level again" })).toBeVisible();
  const level = await page.evaluate(
    () => (globalThis as unknown as { __cbStore: { getState: () => { progress: Record<string, unknown> } } }).__cbStore.getState().progress.numbers,
  );
  expect(level).toBeUndefined();
});

test("after an update, Home points once at what's new", async ({ page }) => {
  await prime(page);
  await page.goto("/");
  await seedHistory(page, 2);
  await page.evaluate(() => localStorage.setItem("cb-seen-release", "1.0"));
  await page.reload();
  await page.locator("#splash").waitFor({ state: "detached" });
  await expect(page.getByText(/^Updated to \d+\.\d+\./)).toBeVisible();
  await page.getByRole("button", { name: "What's new" }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByText(/^Version \d/)
      .first(),
  ).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await page.reload();
  await page.locator("#splash").waitFor({ state: "detached" });
  await expect(page.getByText(/^Updated to/)).toHaveCount(0);
});
