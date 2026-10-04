import { describe, expect, it } from "vitest";
import { mulberry32 } from "../rng";
import { rhymeMode } from "../../modes/rhyme";

const ctx={activity:"walk" as const,bias:"standard" as const,seed:1,trialIndex:0};

describe("Rhyme Rush",()=>{
  it("generates four unique tappable choices",()=>{
    for(const level of [1,6,11,16]){
      const c=rhymeMode.generate(level,mulberry32(level),{...ctx,trialIndex:level});
      expect(c.options).toHaveLength(4);
      expect(c.options.map(o=>o.id)).toContain(c.correctAnswer);
      expect(new Set(c.options.map(o=>o.id)).size).toBe(4);
    }
  });
  it("keeps the perfect prompt distinct from the answer",()=>{
    const c=rhymeMode.generate(2,mulberry32(12),{...ctx,trialIndex:2});
    const answer=c.options.find(o=>o.id===c.correctAnswer)?.label;
    expect(answer).toBeTruthy();
    expect(c.prompt).not.toBe(answer);
  });
  it("produces a chained word at advanced level",()=>{
    const c=rhymeMode.generate(12,mulberry32(4),{...ctx,trialIndex:12});
    expect(String(c.prompt)).toContain("→");
    expect(c.correctAnswer).not.toBe("");
  });
});
