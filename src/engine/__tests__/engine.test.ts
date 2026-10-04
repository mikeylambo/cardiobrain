import { describe, expect, it } from "vitest";
import { hashSeed, mulberry32, shuffle } from "../rng";
import { createDifficultyState, MAX_LEVEL, updateDifficulty, type DifficultyState } from "../difficulty";
import { challengeScore, sessionMetrics, speedFactor, streakFactor, switchCost } from "../scoring";
import { mixModeAt, MIX_MODES } from "../mix";
import { ruleAt } from "../../modes/generate/switch";
import type { TrialResult } from "../types";

describe("rng", () => {
  it("is deterministic per seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(hashSeed([1, "x"])).toBe(hashSeed([1, "x"]));
    expect(shuffle([1, 2, 3, 4], mulberry32(7)).sort()).toEqual([1, 2, 3, 4]);
  });
});

describe("difficulty", () => {
  const feed = (state: DifficultyState, n: number, correct: boolean, rt: number) => {
    let s = state;
    for (let i = 0; i < n; i++) s = updateDifficulty(s, { correct, responseMs: rt, targetRt: 1500 }, "walk", "numbers", "standard");
    return s;
  };
  it("places a new mode fast: quick correct answers climb one level each, for 12 challenges", () => {
    expect(feed(createDifficultyState(), 12, true, 300).level).toBe(12);
    expect(feed(createDifficultyState(), 12, false, 300).level).toBe(1);
    // Slow but right holds the level.
    expect(feed(createDifficultyState(), 12, true, 5000).level).toBe(1);
  });
  it("after placement, at most one level per 6 trials", () => {
    const placed = feed(createDifficultyState(), 12, true, 300);
    const s = feed(placed, 12, true, 300);
    expect(s.level).toBeGreaterThan(placed.level);
    expect(s.level).toBeLessThanOrEqual(placed.level + 2);
  });
  it("drops when accuracy falls under 60%", () => {
    const start = feed(feed(createDifficultyState(), 20, true, 300), 30, true, 300);
    const s = feed(start, 16, false, 300);
    // One change per 6 trials at most: 16 misses can cost three levels, never more.
    expect(s.level).toBeLessThan(start.level);
    expect(s.level).toBeGreaterThanOrEqual(start.level - 3);
  });
  it("never leaves 1..MAX_LEVEL", () => {
    expect(feed(createDifficultyState(), 400, true, 1).level).toBeLessThanOrEqual(MAX_LEVEL);
    expect(feed(createDifficultyState(), 400, false, 9000).level).toBeGreaterThanOrEqual(1);
  });
});

describe("scoring", () => {
  it("rewards speed smoothly and monotonically", () => {
    let last = Infinity;
    for (let rt = 100; rt <= 5000; rt += 100) {
      const f = speedFactor(rt, 1500);
      expect(f).toBeLessThanOrEqual(last);
      last = f;
    }
  });
  it("caps the streak factor at 1.5x", () => {
    expect(streakFactor(1000)).toBeLessThanOrEqual(1.5);
  });
  it("scores wrong answers at zero", () => {
    expect(challengeScore(false, 10, 100, 1000, 10, "standard")).toBe(0);
  });
  it("reports switch cost only with enough trials of each kind", () => {
    const t = (switchTrial: boolean, responseMs: number) => ({ mode: "switch", correct: true, switchTrial, responseMs }) as TrialResult;
    expect(switchCost([t(true, 900), t(false, 600)])).toBeNull();
    const trials = [t(true, 900), t(true, 1000), t(true, 1100), t(false, 600), t(false, 700), t(false, 800)];
    expect(switchCost(trials)).toBeCloseTo(300);
    expect(sessionMetrics(trials).switchCost).toBeCloseTo(300);
  });
});

describe("mix", () => {
  it("never runs the same mode twice in a row and uses every mode", () => {
    for (let seed = 0; seed < 300; seed++) {
      const seq = Array.from({ length: 25 }, (_, b) => mixModeAt(seed, b));
      for (let i = 1; i < seq.length; i++) expect(seq[i]).not.toBe(seq[i - 1]);
      expect(new Set(seq.slice(0, MIX_MODES.length)).size).toBe(MIX_MODES.length);
    }
  });
});

describe("switch schedule", () => {
  it("holds each rule for 2 to 4 trials, never strictly alternating", () => {
    for (let seed = 0; seed < 300; seed++) {
      const rules = Array.from({ length: 60 }, (_, k) => ruleAt(seed, k));
      let run = 1;
      for (let k = 1; k < rules.length; k++) {
        if (rules[k] === rules[k - 1]) run++;
        else {
          expect(run).toBeGreaterThanOrEqual(2);
          expect(run).toBeLessThanOrEqual(4);
          run = 1;
        }
      }
    }
  });
});
