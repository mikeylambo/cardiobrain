import type { ModeDefinition, ModeId } from "../engine/types";
import { numbersMode } from "./numbers";
import { switchMode } from "./switch";
import { reactMode } from "./react";
import { recallMode } from "./recall";

export const MODE_REGISTRY: Record<ModeId, ModeDefinition> = {
  numbers: numbersMode,
  switch: switchMode,
  react: reactMode,
  recall: recallMode,
  rhyme: {
    id: "rhyme",
    group: "words",
    label: "Rhyme Rush",
    shortLabel: "RHYME",
    description: "Tap the word that keeps the sound alive.",
    generate: () => { throw new Error("Rhyme Rush is registered during section 14."); },
    View: () => null
  }
};

export const CORE_MODE_IDS: ModeId[] = ["numbers", "switch", "react", "recall"];
export const isPlayableMode = (mode: ModeId): boolean => Boolean(MODE_REGISTRY[mode]);

export function modeList(): ModeDefinition[] {
  return Object.values(MODE_REGISTRY).filter((mode) => mode.id !== "rhyme" || mode.generate.toString().includes("Rhyme Rush"));
}
