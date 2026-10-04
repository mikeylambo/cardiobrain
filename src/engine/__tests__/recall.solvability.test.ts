import { describe, expect, it } from "vitest";
import { mulberry32 } from "../rng";
import { recallMode, RECALL_SHAPE_IDS } from "../../modes/recall";

describe("Recall solvability", () => {
  it("includes every required sequence symbol in the answer bank", () => {
    for (let level = 1; level <= 20; level += 1) {
      for (let seed = 0; seed < 80; seed += 1) {
        const challenge = recallMode.generate(
          level,
          mulberry32(seed),
          { activity: "walk", bias: "standard", seed, trialIndex: seed }
        );
        const sequence = challenge.data.sequence as string[];
        const options = new Set(challenge.options.map((option) => option.id));

        for (const symbol of new Set(sequence)) {
          expect(options.has(symbol)).toBe(true);
        }

        expect(options.size).toBe(challenge.options.length);
        expect(challenge.options.map((option) => option.id).sort()).toEqual([...RECALL_SHAPE_IDS].sort());
      }
    }
  });
});
