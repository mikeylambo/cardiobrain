import type { ComponentType } from "react";
import type { ModeChoice, ModeId } from "../engine/types";
import type { ModeViewProps } from "./shared";
import { NumbersView } from "./numbers";
import { SwitchView } from "./switch";
import { ReactView } from "./react";
import { RecallView } from "./recall";
import { RhymeView } from "./rhyme";
import { NbackView } from "./nback";
import { EstimateView } from "./estimate";
import { RotateView } from "./rotate";

export interface ModeInfo {
  id: ModeChoice;
  label: string;
  description: string;
  /** One line shown on the Mix transition card and as the first-time coach line. */
  instruction: string;
  /** What it practises, in plain words, with the research it draws on. */
  science?: { practises: string; source: string };
}

export const MODE_INFO: Record<ModeChoice, ModeInfo> = {
  mix: { id: "mix", label: "Mix", description: "Your chosen modes, in 75-second blocks.", instruction: "" },
  numbers: { id: "numbers", label: "Numbers", description: "Quick sums. Pick the answer.", instruction: "Pick the answer." },
  switch: { id: "switch", label: "Switch", description: "The rule changes. Keep up.", instruction: "Follow the rule above the number." },
  react: { id: "react", label: "React", description: "Tap where the circle lands.", instruction: "Tap where it lands. Hold on a square." },
  recall: { id: "recall", label: "Recall", description: "Watch a sequence, then repeat it.", instruction: "Watch the shapes, then repeat them." },
  rhyme: { id: "rhyme", label: "Rhyme", description: "Find the word that rhymes.", instruction: "Listen for the sound, not the spelling." },
  nback: { id: "nback", label: "N-back", description: "Same letter as a few back?", instruction: "Tap Match when the letter repeats from N back." },
  estimate: { id: "estimate", label: "Estimate", description: "Dots flash. About how many?", instruction: "Go by feel. There isn't time to count." },
  rotate: { id: "rotate", label: "Rotate", description: "Same shape turned, or a mirror?", instruction: "Turn it in your head. Same, or mirrored?" },
};

/**
 * What each mode practises, and the classic research it is modelled on. These are
 * descriptions of the tasks, not promises of transfer: the evidence that brain training
 * improves everyday thinking is mixed, and the copy says so plainly.
 */
export const SCIENCE: Partial<Record<ModeId, { practises: string; source: string }>> = {
  numbers: { practises: "Mental arithmetic holds numbers in working memory while you calculate.", source: "Baddeley & Hitch, working memory model (1974)" },
  switch: {
    practises: "Shifting between rules. The slowdown right after a switch is the switch cost.",
    source: "Monsell, Task switching, Trends in Cognitive Sciences (2003)",
  },
  react: { practises: "Fast responses, and holding back when the cue says stop (go/no-go).", source: "Verbruggen & Logan, response inhibition (2008)" },
  recall: { practises: "Short-term memory for a sequence, like the Corsi block-tapping test.", source: "Corsi (1972); Kessels et al. (2000)" },
  rhyme: {
    practises: "Phonological processing: hearing sounds inside words, separate from spelling.",
    source: "CMU Pronouncing Dictionary; phonological awareness research",
  },
  nback: {
    practises: "Updating working memory: keeping the last few items and comparing as they change.",
    source: "Kirchner (1958); Owen et al., meta-analysis (2005)",
  },
  estimate: { practises: "The approximate number sense: judging quantity at a glance, in ratios.", source: "Halberda, Mazzocco & Feigenson, Nature (2008)" },
  rotate: { practises: "Mental rotation: turning a shape in your mind's eye to compare it.", source: "Shepard & Metzler, Science (1971)" },
};

export const MODE_CHOICES: ModeChoice[] = ["mix", "numbers", "switch", "react", "recall", "rhyme", "nback", "estimate", "rotate"];
export const PLAYABLE_MODES: ModeId[] = ["numbers", "switch", "react", "recall", "rhyme", "nback", "estimate", "rotate"];

export const MODE_VIEWS: Record<ModeId, ComponentType<ModeViewProps>> = {
  numbers: NumbersView,
  switch: SwitchView,
  react: ReactView,
  recall: RecallView,
  rhyme: RhymeView,
  nback: NbackView,
  estimate: EstimateView,
  rotate: RotateView,
};
