import { describe, expect, it } from "vitest";
import { easeOffset, easePhase } from "../session";
import { responseStats, sessionMetrics } from "../scoring";
import { modeBreakdown } from "../insights";
import { migrateHistory } from "../../storage";
import { secs } from "../../ui/copy";
import type { SessionResult, TrialResult } from "../types";

const trial = (correct: boolean, responseMs: number, mode: TrialResult["mode"] = "numbers"): TrialResult => ({
  id: String(Math.random()),
  challengeId: "c",
  mode,
  level: 3,
  answerId: "a",
  correctAnswer: "a",
  correct,
  responseMs,
  score: 0,
  streak: 0,
  timestamp: 0,
});

describe("warm-up and cool-down", () => {
  it("eases timed sessions in two steps, then out by one", () => {
    expect(easeOffset(0, 600)).toBe(2);
    expect(easeOffset(19_999, 600)).toBe(2);
    expect(easeOffset(20_000, 600)).toBe(1);
    expect(easeOffset(45_000, 600)).toBe(0);
    expect(easeOffset(300_000, 600)).toBe(0);
    expect(easeOffset(556_000, 600)).toBe(1);
    expect(easePhase(10_000, 600)).toBe("warm-up");
    expect(easePhase(580_000, 600)).toBe("cool-down");
    expect(easePhase(200_000, 600)).toBeNull();
  });
  it("leaves short sessions alone and only warms up open ones", () => {
    expect(easeOffset(0, 60)).toBe(0);
    expect(easeOffset(0, 299)).toBe(0);
    expect(easeOffset(0, 300)).toBe(2);
    expect(easeOffset(0, null)).toBe(2);
    expect(easeOffset(10_000_000, null)).toBe(0);
  });
});

describe("response time counts correct answers", () => {
  it("ignores fast wrong guesses", () => {
    const trials = [trial(true, 1000), trial(true, 1200), trial(false, 200), trial(false, 100)];
    expect(responseStats(trials).avgRt).toBe(1100);
    expect(sessionMetrics(trials).rtBasis).toBe("correct");
  });
  it("falls back to every answer when none were right", () => {
    expect(responseStats([trial(false, 400), trial(false, 600)]).avgRt).toBe(500);
  });
  it("skips withheld no-gos (zero time)", () => {
    expect(responseStats([trial(true, 0), trial(true, 800)]).avgRt).toBe(800);
  });
  it("applies to the per-mode breakdown", () => {
    const r = { trials: [trial(true, 900), trial(true, 1100), trial(false, 100)] } as SessionResult;
    expect(modeBreakdown(r)[0]!.avgRt).toBe(1000);
  });
  it("recomputes older sessions once, and leaves ones without trials as they were", () => {
    const old = { id: "a", avgRt: 500, medianRt: 500, trials: [trial(true, 1000), trial(false, 0.1)] } as SessionResult;
    const bare = { id: "b", avgRt: 700, medianRt: 700, trials: [] as TrialResult[] } as SessionResult;
    const [m, b] = migrateHistory([old, bare]);
    expect(m!.avgRt).toBe(1000);
    expect(m!.rtBasis).toBe("correct");
    expect(b!.avgRt).toBe(700);
    expect(migrateHistory([m!])[0]).toBe(m);
  });
  it("shows hundredths under a second", () => {
    expect(secs(842)).toBe("0.84s");
    expect(secs(996)).toBe("1.0s");
    expect(secs(1340)).toBe("1.3s");
    expect(secs(0)).toBe("0.0s");
  });
});
