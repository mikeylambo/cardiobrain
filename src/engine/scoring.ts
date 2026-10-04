import type { DifficultyBias, TrialResult } from "./types";

export function speedFactor(responseMs: number, targetRt: number): number {
  if (!Number.isFinite(responseMs) || responseMs <= 0) return 1;
  const ratio = responseMs / Math.max(1, targetRt);
  return Math.max(0.65, Math.min(1.25, 1.25 - 0.5 * (ratio - 1)));
}

export function streakFactor(streak: number): number {
  return Math.min(1.5, 1 + Math.min(streak, 25) * 0.02);
}

export function baseScore(level: number): number {
  return 100 + level * 35;
}

export function challengeScore(correct: boolean, level: number, responseMs: number, targetRt: number, streak: number, bias: DifficultyBias): number {
  if (!correct) return 0;
  const biasFactor = bias === "hard" ? 1.05 : bias === "gentle" ? 0.96 : 1;
  return Math.round(baseScore(level) * speedFactor(responseMs, targetRt) * streakFactor(streak) * biasFactor);
}

export function sessionMetrics(trials: TrialResult[]) {
  const correctTrials = trials.filter((trial) => trial.correct);
  const responseTimes = trials.filter((trial) => Number.isFinite(trial.responseMs) && trial.responseMs > 0).map((trial) => trial.responseMs);
  const sorted = [...responseTimes].sort((a, b) => a - b);
  const medianRt = sorted.length ? sorted[Math.floor(sorted.length / 2)]! : 0;
  const avgRt = responseTimes.length ? responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length : 0;
  return {
    accuracy: trials.length ? correctTrials.length / trials.length : 0,
    avgRt,
    medianRt,
    challenges: trials.length,
    bestStreak: trials.reduce((best, trial) => Math.max(best, trial.streak), 0),
    totalScore: trials.reduce((sum, trial) => sum + trial.score, 0),
    minLevel: trials.length ? Math.min(...trials.map((trial) => trial.level)) : 1,
    maxLevel: trials.length ? Math.max(...trials.map((trial) => trial.level)) : 1
  };
}
