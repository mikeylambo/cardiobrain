import { describe, expect, it } from "vitest";
import { mulberry32 } from "../rng";
import { generateReact, WITHHOLD, ZONES } from "../../modes/generate/react";

const ctx = (i: number) => ({ activity: "run" as const, bias: "standard" as const, seed: i, trialIndex: i, modeTrialIndex: i });

describe("React", () => {
  it("2,000 seeds x levels 1-20: one target, a tile for it, decoys elsewhere", () => {
    const seen = new Set<string>();
    for (let level = 1; level <= 20; level++) {
      for (let seed = 0; seed < 2000; seed++) {
        const c = generateReact(level, mulberry32(seed * 7 + level), ctx(seed));
        const { zone, noGo, decoy } = c.data as { zone: string; noGo: boolean; decoy: string | null };
        expect(c.options.map((o) => o.id)).toEqual([...ZONES]);
        expect(c.correctAnswer).toBe(noGo ? WITHHOLD : zone);
        expect(c.timeoutMs).toBeGreaterThan(0);
        if (decoy) expect(decoy).not.toBe(zone);
        if (level < 4) expect(noGo).toBe(false);
        seen.add(zone);
      }
    }
    expect(seen.size).toBe(4);
  });
});
