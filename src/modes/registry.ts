import type { ModeDefinition, ModeId } from "../engine/types";
import { numbersMode } from "./numbers";
import { switchMode } from "./switch";
import { reactMode } from "./react";
import { recallMode } from "./recall";
import { rhymeMode } from "./rhyme";

export const MODE_REGISTRY: Record<ModeId, ModeDefinition> = {
  numbers: numbersMode,
  switch: switchMode,
  react: reactMode,
  recall: recallMode,
  rhyme: rhymeMode
};

export const CORE_MODE_IDS: ModeId[] = ["numbers","switch","react","recall"];
export const MIX_MODE_IDS: ModeId[] = [...CORE_MODE_IDS,"rhyme"];
export const isPlayableMode = (mode: ModeId): boolean => Boolean(MODE_REGISTRY[mode]);

export function modeList(): ModeDefinition[] {
  return Object.values(MODE_REGISTRY);
}
