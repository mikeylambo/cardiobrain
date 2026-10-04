import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { mulberry32 } from "../rng";
import { buildRhyme, generateRhyme, RHYME_TYPES, setRhymeData } from "../../modes/generate/rhyme";
import { buildIndex, rhymes } from "../../modes/rhyme-engine";

const text = readFileSync(new URL("../../data/rhyme-words.txt", import.meta.url), "utf8");
const ctx = (i: number) => ({ activity: "walk" as const, bias: "standard" as const, seed: i, trialIndex: i, modeTrialIndex: i });

beforeAll(() => setRhymeData(text));

describe("rhyme engine", () => {
  const index = buildIndex(text);
  const w = (word: string) => {
    const e = index.byWord.get(word);
    if (!e) throw new Error(`missing ${word}`);
    return e;
  };
  it("hears perfect rhymes", () => {
    expect(rhymes(w("fire"), w("tire"))).toBe(true);
    expect(rhymes(w("nation"), w("station"))).toBe(true);
    expect(rhymes(w("time"), w("lifetime"))).toBe(true);
  });
  it("rejects near misses and spelling traps", () => {
    expect(rhymes(w("time"), w("line"))).toBe(false);
    expect(rhymes(w("word"), w("lord"))).toBe(false);
    expect(rhymes(w("money"), w("police"))).toBe(false);
  });
});

describe("Rhyme Rush challenges", () => {
  for (const type of RHYME_TYPES) {
    it(`${type}: 2,000 seeds, exactly one correct option and four unique options`, () => {
      for (let seed = 0; seed < 2000; seed++) {
        const level = 1 + (seed % 20);
        const built = buildRhyme(type, Math.max(level, type === "perfect" ? 1 : 8), mulberry32(seed));
        expect(built.options).toHaveLength(4);
        expect(new Set(built.options.map((o) => o.word)).size).toBe(4);
        expect(built.options.filter((o) => o === built.correct)).toHaveLength(1);
        for (const o of built.options) expect(o.word.length).toBeGreaterThan(0);
      }
    });
  }

  it("2,000 seeds x levels 1-20 through the mode generator", () => {
    for (let level = 1; level <= 20; level++) {
      for (let seed = 0; seed < 2000; seed++) {
        const c = generateRhyme(level, mulberry32(seed * 13 + level), ctx(seed));
        expect(c.options).toHaveLength(4);
        expect(new Set(c.options.map((o) => o.id)).size).toBe(4);
        expect(c.options.filter((o) => o.id === c.correctAnswer)).toHaveLength(1);
        expect(c.prompt.length).toBeGreaterThan(0);
      }
    }
  });
});
