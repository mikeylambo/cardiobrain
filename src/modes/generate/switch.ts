import type { Challenge, Generator } from "../../engine/types";
import { hashSeed, mulberry32 } from "../../engine/rng";
import { targetResponseMs } from "../../engine/difficulty";

export type SwitchRule = "parity" | "size";

/**
 * The rule for the k-th Switch trial of a session. Runs last 2 to 4 trials (the rule
 * repeats 1 to 3 times, then switches), so the change cannot be predicted by counting.
 * Derived from the session seed alone, so a resumed session gets the same schedule.
 */
export function ruleAt(seed: number, k: number): SwitchRule {
  const rng = mulberry32(hashSeed([seed, "switch-schedule"]));
  let rule: SwitchRule = rng() < 0.5 ? "parity" : "size";
  let remaining = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < k; i++) {
    remaining -= 1;
    if (remaining === 0) {
      rule = rule === "parity" ? "size" : "parity";
      remaining = 2 + Math.floor(rng() * 3);
    }
  }
  return rule;
}

export const RULE_CUE: Record<SwitchRule, string> = {
  parity: "Odd or even",
  size: "Lower or higher",
};

export const generateSwitch: Generator = (level, rng, ctx): Challenge => {
  const rule = ruleAt(ctx.seed, ctx.modeTrialIndex);
  const switchTrial = ctx.modeTrialIndex > 0 && ruleAt(ctx.seed, ctx.modeTrialIndex - 1) !== rule;
  // Levels 1-9: single digits around 5. Level 10+: two digits around 50.
  const big = level >= 10;
  const pivot = big ? 50 : 5;
  let n = pivot;
  while (n === pivot) n = big ? 11 + Math.floor(rng() * 88) : 1 + Math.floor(rng() * 9);
  const options =
    rule === "parity"
      ? [
          { id: "odd", label: "Odd" },
          { id: "even", label: "Even" },
        ]
      : [
          { id: "low", label: `Under ${pivot}` },
          { id: "high", label: `Over ${pivot}` },
        ];
  const correctAnswer = rule === "parity" ? (n % 2 ? "odd" : "even") : n < pivot ? "low" : "high";
  return {
    id: `switch-${ctx.trialIndex}-${level}`,
    mode: "switch",
    level,
    cue: RULE_CUE[rule],
    prompt: String(n),
    options,
    correctAnswer,
    switchTrial,
    targetRt: targetResponseMs("switch", level, ctx.activity, ctx.bias),
    data: { rule, n, pivot },
  };
};
