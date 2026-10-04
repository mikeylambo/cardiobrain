import type { DurationChoice } from "./types";

export const DURATION_SECONDS: Record<Exclude<DurationChoice, "open">, number> = { 10: 600, 20: 1200, 30: 1800 };
export const GUIDED_SECONDS = 30;
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
