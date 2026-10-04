import { describe, expect, it } from "vitest";
import { mulberry32 } from "../rng";
import { generateRecall, recallLength, SHAPES } from "../../modes/generate/recall";

const ctx = (i: number) => ({ activity: "walk" as const, bias: "standard" as const, seed: i, trialIndex: i, modeTrialIndex: i, recent: [] });

describe("Recall is always winnable", () => {
  it("2,000 seeds x levels 1-20: every sequence can be rebuilt from its pads", () => {
    for (let level = 1; level <= 20; level++) {
      for (let seed = 0; seed < 2000; seed++) {
        const c = generateRecall(level, mulberry32(seed * 31 + level), ctx(seed));
        const sequence = c.data.sequence as string[];
        const pads = c.options.map((o) => o.id);
        expect(sequence.length).toBe(recallLength(level));
        for (const s of sequence) expect(pads).toContain(s);
        expect(new Set(pads).size).toBe(pads.length);
        expect(pads.length).toBeGreaterThanOrEqual(4);
        expect(pads.length).toBeLessThanOrEqual(SHAPES.length);
        expect(c.correctAnswer).toBe(sequence.join(" "));
        for (let i = 1; i < sequence.length; i++) expect(sequence[i]).not.toBe(sequence[i - 1]);
      }
    }
  });
});
