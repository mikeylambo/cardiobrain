export type Activity = "walk" | "bike" | "stairs" | "run";
export type ModeId = "numbers" | "switch" | "react" | "recall" | "rhyme";
export type ModeGroup = "core" | "words";
export type SessionStatus = "idle" | "countdown" | "running" | "paused" | "finished";
export type DifficultyBias = "gentle" | "standard" | "hard";
export type DurationChoice = 10 | 20 | 30 | "open";

export interface AnswerOption {
  id: string;
  label: string;
  tone?: "neutral" | "accent" | "muted";
}

export type ChallengeKind = "numbers" | "switch" | "react" | "recall" | "rhyme";

export interface Challenge {
  id: string;
  mode: ModeId;
  kind: ChallengeKind;
  level: number;
  prompt: string;
  options: AnswerOption[];
  correctAnswer: string;
  targetRt: number;
  data: Record<string, unknown>;
}

export interface TrialResult {
  id: string;
  challengeId: string;
  mode: ModeId;
  activity: Activity;
  level: number;
  answerId: string;
  correctAnswer: string;
  correct: boolean;
  responseMs: number;
  score: number;
  streak: number;
  timestamp: number;
}

export interface SessionResult {
  id: string;
  activity: Activity;
  requestedMode: ModeId | "mix";
  durationSeconds: number;
  accuracy: number;
  avgRt: number;
  medianRt: number;
  challenges: number;
  bestStreak: number;
  totalScore: number;
  minLevel: number;
  maxLevel: number;
  startedAt: number;
  finishedAt: number;
  trials: TrialResult[];
}

export interface ModeContext {
  activity: Activity;
  bias: DifficultyBias;
  seed: number;
  trialIndex: number;
}

export interface ModeDefinition {
  id: ModeId;
  group: ModeGroup;
  label: string;
  shortLabel: string;
  description: string;
  generate: (level: number, rng: () => number, ctx: ModeContext) => Challenge;
  View: import("react").ComponentType<{
    challenge: Challenge;
    onAnswer: (answerId: string) => void;
    onPresented: () => void;
  }>;
}
