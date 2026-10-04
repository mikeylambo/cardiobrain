import type { SessionStatus } from "./types";

export type SessionEvent = "BEGIN_COUNTDOWN" | "COUNTDOWN_DONE" | "PAUSE" | "RESUME" | "FINISH" | "RESET";

const transitions: Record<SessionStatus, Partial<Record<SessionEvent, SessionStatus>>> = {
  idle: { BEGIN_COUNTDOWN: "countdown", RESET: "idle" },
  countdown: { COUNTDOWN_DONE: "running", RESET: "idle" },
  running: { PAUSE: "paused", FINISH: "finished", RESET: "idle" },
  paused: { RESUME: "countdown", FINISH: "finished", RESET: "idle" },
  finished: { RESET: "idle", BEGIN_COUNTDOWN: "countdown" }
};

export function transition(status: SessionStatus, event: SessionEvent): SessionStatus {
  return transitions[status][event] ?? status;
}

export function makeSessionId(timestamp = Date.now()): string {
  return `cb-${timestamp.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function sortRecent<T extends { timestamp?: number; startedAt?: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => (b.timestamp ?? b.startedAt ?? 0) - (a.timestamp ?? a.startedAt ?? 0));
}
