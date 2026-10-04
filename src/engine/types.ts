export type Activity = "walk" | "bike" | "stairs" | "run";
export type ModeId = "numbers" | "switch" | "react" | "recall" | "rhyme";
export type ModeChoice = ModeId | "mix";
export type SessionStatus = "countdown" | "running" | "paused" | "finished";
export type DifficultyBias = "gentle" | "standard" | "hard";
export type DurationChoice = 10 | 20 | 30 | "open";

export interface AnswerOption {
  id: string;
  label: string;
}

export interface Challenge {
  id: string;
  mode: ModeId;
  level: number;
  /** Short instruction shown above the stimulus ("Rhymes with"). Empty when the stimulus says it all. */
  cue: string;
  /** The stimulus itself, set in display type. */
  prompt: string;
  options: AnswerOption[];
  correctAnswer: string;
  targetRt: number;
  /** When set, the trial ends on its own after this many ms (React). */
  timeoutMs?: number;
  /** The answer that counts as correct when the timeout fires (a withheld no-go). */
  timeoutAnswer?: string;
  /** Switch: the rule changed on this trial. */
  switchTrial?: boolean;
  data: Record<string, unknown>;
}

export interface TrialResult {
  id: string;
  challengeId: string;
  mode: ModeId;
  level: number;
  answerId: string;
  correctAnswer: string;
  correct: boolean;
  responseMs: number;
  score: number;
  streak: number;
  switchTrial?: boolean;
  timestamp: number;
}

export interface SessionResult {
  id: string;
  activity: Activity;
  requestedMode: ModeChoice;
  durationSeconds: number;
  accuracy: number;
  avgRt: number;
  medianRt: number;
  challenges: number;
  bestStreak: number;
  totalScore: number;
  minLevel: number;
  maxLevel: number;
  /** Mean RT on switch trials minus mean RT on repeat trials, correct trials only. Null when not measurable. */
  switchCost: number | null;
  startedAt: number;
  finishedAt: number;
  guided?: boolean;
  trials: TrialResult[];
}

export interface ModeContext {
  activity: Activity;
  bias: DifficultyBias;
  seed: number;
  /** Index of this trial across the whole session. */
  trialIndex: number;
  /** How many trials of this mode came before this one in the session. */
  modeTrialIndex: number;
}

export type Generator = (level: number, rng: () => number, ctx: ModeContext) => Challenge;
