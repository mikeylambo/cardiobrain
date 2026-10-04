import type { ComponentType } from "react";
import type { ModeChoice, ModeId } from "../engine/types";
import type { ModeViewProps } from "./shared";
import { NumbersView } from "./numbers";
import { SwitchView } from "./switch";
import { ReactView } from "./react";
import { RecallView } from "./recall";
import { RhymeView } from "./rhyme";

export interface ModeInfo {
  id: ModeChoice;
  label: string;
  description: string;
  /** One line shown on the Mix transition card. */
  instruction: string;
}

export const MODE_INFO: Record<ModeChoice, ModeInfo> = {
  mix: { id: "mix", label: "Mix", description: "All five, in 75-second blocks.", instruction: "" },
  numbers: { id: "numbers", label: "Numbers", description: "Quick sums. Pick the answer.", instruction: "Pick the answer." },
  switch: { id: "switch", label: "Switch", description: "The rule changes. Keep up.", instruction: "Follow the rule above the number." },
  react: { id: "react", label: "React", description: "Tap where the circle lands.", instruction: "Tap where it lands. Hold on a square." },
  recall: { id: "recall", label: "Recall", description: "Watch a sequence, then repeat it.", instruction: "Watch the shapes, then repeat them." },
  rhyme: { id: "rhyme", label: "Rhyme", description: "Find the word that rhymes.", instruction: "Listen for the sound, not the spelling." },
};

export const MODE_CHOICES: ModeChoice[] = ["mix", "numbers", "switch", "react", "recall", "rhyme"];

export const MODE_VIEWS: Record<ModeId, ComponentType<ModeViewProps>> = {
  numbers: NumbersView,
  switch: SwitchView,
  react: ReactView,
  recall: RecallView,
  rhyme: RhymeView,
};
