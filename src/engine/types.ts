/** "still" is the seated baseline: the same challenges, no movement, so motion cost can be measured. */
export type Activity = "walk" | "bike" | "stairs" | "run" | "still";
export type ModeId = "numbers" | "switch" | "react" | "recall" | "rhyme" | "nback" | "estimate" | "rotate";
export type ModeChoice = ModeId | "mix";
export type SessionStatus = "countdown" | "running" | "paused" | "finished";
export type DifficultyBias = "gentle" | "standard" | "hard";
export type DurationChoice = 5 | 10 | 20 | 30 | "open";

export interface AnswerOption {
  id: string;
  label: string;
  /** Extra words that count as this answer when spoken ("over", "higher", "high"). */
  say?: string[];
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
  /** What to read aloud for this challenge, when spoken prompts are on. */
  speech?: string;
  /** Played below your level during a warm-up or cool-down; it does not move your level. */
  eased?: boolean;
  /** Voice answers make sense for this challenge (not for React's reflex taps or Recall's sequences). */
  voice?: boolean;
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
  /** Heart rate when answered, if a strap was connected. */
  hr?: number;
  timestamp: number;
}

export interface SessionResult {
  id: string;
  activity: Activity;
  requestedMode: ModeChoice;
  durationSeconds: number;
  accuracy: number;
  /** Mean and median response time over correct answers (see rtBasis). */
  avgRt: number;
  medianRt: number;
  /** "correct": times cover correct answers only. Older sessions timed every answer and are recomputed on load. */
  rtBasis?: "correct";
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
  /** Daily challenge: the date key (YYYY-MM-DD) everyone shares. */
  daily?: string;
  /** A one-minute "Try it" practice from Insights: kept in History, left out of stats. */
  practice?: boolean;
  /** Rate of perceived exertion, 1-10 (Borg CR10), from the check-in on Results. */
  rpe?: number;
  /** Mood 1-5 before and after, when mood check-ins are on. */
  moodBefore?: number;
  moodAfter?: number;
  /** Interval pattern used, e.g. "60/60". */
  intervals?: string;
  /** Mean heart rate across answered challenges, if a strap was connected. */
  avgHr?: number;
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
  /** Stimuli this mode showed most recently in the current block, oldest first (N-back needs them). */
  recent: string[];
}

export type Generator = (level: number, rng: () => number, ctx: ModeContext) => Challenge;
