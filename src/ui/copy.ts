import type { Activity, ModeChoice, SessionResult } from "../engine/types";
import { MODE_INFO } from "../modes/registry";

export const ACTIVITIES: Activity[] = ["walk", "bike", "stairs", "run"];
export const ACTIVITY_LABEL: Record<Activity, string> = { walk: "Walk", bike: "Bike", stairs: "Stairs", run: "Run" };
export const ACTIVITY_NOUN: Record<Activity, string> = { walk: "walk", bike: "bike", stairs: "stairs", run: "run" };
export const ACTIVITY_COLOR: Record<Activity, string> = { walk: "#0B7A6B", bike: "#FFC400", stairs: "#5B2EFF", run: "#FF4B2B" };
export const ACTIVITY_ON: Record<Activity, string> = { walk: "#FFFFFF", bike: "#16181D", stairs: "#FFFFFF", run: "#16181D" };

export const pct = (x: number) => Math.round(x * 100);
export const secs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

export function durationLabel(d: 10 | 20 | 30 | "open"): string {
  return d === "open" ? "open-ended" : `${d} min`;
}

export function presetLine(activity: Activity, mode: ModeChoice, duration: 10 | 20 | 30 | "open"): string {
  return `${ACTIVITY_LABEL[activity]}, ${MODE_INFO[mode].label}, ${durationLabel(duration)}`;
}

export function minutesLabel(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}m ${s}s` : `${m} min`;
}

/** The previous session to compare against: same activity, same mode. */
export function previousMatch(history: SessionResult[], result: SessionResult): SessionResult | null {
  return (
    history.find(
      (h) => h.id !== result.id && h.activity === result.activity && h.requestedMode === result.requestedMode && h.finishedAt < result.finishedAt && !h.guided,
    ) ?? null
  );
}

export function sessionNoun(r: Pick<SessionResult, "activity" | "requestedMode">): string {
  const mode = r.requestedMode === "mix" ? "" : ` ${MODE_INFO[r.requestedMode].label}`;
  return `${ACTIVITY_NOUN[r.activity]}${mode} session`;
}

export interface Deltas {
  accuracyPoints: number | null;
  rtSeconds: number | null;
}

export function deltas(result: SessionResult, prev: SessionResult | null): Deltas {
  if (!prev) return { accuracyPoints: null, rtSeconds: null };
  return {
    accuracyPoints: pct(result.accuracy) - pct(prev.accuracy),
    rtSeconds: result.avgRt && prev.avgRt ? Math.round((result.avgRt - prev.avgRt) / 10) / 100 : null,
  };
}

export function headline(result: SessionResult, prev: SessionResult | null): string {
  if (result.guided) return "That's the whole game.";
  const noun = sessionNoun(result);
  if (!prev) return "Baseline set.";
  const d = deltas(result, prev);
  const acc = d.accuracyPoints ?? 0;
  const rt = d.rtSeconds ?? 0;
  if (acc >= 3 || (acc >= 0 && rt <= -0.1)) return `Sharper than your last ${noun}.`;
  if (acc <= -6) return `Tougher than your last ${noun}. It happens.`;
  if (rt >= 0.15 && acc >= 0) return `Just as accurate as last ${noun}, a touch slower.`;
  return `Right in line with your last ${noun}.`;
}

export function accuracyDeltaText(points: number | null): string {
  if (points === null) return "First of its kind";
  if (points === 0) return "Same as last time";
  const n = Math.abs(points);
  return `${n} ${n === 1 ? "point" : "points"} ${points > 0 ? "above" : "below"} last time`;
}

export function rtDeltaText(seconds: number | null): string {
  if (seconds === null) return "First of its kind";
  if (Math.abs(seconds) < 0.01) return "Same pace as last time";
  return `${Math.abs(seconds).toFixed(2)}s ${seconds < 0 ? "faster" : "slower"}`;
}

export function switchCostText(ms: number | null): string | null {
  if (ms === null) return null;
  if (ms <= 20) return "No measurable slowdown when the rule changed.";
  return `${(ms / 1000).toFixed(2)}s slower when the rule changed.`;
}

/** A plain-language note for session detail. */
export function sessionNote(r: SessionResult): string {
  const acc = pct(r.accuracy);
  if (r.challenges < 5) return "A short one. A few more challenges make the numbers meaningful.";
  if (acc >= 90) return "Very accurate. The difficulty will keep climbing to match you.";
  if (acc >= 75) return "Solid. Accuracy matters more than speed, and this is a good balance.";
  if (acc >= 60) return "Steady work. Slow down a touch on the next one and accuracy should rise.";
  return "A hard session. The difficulty eased off to meet you where you are.";
}
