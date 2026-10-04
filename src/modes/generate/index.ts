import type { Generator, ModeId } from "../../engine/types";
import { generateNumbers } from "./numbers";
import { generateSwitch } from "./switch";
import { generateReact } from "./react";
import { generateRecall } from "./recall";
import { generateRhyme } from "./rhyme";

export const GENERATORS: Record<ModeId, Generator> = {
  numbers: generateNumbers,
  switch: generateSwitch,
  react: generateReact,
  recall: generateRecall,
  rhyme: generateRhyme,
};

export const MODE_IDS: ModeId[] = ["numbers", "switch", "react", "recall", "rhyme"];
