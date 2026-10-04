import type { Activity, DifficultyBias, ModeId, TrialResult } from "./types";

export const ACTIVITY_RESPONSE_MULTIPLIER: Record<Activity, number> = {
  walk: 1,
  bike: 1.1,
  stairs: 1.5,
  run: 1.3,
  still: 1,
};

const BIAS_MULTIPLIER: Record<DifficultyBias, number> = {
  gentle: 1.12,
  standard: 1,
  hard: 0.9,
};

export const MAX_LEVEL = 20;
export const PLACEMENT_TRIALS = 12;
export const PLACEMENT_CAP = 12;

export function targetResponseMs(mode: ModeId, level: number, activity: Activity, bias: DifficultyBias): number {
  const base: Record<ModeId, number> = {
    numbers: 1750,
    switch: 1600,
    react: 900,
    recall: 2400,
    rhyme: 1700,
    nback: 1500,
    estimate: 1900,
    rotate: 2300,
  };
  const normalized = Math.max(0, Math.min(19, level - 1));
  const levelCompression = Math.max(0.48, 1 - normalized * 0.028);
  return base[mode] * levelCompression * ACTIVITY_RESPONSE_MULTIPLIER[activity] * BIAS_MULTIPLIER[bias];
}

export interface DifficultyState {
  level: number;
  trialsSeen: number;
  recent: Array<{ correct: boolean; rt: number; targetRt: number }>;
  lastChangeAt: number;
}

export function createDifficultyState(): DifficultyState {
  return { level: 1, trialsSeen: 0, recent: [], lastChangeAt: -99 };
}

export function updateDifficulty(
  state: DifficultyState,
  trial: Pick<TrialResult, "correct" | "responseMs"> & { targetRt: number },
  activity: Activity,
  mode: ModeId,
  bias: DifficultyBias,
): DifficultyState {
  const recent = [
    ...state.recent,
    {
      correct: trial.correct,
      rt: trial.responseMs,
      targetRt: trial.targetRt,
    },
  ].slice(-8);
  const trialsSeen = state.trialsSeen + 1;

  // Placement: the first 12 challenges of a mode you have never played move fast. A quick
  // correct answer steps up a level, a wrong one steps down, a slow correct one holds. An
  // experienced player reaches their level in about a minute instead of grinding from 1.
  if (trialsSeen <= PLACEMENT_TRIALS) {
    const quick = trial.correct && trial.responseMs <= trial.targetRt * 1.2;
    const level = quick ? Math.min(PLACEMENT_CAP, state.level + 1) : trial.correct ? state.level : Math.max(1, state.level - 1);
    return { level, trialsSeen, recent, lastChangeAt: trialsSeen };
  }

  if (trialsSeen - state.lastChangeAt < 6 || recent.length < 8) {
    return { ...state, trialsSeen, recent };
  }

  const accuracy = recent.filter((item) => item.correct).length / recent.length;
  const medianRt = [...recent].sort((a, b) => a.rt - b.rt)[Math.floor(recent.length / 2)]!.rt;
  const target = targetResponseMs(mode, state.level, activity, bias);

  let level = state.level;
  if (accuracy >= 0.85 && medianRt <= target) level = Math.min(MAX_LEVEL, state.level + 1);
  else if (accuracy < 0.6) level = Math.max(1, state.level - 1);

  return { level, trialsSeen, recent, lastChangeAt: level === state.level ? state.lastChangeAt : trialsSeen };
}
