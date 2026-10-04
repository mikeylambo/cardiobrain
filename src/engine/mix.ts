import type { ModeId } from "./types";
import { hashSeed, mulberry32, shuffle } from "./rng";

export const MIX_BLOCK_MS = 75_000;
export const GUIDED_BLOCK_MS = 10_000;
export const MIX_MODES: ModeId[] = ["numbers", "switch", "react", "recall", "rhyme", "nback", "estimate", "rotate"];
export const GUIDED_MODES: ModeId[] = ["numbers", "react", "switch"];

/**
 * The mode for Mix block `block`: shuffled cycles through every mode, with the seam
 * between cycles fixed so the same mode never runs twice in a row.
 */
export function mixModeAt(seed: number, block: number, modes: ModeId[] = MIX_MODES): ModeId {
  const rng = mulberry32(hashSeed([seed, "mix", modes.join()]));
  const seq: ModeId[] = [];
  while (seq.length <= block) {
    const cycle = shuffle(modes, rng);
    if (seq.length && cycle[0] === seq[seq.length - 1] && cycle.length > 1) {
      [cycle[0], cycle[1]] = [cycle[1]!, cycle[0]!];
    }
    seq.push(...cycle);
  }
  return seq[block]!;
}
