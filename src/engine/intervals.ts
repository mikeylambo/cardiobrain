import type { IntervalChoice } from "../storage";

export const INTERVALS: Record<Exclude<IntervalChoice, "off">, { work: number; rest: number; label: string }> = {
  "30/30": { work: 30_000, rest: 30_000, label: "30s on, 30s off" },
  "60/60": { work: 60_000, rest: 60_000, label: "1 min on, 1 min off" },
  "240/60": { work: 240_000, rest: 60_000, label: "4 min on, 1 min off" },
};

export interface IntervalState {
  /** True while challenges should be on screen. */
  playing: boolean;
  /** "work" or "rest" bout of the workout itself. */
  bout: "work" | "rest";
  /** ms until the bout changes. */
  remainingMs: number;
}

/**
 * Where a session is in its interval pattern. Bouts start with work. With
 * playDuring "rest", challenges show during recovery and the screen goes quiet while you push.
 */
export function intervalAt(elapsedMs: number, choice: IntervalChoice, playDuring: "work" | "rest"): IntervalState {
  if (choice === "off") return { playing: true, bout: "work", remainingMs: Infinity };
  const { work, rest } = INTERVALS[choice];
  const t = elapsedMs % (work + rest);
  const bout = t < work ? "work" : "rest";
  const remainingMs = bout === "work" ? work - t : work + rest - t;
  return { playing: bout === playDuring, bout, remainingMs };
}
