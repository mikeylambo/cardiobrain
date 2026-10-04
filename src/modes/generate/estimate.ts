import type { Challenge, Generator } from "../../engine/types";
import { shuffle, type Rng } from "../../engine/rng";
import { targetResponseMs } from "../../engine/difficulty";

export interface Dot {
  x: number;
  y: number;
  r: number;
}

/** Ratio between neighbouring options: easy to tell apart at level 1, close at level 20. */
export const ratioFor = (level: number) => Math.max(1.18, 1.75 - level * 0.03);
export const countRange = (level: number): [number, number] => [6 + Math.floor(level / 2), Math.min(90, 14 + level * 4)];
export const showMsFor = (level: number) => Math.max(650, 1600 - level * 50);

/** Non-overlapping dots in a 100×100 field. */
export function scatter(count: number, rng: Rng): Dot[] {
  const r = count > 50 ? 2.2 : count > 25 ? 2.8 : 3.6;
  const gap = r * 2 + 1.2;
  const dots: Dot[] = [];
  let tries = 0;
  while (dots.length < count && tries < 20000) {
    tries++;
    const x = r + rng() * (100 - 2 * r);
    const y = r + rng() * (100 - 2 * r);
    if (dots.every((d) => (d.x - x) ** 2 + (d.y - y) ** 2 >= gap * gap)) dots.push({ x, y, r });
  }
  return dots;
}

/**
 * Estimation: a field of dots flashes, then hides. Which number is closest?
 * The options are the true count and its neighbours on a geometric ladder (the
 * approximate number system works in ratios), so the right answer is always the exact
 * count and every other option is clearly further away.
 */
export const generateEstimate: Generator = (level, rng, ctx): Challenge => {
  const [lo, hi] = countRange(level);
  const ratio = ratioFor(level);
  let count = lo + Math.floor(rng() * (hi - lo + 1));
  const dots = scatter(count, rng);
  count = dots.length;
  // Where the true count sits on the ladder; fewer rungs below it when the count is small.
  const maxBelow = Math.min(3, Math.floor(Math.log(count) / Math.log(ratio)));
  const position = Math.min(maxBelow, Math.floor(rng() * 4));
  const values: number[] = [];
  values[position] = count;
  for (let k = position - 1; k >= 0; k--) values[k] = Math.max(1, Math.min(Math.round(count * ratio ** (k - position)), values[k + 1]! - 1));
  for (let k = position + 1; k < 4; k++) values[k] = Math.max(Math.round(count * ratio ** (k - position)), values[k - 1]! + 1);
  return {
    id: `estimate-${ctx.trialIndex}-${level}`,
    mode: "estimate",
    level,
    cue: "About how many?",
    prompt: "",
    options: shuffle(values, rng).map((v) => ({ id: `e${v}`, label: String(v) })),
    correctAnswer: `e${count}`,
    targetRt: targetResponseMs("estimate", level, ctx.activity, ctx.bias),
    speech: "About how many dots?",
    voice: true,
    data: { count, dots, showMs: showMsFor(level) },
  };
};
