import { describe, expect, it } from "vitest";
import { mulberry32 } from "../rng";
import { generateNumbers } from "../../modes/generate/numbers";
import { generateSwitch } from "../../modes/generate/switch";

const ctx = (i: number) => ({ activity: "bike" as const, bias: "standard" as const, seed: i % 97, trialIndex: i, modeTrialIndex: i });
const MAX_TILE_LABEL = 12;

describe("Numbers", () => {
  it("2,000 seeds x levels 1-20: one correct, no duplicates, answers fit a tile", () => {
    for (let level = 1; level <= 20; level++) {
      for (let seed = 0; seed < 2000; seed++) {
        const c = generateNumbers(level, mulberry32(seed * 3 + level), ctx(seed));
        const answer = c.data.answer as number;
        expect([2, 4]).toContain(c.options.length);
        expect(new Set(c.options.map((o) => o.id)).size).toBe(c.options.length);
        expect(new Set(c.options.map((o) => o.label)).size).toBe(c.options.length);
        expect(c.options.filter((o) => o.id === c.correctAnswer)).toHaveLength(1);
        expect(c.correctAnswer).toBe(`n${answer}`);
        for (const o of c.options) {
          expect(o.label.length).toBeGreaterThan(0);
          expect(o.label.length).toBeLessThanOrEqual(MAX_TILE_LABEL);
        }
        // The problem actually evaluates to the answer.
        const expr = c.prompt.replace(/−/g, "-").replace(/×/g, "*").replace(/÷/g, "/");
        expect(Function(`return (${expr})`)()).toBe(answer);
        expect(c.prompt.length).toBeLessThanOrEqual(16);
      }
    }
  });
});

describe("Switch", () => {
  it("2,000 seeds x levels 1-20: the answer follows the rule, never the pivot", () => {
    for (let level = 1; level <= 20; level++) {
      for (let seed = 0; seed < 2000; seed++) {
        const c = generateSwitch(level, mulberry32(seed + level * 5000), ctx(seed));
        const { rule, n, pivot } = c.data as { rule: string; n: number; pivot: number };
        expect(n).not.toBe(pivot);
        expect(c.options).toHaveLength(2);
        const expected = rule === "parity" ? (n % 2 ? "odd" : "even") : n < pivot ? "low" : "high";
        expect(c.correctAnswer).toBe(expected);
        expect(c.options.filter((o) => o.id === c.correctAnswer)).toHaveLength(1);
      }
    }
  });
});
