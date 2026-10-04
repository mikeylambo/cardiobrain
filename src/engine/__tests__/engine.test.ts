import { describe, expect, it } from "vitest";
import { mulberry32, hashSeed, shuffle } from "../rng";
import { baseScore, challengeScore, speedFactor, streakFactor } from "../scoring";
import { createDifficultyState, targetResponseMs, updateDifficulty } from "../difficulty";
import { recallMode } from "../../modes/recall";

describe("rng",()=>{
  it("is deterministic for the same seed",()=>{
    const a=mulberry32(42),b=mulberry32(42);
    expect(Array.from({length:6},()=>a())).toEqual(Array.from({length:6},()=>b()));
    expect(hashSeed(["a",1])).toBe(hashSeed(["a",1]));
  });
  it("shuffles without mutating",()=>{
    const input=[1,2,3,4];const out=shuffle(input,mulberry32(2));
    expect(input).toEqual([1,2,3,4]);expect(new Set(out)).toEqual(new Set(input));
  });
});

describe("scoring",()=>{
  it("keeps faster correct answers at least as valuable",()=>{
    const target=1000;
    expect(speedFactor(900,target)).toBeGreaterThan(speedFactor(1000,target));
    expect(challengeScore(true,5,700,target,5,"standard")).toBeGreaterThan(challengeScore(true,5,1300,target,5,"standard"));
    expect(challengeScore(false,5,600,target,5,"standard")).toBe(0);
  });
  it("caps streak multiplier",()=>expect(streakFactor(1000)).toBe(1.5));
  it("increases base score with level",()=>expect(baseScore(8)).toBeGreaterThan(baseScore(4)));
});

describe("difficulty",()=>{
  it("uses activity multipliers",()=>{
    expect(targetResponseMs("react",1,"stairs","standard")).toBeGreaterThan(targetResponseMs("react",1,"walk","standard"));
  });
  it("calibrates through levels 1 to 4",()=>{
    let state=createDifficultyState();
    for(let i=0;i<20;i++){
      state=updateDifficulty(state,{correct:true,responseMs:500,targetRt:1400},"walk","react","standard");
    }
    expect(state.level).toBe(4);
  });
  it("steps down after sustained misses",()=>{
    let state={...createDifficultyState(),level:5,trialsSeen:20,lastChangeAt:-99};
    for(let i=0;i<8;i++)state=updateDifficulty(state,{correct:false,responseMs:3000,targetRt:1000},"walk","react","standard");
    expect(state.level).toBe(4);
  });
});

describe("recall",()=>{
  it("creates a non-empty sequence and a matching answer",()=>{
    const challenge=recallMode.generate(4,mulberry32(9),{activity:"walk",bias:"standard",seed:9,trialIndex:1});
    const sequence=challenge.data.sequence as string[];
    expect(sequence.length).toBeGreaterThan(0);
    expect(challenge.correctAnswer).toBe(sequence.join("|"));
    expect(challenge.options.length).toBeGreaterThanOrEqual(2);
  });
});
