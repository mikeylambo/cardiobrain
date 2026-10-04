import type { Challenge, Generator } from "../../engine/types";
import { targetResponseMs } from "../../engine/difficulty";

/** Consonants that are easy to tell apart by eye and by ear. */
export const NBACK_LETTERS = ["B", "D", "F", "H", "K", "L", "M", "P", "R", "S", "T", "Z"] as const;

export const nFor = (level: number) => (level <= 6 ? 1 : level <= 13 ? 2 : 3);

/**
 * N-back: is this letter the same as the one N steps back?
 *
 * The stream is the session's own memory of what it showed (ctx.recent), so it stays
 * consistent when the level, and with it N, changes mid-block. About a third of trials
 * match once there is enough history; a non-match never repeats the N-back letter.
 */
export const generateNback: Generator = (level, rng, ctx): Challenge => {
  const n = nFor(level);
  const back = ctx.recent.length >= n ? ctx.recent[ctx.recent.length - n]! : null;
  const match = back !== null && rng() < 0.35;
  let letter: string;
  if (match) letter = back!;
  else {
    const pool = NBACK_LETTERS.filter((l) => l !== back);
    letter = pool[Math.floor(rng() * pool.length)]!;
  }
  const cue = n === 1 ? "Same as the last one?" : `Same as ${n} back?`;
  return {
    id: `nback-${ctx.trialIndex}-${level}`,
    mode: "nback",
    level,
    cue,
    prompt: letter,
    options: [
      { id: "match", label: "Match", say: ["match", "yes", "same", "yeah", "yep"] },
      { id: "nomatch", label: "No match", say: ["no", "nope", "different", "not"] },
    ],
    correctAnswer: match ? "match" : "nomatch",
    targetRt: targetResponseMs("nback", level, ctx.activity, ctx.bias),
    speech: `${letter}.`,
    voice: true,
    data: { letter, n, match, memo: letter },
  };
};
