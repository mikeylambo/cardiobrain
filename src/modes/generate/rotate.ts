import type { Challenge, Generator } from "../../engine/types";
import { targetResponseMs } from "../../engine/difficulty";

export type Cell = [number, number];

/**
 * Chiral polyominoes: none can be turned into its mirror image by rotation alone, so
 * "same or mirrored?" always has one answer. Checked by test (isChiral).
 */
export const SHAPES: Record<string, Cell[]> = {
  L4: [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 2],
  ],
  S4: [
    [1, 0],
    [2, 0],
    [0, 1],
    [1, 1],
  ],
  F5: [
    [1, 0],
    [2, 0],
    [0, 1],
    [1, 1],
    [1, 2],
  ],
  L5: [
    [0, 0],
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 3],
  ],
  N5: [
    [1, 0],
    [1, 1],
    [0, 2],
    [1, 2],
    [0, 3],
  ],
  P5: [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
    [0, 2],
  ],
  Y5: [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, 2],
    [1, 3],
  ],
  R6: [
    [1, 0],
    [2, 0],
    [0, 1],
    [1, 1],
    [1, 2],
    [1, 3],
  ],
  J6: [
    [2, 0],
    [2, 1],
    [0, 2],
    [1, 2],
    [2, 2],
    [0, 3],
  ],
  Q6: [
    [0, 0],
    [1, 0],
    [1, 1],
    [2, 1],
    [1, 2],
    [1, 3],
  ],
};

const norm = (cells: Cell[]): string => {
  const minX = Math.min(...cells.map((c) => c[0]));
  const minY = Math.min(...cells.map((c) => c[1]));
  return cells
    .map(([x, y]) => [x - minX, y - minY] as Cell)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .map((c) => c.join(","))
    .join(";");
};
const rot90 = (cells: Cell[]): Cell[] => cells.map(([x, y]) => [-y, x] as Cell);
const mirror = (cells: Cell[]): Cell[] => cells.map(([x, y]) => [-x, y] as Cell);

/** True when no rotation of the shape equals its mirror image. */
export function isChiral(cells: Cell[]): boolean {
  const target = norm(mirror(cells));
  let r = cells;
  for (let i = 0; i < 4; i++) {
    if (norm(r) === target) return false;
    r = rot90(r);
  }
  return true;
}

export function shapesFor(level: number): string[] {
  if (level <= 5) return ["L4", "S4", "L5", "P5"];
  if (level <= 12) return ["L4", "S4", "F5", "L5", "N5", "P5", "Y5"];
  return Object.keys(SHAPES);
}

export function anglesFor(level: number): number[] {
  if (level <= 3) return [0, 90, 270];
  if (level <= 9) return [0, 90, 180, 270];
  if (level <= 15) return [0, 45, 90, 135, 180, 225, 270, 315];
  return Array.from({ length: 12 }, (_, i) => i * 30);
}

/**
 * Mental rotation: the right-hand shape is the left one turned, and maybe mirrored.
 * Same or mirror?
 */
export const generateRotate: Generator = (level, rng, ctx): Challenge => {
  const pool = shapesFor(level);
  const shape = pool[Math.floor(rng() * pool.length)]!;
  const angles = anglesFor(level);
  const angle = angles[Math.floor(rng() * angles.length)]!;
  const mirrored = rng() < 0.5;
  const baseAngle = level >= 10 ? Math.floor(rng() * 4) * 90 : 0;
  return {
    id: `rotate-${ctx.trialIndex}-${level}`,
    mode: "rotate",
    level,
    cue: "Same shape, or a mirror?",
    prompt: "",
    options: [
      { id: "same", label: "Same", say: ["same", "match", "yes", "rotated", "turned"] },
      { id: "mirror", label: "Mirror", say: ["mirror", "mirrored", "flipped", "flip", "different", "no"] },
    ],
    correctAnswer: mirrored ? "mirror" : "same",
    targetRt: targetResponseMs("rotate", level, ctx.activity, ctx.bias),
    speech: "Same shape, or a mirror?",
    voice: true,
    data: { shape, angle, mirrored, baseAngle },
  };
};
