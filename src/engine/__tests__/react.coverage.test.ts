import { describe, expect, it } from "vitest";
import { mulberry32 } from "../rng";
import { reactMode } from "../../modes/react";

describe("React answer coverage", () => {
  it("always exposes every visible zone plus HOLD", () => {
    const expected = new Set(["zone-0","zone-1","zone-2","zone-3","hold"]);
    for (let level = 1; level <= 20; level += 1) {
      for (let seed = 0; seed < 80; seed += 1) {
        const challenge = reactMode.generate(
          level,
          mulberry32(seed),
          { activity: "walk", bias: "standard", seed, trialIndex: seed }
        );
        expect(new Set(challenge.options.map((option) => option.id))).toEqual(expected);
        expect(expected.has(challenge.correctAnswer)).toBe(true);
        if (challenge.data.noGo) expect(challenge.correctAnswer).toBe("hold");
        else expect(challenge.correctAnswer).toMatch(/^zone-[0-3]$/);
      }
    }
  });
});