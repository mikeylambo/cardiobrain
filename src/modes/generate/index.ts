import type { Generator, ModeId } from "../../engine/types";
import { generateNumbers } from "./numbers";
import { generateSwitch } from "./switch";
import { generateReact } from "./react";
import { generateRecall } from "./recall";
import { generateRhyme } from "./rhyme";
import { generateNback } from "./nback";
import { generateEstimate } from "./estimate";
import { generateRotate } from "./rotate";

export const GENERATORS: Record<ModeId, Generator> = {
  numbers: generateNumbers,
  switch: generateSwitch,
  react: generateReact,
  recall: generateRecall,
  rhyme: generateRhyme,
  nback: generateNback,
  estimate: generateEstimate,
  rotate: generateRotate,
};

export const MODE_IDS: ModeId[] = ["numbers", "switch", "react", "recall", "rhyme", "nback", "estimate", "rotate"];
