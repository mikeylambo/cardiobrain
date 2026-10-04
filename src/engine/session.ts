import type { DurationChoice } from "./types";

export const DURATION_SECONDS: Record<Exclude<DurationChoice, "open">, number> = { 5: 300, 10: 600, 20: 1200, 30: 1800 };
export const GUIDED_SECONDS = 30;

/** Sessions of at least this long ease in and out. */
export const EASE_MIN_SECONDS = 300;
export const EASE_MS = 45_000;

/**
 * How many levels to drop below your level right now: two for the first 20 seconds, one until
 * 45 seconds, and one again for the last 45 seconds of a timed session. Open sessions only ease in.
 */
export function easeOffset(elapsedMs: number, durationSeconds: number | null): number {
  if (durationSeconds !== null && durationSeconds < EASE_MIN_SECONDS) return 0;
  if (elapsedMs < 20_000) return 2;
  if (elapsedMs < EASE_MS) return 1;
  if (durationSeconds !== null && durationSeconds * 1000 - elapsedMs < EASE_MS) return 1;
  return 0;
}

export type EasePhase = "warm-up" | "cool-down" | null;
export function easePhase(elapsedMs: number, durationSeconds: number | null): EasePhase {
  if (!easeOffset(elapsedMs, durationSeconds)) return null;
  return elapsedMs < EASE_MS ? "warm-up" : "cool-down";
}
/** A session saved less than this long ago is offered back on Home. */
export const RESUME_WINDOW_MS = 30 * 60_000;
/** Backgrounded longer than this, the session pauses itself. */
export const AUTO_PAUSE_MS = 3_000;

export function makeSessionId(timestamp = Date.now()): string {
  return `cb-${timestamp.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function formatClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
