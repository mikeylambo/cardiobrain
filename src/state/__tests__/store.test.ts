import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { elapsedMs, useStore } from "../store";
import { setRhymeData } from "../../modes/generate/rhyme";

// Mix includes Rhyme; in the browser its word list is fetched, here it is read from disk.
setRhymeData(readFileSync(new URL("../../data/rhyme-words.txt", import.meta.url), "utf8"));

// Drive the store with a fake clock: performance.now() and Date.now() both advance with vi timers.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["performance", "Date", "setTimeout", "setInterval"] });
  useStore.setState({ active: null, history: [], screen: "home", progress: {}, recoverable: null, lastResult: null, error: null });
});
afterEach(() => vi.useRealTimers());

const s = () => useStore.getState();
const run = async (mode: "numbers" | "switch" | "mix" = "numbers") => {
  s().updateSetup({ activity: "walk", mode, duration: 10 });
  await s().startSession();
  s().countdownDone();
  s().markPresented();
};
const answerCorrect = () => {
  const c = s().active!.current!;
  vi.advanceTimersByTime(400);
  const out = s().answer(c.correctAnswer);
  s().advance();
  s().markPresented();
  return out;
};

describe("session store", () => {
  it("logs trials, streaks and difficulty, and ignores a second tap on the same challenge", async () => {
    await run();
    const c = s().active!.current!;
    expect(s().answer(c.correctAnswer)?.correct).toBe(true);
    expect(s().answer(c.correctAnswer)).toBeNull();
    s().advance();
    s().markPresented();
    for (let i = 0; i < 4; i++) answerCorrect();
    expect(s().active!.trials).toHaveLength(5);
    expect(s().active!.streak).toBe(5);
  });

  it("stops the clock while paused and replays the unanswered challenge on resume", async () => {
    await run();
    vi.advanceTimersByTime(2000);
    const before = s().active!.current!.id;
    s().pause();
    const at = elapsedMs(s().active);
    vi.advanceTimersByTime(60_000);
    expect(elapsedMs(s().active)).toBeCloseTo(at, 0);
    s().resume();
    expect(s().active!.phase).toBe("countdown");
    s().countdownDone();
    expect(s().active!.current!.id).toBe(before);
    expect(s().active!.presentation).toBe(1);
  });

  it("carries on after a glance away but pauses after more than 3 seconds hidden", async () => {
    await run();
    vi.advanceTimersByTime(1000);
    s().backgrounded();
    vi.advanceTimersByTime(1500);
    s().foregrounded();
    expect(s().active!.phase).toBe("running");
    s().backgrounded();
    vi.advanceTimersByTime(3500);
    s().foregrounded();
    expect(s().active!.phase).toBe("paused");
    expect(elapsedMs(s().active)).toBeLessThan(3000);
  });

  it("Mix moves to a new mode with a transition card every 75 seconds", async () => {
    await run("mix");
    const first = s().active!.currentMode;
    vi.advanceTimersByTime(75_500);
    const c = s().active!.current!;
    s().answer(c.correctAnswer);
    s().advance();
    expect(s().active!.transition).not.toBeNull();
    expect(s().active!.transition).not.toBe(first);
    s().endTransition();
    expect(s().active!.current!.mode).toBe(s().active!.transition ?? s().active!.currentMode);
  });

  it("records switch trials and finishes into history with the result", async () => {
    await run("switch");
    for (let i = 0; i < 12; i++) answerCorrect();
    expect(s().active!.trials.some((t) => t.switchTrial)).toBe(true);
    s().endSession();
    expect(s().screen).toBe("results");
    expect(s().history[0]!.challenges).toBe(12);
    expect(s().history[0]!.accuracy).toBe(1);
    expect(s().active).toBeNull();
  });

  it("an ended session with no answers goes home and saves nothing", async () => {
    await run();
    s().endSession();
    expect(s().screen).toBe("home");
    expect(s().history).toHaveLength(0);
  });
});
