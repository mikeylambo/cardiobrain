import type { Activity, ModeChoice, SessionResult } from "./types";

const DAY = 86_400_000;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
/** Sessions that say something about you: not the guided round, not the fixed-level daily, not tiny ones. */
export const counts = (h: SessionResult) => !h.guided && !h.daily && h.challenges >= 8;

export interface Bests {
  accuracy: boolean;
  speed: boolean;
  streak: boolean;
}

/**
 * Personal bests for this mode and activity. Accuracy needs at least 20 challenges;
 * a speed best only counts at 80% accuracy or better, so mashing fast never wins it.
 */
export function personalBests(history: SessionResult[], r: SessionResult): Bests {
  const prior = history.filter(
    (h) => h.id !== r.id && h.finishedAt < r.finishedAt && h.activity === r.activity && h.requestedMode === r.requestedMode && counts(h),
  );
  if (!prior.length || !counts(r)) return { accuracy: false, speed: false, streak: false };
  const accOk = (h: SessionResult) => h.challenges >= 20;
  const speedOk = (h: SessionResult) => h.accuracy >= 0.8 && h.avgRt > 0;
  const bestAcc = Math.max(0, ...prior.filter(accOk).map((h) => h.accuracy));
  const fastest = Math.min(Infinity, ...prior.filter(speedOk).map((h) => h.avgRt));
  const bestStreak = Math.max(0, ...prior.map((h) => h.bestStreak));
  return {
    accuracy: accOk(r) && r.accuracy > bestAcc && prior.some(accOk),
    speed: speedOk(r) && r.avgRt < fastest && Number.isFinite(fastest),
    streak: r.bestStreak > bestStreak && r.bestStreak >= 5,
  };
}

export interface MotionCost {
  /** Moving accuracy minus seated accuracy, in points (negative = movement costs accuracy). */
  accuracyPoints: number;
  /** Moving RT minus seated RT, seconds (positive = slower when moving). */
  rtSeconds: number;
  /** Same as a percentage of the seated RT. */
  rtPercent: number;
  baselineSessions: number;
}

/** How much moving costs you on a mode, against your seated baseline (last 3 seated sessions of that mode). */
export function motionCost(history: SessionResult[], mode: ModeChoice, moving: SessionResult[]): MotionCost | null {
  const base = history.filter((h) => h.activity === "still" && h.requestedMode === mode && counts(h)).slice(0, 3);
  const mov = moving.filter((h) => h.activity !== "still" && h.requestedMode === mode && counts(h));
  if (!base.length || !mov.length) return null;
  const bAcc = mean(base.map((h) => h.accuracy));
  const bRt = mean(base.map((h) => h.avgRt));
  const mAcc = mean(mov.map((h) => h.accuracy));
  const mRt = mean(mov.map((h) => h.avgRt));
  return {
    accuracyPoints: Math.round((mAcc - bAcc) * 100),
    rtSeconds: Math.round((mRt - bRt) / 10) / 100,
    rtPercent: bRt ? Math.round(((mRt - bRt) / bRt) * 100) : 0,
    baselineSessions: base.length,
  };
}

export function motionCostText(c: MotionCost): string {
  const rt = Math.abs(c.rtPercent) < 3 ? "about as fast as" : `${Math.abs(c.rtPercent)}% ${c.rtPercent > 0 ? "slower than" : "faster than"}`;
  const acc =
    Math.abs(c.accuracyPoints) < 2
      ? "just as accurate"
      : `${Math.abs(c.accuracyPoints)} ${Math.abs(c.accuracyPoints) === 1 ? "point" : "points"} ${c.accuracyPoints < 0 ? "less" : "more"} accurate`;
  return `Moving, you're ${rt} seated and ${acc}.`;
}

/** Monday-start week containing `now`. */
export function weekStart(now = Date.now()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7;
  return d.getTime() - dow * DAY;
}

export const sessionsThisWeek = (history: SessionResult[], now = Date.now()) =>
  history.filter((h) => !h.guided && h.startedAt >= weekStart(now) && h.activity !== "still").length;

export interface Insight {
  id: string;
  title: string;
  body: string;
}

const partOfDay = (t: number) => {
  const h = new Date(t).getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
};

/**
 * Plain-language findings from your own sessions. Each one needs a minimum sample and a
 * difference big enough to mention; they describe patterns, never causes.
 */
export function findInsights(history: SessionResult[], labels: { mode: (m: ModeChoice) => string; activity: (a: Activity) => string }): Insight[] {
  const hs = history.filter(counts);
  const out: Insight[] = [];
  const pct = (x: number) => Math.round(x * 100);

  // Effort: hard sessions vs easy ones.
  const rated = hs.filter((h) => typeof h.rpe === "number");
  const hard = rated.filter((h) => h.rpe! >= 7);
  const easy = rated.filter((h) => h.rpe! <= 5);
  if (hard.length >= 3 && easy.length >= 3) {
    const d = pct(mean(hard.map((h) => h.accuracy))) - pct(mean(easy.map((h) => h.accuracy)));
    if (Math.abs(d) >= 3)
      out.push({
        id: "effort",
        title: d < 0 ? "Hard efforts cost you accuracy" : "You stay sharp when it's hard",
        body:
          d < 0
            ? `Your accuracy is ${-d} points lower when you rate a session 7 or above than when you rate it 5 or below.`
            : `Your accuracy is ${d} points higher on sessions you rate 7 or above.`,
      });
  }

  // Time of day.
  const byPart: Record<string, SessionResult[]> = {};
  for (const h of hs) (byPart[partOfDay(h.startedAt)] ??= []).push(h);
  const parts = Object.entries(byPart).filter(([, v]) => v.length >= 3);
  if (parts.length >= 2) {
    const ranked = parts.map(([k, v]) => ({ k, acc: mean(v.map((h) => h.accuracy)), n: v.length })).sort((a, b) => b.acc - a.acc);
    const gap = pct(ranked[0]!.acc) - pct(ranked[ranked.length - 1]!.acc);
    if (gap >= 3)
      out.push({
        id: "time",
        title: `${ranked[0]!.k[0]!.toUpperCase()}${ranked[0]!.k.slice(1)}s are your sharpest`,
        body: `You average ${pct(ranked[0]!.acc)}% in the ${ranked[0]!.k}, ${gap} points above the ${ranked[ranked.length - 1]!.k}.`,
      });
  }

  // Mood lift.
  const moods = hs.filter((h) => typeof h.moodBefore === "number" && typeof h.moodAfter === "number");
  if (moods.length >= 3) {
    const lift = mean(moods.map((h) => h.moodAfter! - h.moodBefore!));
    if (Math.abs(lift) >= 0.3)
      out.push({
        id: "mood",
        title: lift > 0 ? "You leave in a better mood" : "Your mood drops during sessions",
        body:
          lift > 0
            ? `Across ${moods.length} check-ins, your mood rises by ${lift.toFixed(1)} on a 5-point scale from start to finish.`
            : `Across ${moods.length} check-ins, your mood drops by ${Math.abs(lift).toFixed(1)} on a 5-point scale. Try Gentle difficulty or shorter sessions.`,
      });
  }

  // Motion cost per activity.
  for (const a of ["walk", "bike", "stairs", "run"] as Activity[]) {
    const costs = (["numbers", "switch", "react", "recall", "rhyme", "nback", "estimate", "rotate", "mix"] as ModeChoice[])
      .map((m) => motionCost(history, m, hs.filter((h) => h.activity === a).slice(0, 5)))
      .filter((c): c is MotionCost => c !== null);
    if (costs.length) {
      const rt = Math.round(mean(costs.map((c) => c.rtPercent)));
      const acc = Math.round(mean(costs.map((c) => c.accuracyPoints)));
      out.push({
        id: `motion-${a}`,
        title: `Motion cost: ${labels.activity(a).toLowerCase()}`,
        body: `Against your seated baseline, ${labels.activity(a).toLowerCase()} sessions are ${Math.abs(rt)}% ${rt >= 0 ? "slower" : "faster"} and ${Math.abs(acc)} ${Math.abs(acc) === 1 ? "point" : "points"} ${acc <= 0 ? "less" : "more"} accurate.`,
      });
    }
  }

  // Most improved mode: first three vs latest three.
  const byMode: Record<string, SessionResult[]> = {};
  for (const h of hs) (byMode[h.requestedMode] ??= []).push(h);
  let best: { m: string; gain: number } | null = null;
  for (const [m, v] of Object.entries(byMode)) {
    if (v.length < 6) continue;
    const latest = v.slice(0, 3);
    const first = v.slice(-3);
    const gain = pct(mean(latest.map((h) => h.accuracy))) - pct(mean(first.map((h) => h.accuracy)));
    if (!best || gain > best.gain) best = { m, gain };
  }
  if (best && best.gain >= 3)
    out.push({
      id: "improved",
      title: `Most improved: ${labels.mode(best.m as ModeChoice)}`,
      body: `Your last three ${labels.mode(best.m as ModeChoice)} sessions average ${best.gain} points above your first three.`,
    });

  // Consistency.
  const now = Date.now();
  const thisWeek = sessionsThisWeek(hs, now);
  const lastWeek = hs.filter((h) => h.startedAt >= weekStart(now) - 7 * DAY && h.startedAt < weekStart(now)).length;
  if (thisWeek + lastWeek >= 2) {
    out.push({
      id: "consistency",
      title: "This week",
      body: `${thisWeek} ${thisWeek === 1 ? "session" : "sessions"} this week, ${lastWeek} last week.`,
    });
  }
  return out;
}
