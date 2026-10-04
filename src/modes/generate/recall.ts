import type { Challenge, Generator } from "../../engine/types";
import { shuffle } from "../../engine/rng";
import { ACTIVITY_RESPONSE_MULTIPLIER, targetResponseMs } from "../../engine/difficulty";

export const SHAPES = ["circle", "square", "triangle", "diamond", "star", "cross"] as const;
export type Shape = (typeof SHAPES)[number];
export const SHAPE_LABEL: Record<Shape, string> = {
  circle: "Circle",
  square: "Square",
  triangle: "Triangle",
  diamond: "Diamond",
  star: "Star",
  cross: "Cross",
};

export const recallLength = (level: number) => Math.min(8, 2 + Math.floor((level - 1) / 3));

/**
 * Recall: watch a sequence of shapes, then rebuild it.
 *
 * The answer pads are always every distinct shape in the sequence, plus fillers up to a
 * minimum of four. v1 drew four random pads independent of the sequence, so short rounds
 * were often unwinnable; this construction makes that impossible by definition.
 */
export const generateRecall: Generator = (level, rng, ctx): Challenge => {
  const length = recallLength(level);
  const sequence: Shape[] = [];
  // Repeats are allowed from level 7, and only ever one shape at a time (no "circle circle").
  const allowRepeats = level >= 7;
  while (sequence.length < length) {
    const s = SHAPES[Math.floor(rng() * SHAPES.length)]!;
    if (sequence[sequence.length - 1] === s) continue;
    if (!allowRepeats && sequence.includes(s) && new Set(sequence).size < SHAPES.length) continue;
    sequence.push(s);
  }
  const distinct = [...new Set(sequence)];
  const padCount = Math.max(4, distinct.length);
  const fillers = shuffle(
    SHAPES.filter((s) => !distinct.includes(s)),
    rng,
  ).slice(0, padCount - distinct.length);
  const pads = shuffle([...distinct, ...fillers], rng);
  const stepMs = Math.round(Math.max(520, 820 - level * 12) * Math.min(1.25, ACTIVITY_RESPONSE_MULTIPLIER[ctx.activity]));
  return {
    id: `recall-${ctx.trialIndex}-${level}`,
    mode: "recall",
    level,
    cue: "Watch, then repeat",
    prompt: "",
    options: pads.map((s) => ({ id: s, label: SHAPE_LABEL[s] })),
    correctAnswer: sequence.join(" "),
    voice: false,
    targetRt: targetResponseMs("recall", level, ctx.activity, ctx.bias) * (0.6 + length * 0.2),
    data: { sequence, stepMs },
  };
};
