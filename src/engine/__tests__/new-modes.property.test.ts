import { describe, expect, it } from "vitest";
import { mulberry32 } from "../rng";
import { generateNback, nFor, NBACK_LETTERS } from "../../modes/generate/nback";
import { generateEstimate } from "../../modes/generate/estimate";
import { generateRotate, isChiral, SHAPES, shapesFor } from "../../modes/generate/rotate";
import { intervalAt } from "../intervals";
import { dailyKey, dailyLevel, dailyModeAt, dailyModes, dailyNumber } from "../daily";
import { matchSpoken, normalizeNumbers } from "../../audio/voiceMatch";

const ctx = (i: number, recent: string[] = []) => ({ activity: "walk" as const, bias: "standard" as const, seed: i, trialIndex: i, modeTrialIndex: i, recent });

describe("N-back", () => {
  it("2,000 seeds x levels 1-20: a stream whose answers are exactly right", () => {
    for (let level = 1; level <= 20; level++) {
      const n = nFor(level);
      let recent: string[] = [];
      let matches = 0;
      for (let seed = 0; seed < 2000; seed++) {
        const c = generateNback(level, mulberry32(seed * 11 + level), ctx(seed, recent));
        const letter = c.prompt;
        expect(NBACK_LETTERS).toContain(letter);
        const back = recent.length >= n ? recent[recent.length - n] : undefined;
        expect(c.correctAnswer).toBe(back === letter ? "match" : "nomatch");
        if (c.correctAnswer === "match") matches++;
        recent = [...recent, letter].slice(-4);
      }
      expect(matches / 2000).toBeGreaterThan(0.25);
      expect(matches / 2000).toBeLessThan(0.45);
    }
  });
});

describe("Estimation", () => {
  it("2,000 seeds x levels 1-20: the exact count is an option, the others clearly apart, dots never overlap", () => {
    for (let level = 1; level <= 20; level++) {
      for (let seed = 0; seed < 2000; seed++) {
        const c = generateEstimate(level, mulberry32(seed * 7 + level), ctx(seed));
        const { count, dots } = c.data as { count: number; dots: Array<{ x: number; y: number; r: number }> };
        expect(dots.length).toBe(count);
        const values = c.options.map((o) => Number(o.label)).sort((a, b) => a - b);
        expect(new Set(values).size).toBe(4);
        expect(values).toContain(count);
        expect(c.correctAnswer).toBe(`e${count}`);
        for (const v of values) {
          expect(v).toBeGreaterThan(0);
          if (v !== count) expect(Math.abs(v - count)).toBeGreaterThanOrEqual(1);
        }
        if (seed % 50 === 0) {
          for (let i = 0; i < dots.length; i++)
            for (let j = i + 1; j < dots.length; j++) {
              const d = Math.hypot(dots[i]!.x - dots[j]!.x, dots[i]!.y - dots[j]!.y);
              expect(d).toBeGreaterThanOrEqual(dots[i]!.r * 2);
            }
        }
      }
    }
  });
});

describe("Mental rotation", () => {
  it("every shape is chiral, so same-or-mirror always has one answer", () => {
    for (const [name, cells] of Object.entries(SHAPES)) expect(isChiral(cells), name).toBe(true);
  });
  it("2,000 seeds x levels 1-20: answer matches the transform, shapes from the level's pool", () => {
    for (let level = 1; level <= 20; level++) {
      for (let seed = 0; seed < 2000; seed++) {
        const c = generateRotate(level, mulberry32(seed * 5 + level), ctx(seed));
        const { shape, mirrored } = c.data as { shape: string; mirrored: boolean };
        expect(shapesFor(level)).toContain(shape);
        expect(c.correctAnswer).toBe(mirrored ? "mirror" : "same");
      }
    }
  });
});

describe("intervals", () => {
  it("alternates work and rest and plays during the chosen bout", () => {
    expect(intervalAt(10_000, "60/60", "work")).toMatchObject({ playing: true, bout: "work" });
    expect(intervalAt(70_000, "60/60", "work")).toMatchObject({ playing: false, bout: "rest" });
    expect(intervalAt(70_000, "60/60", "rest")).toMatchObject({ playing: true, bout: "rest" });
    expect(intervalAt(250_000, "240/60", "work").bout).toBe("rest");
    expect(intervalAt(999_999, "off", "work").playing).toBe(true);
  });
});

describe("daily challenge", () => {
  it("is the same for everyone on a date and different across dates", () => {
    const k = dailyKey(new Date(2026, 9, 4));
    expect(k).toBe("2026-10-04");
    expect(dailyNumber(k)).toBe(4);
    expect(dailyModes(k)).toEqual(dailyModes("2026-10-04"));
    expect(dailyModes(k)).not.toEqual(dailyModes("2026-10-05"));
    expect(new Set(dailyModes(k)).size).toBe(6);
    expect(dailyModeAt(k, 0)).toBe(dailyModes(k)[0]);
    expect(dailyLevel(5)).toBeGreaterThan(dailyLevel(0));
  });
});

describe("voice answers", () => {
  const nums = [
    { id: "n23", label: "23" },
    { id: "n32", label: "32" },
    { id: "n-5", label: "−5" },
    { id: "n104", label: "104" },
  ];
  it("reads spoken numbers", () => {
    expect(normalizeNumbers("twenty three")).toBe("23");
    expect(normalizeNumbers("a hundred and four")).toBe("104");
    expect(normalizeNumbers("minus five")).toBe("-5");
    expect(normalizeNumbers("forty-two")).toBe("42");
    expect(matchSpoken("twenty three", nums)).toBe("n23");
    expect(matchSpoken("32", nums)).toBe("n32");
    expect(matchSpoken("one hundred four", nums)).toBe("n104");
    expect(matchSpoken("minus five", nums)).toBe("n-5");
  });
  it("matches words and aliases, and the last thing said wins", () => {
    const opts = [
      { id: "low", label: "Under 5", say: ["under", "lower"] },
      { id: "high", label: "Over 5", say: ["over", "higher"] },
    ];
    expect(matchSpoken("higher", opts)).toBe("high");
    expect(matchSpoken("under no wait over", opts)).toBe("high");
    expect(matchSpoken("banana", opts)).toBeNull();
    expect(
      matchSpoken("tire", [
        { id: "w-fire", label: "fire" },
        { id: "w-tire", label: "tire" },
      ]),
    ).toBe("w-tire");
  });
});
