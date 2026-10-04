import { motion } from "framer-motion";
import type { Challenge, ModeDefinition } from "../engine/types";
import { pick } from "../engine/rng";
import { targetResponseMs } from "../engine/difficulty";

const palette = [
  { id: "teal", word: "TEAL", hexClass: "tone-teal" },
  { id: "amber", word: "AMBER", hexClass: "tone-amber" },
  { id: "violet", word: "VIOLET", hexClass: "tone-violet" },
  { id: "coral", word: "CORAL", hexClass: "tone-coral" }
] as const;

export const switchMode: ModeDefinition = {
  id: "switch",
  group: "core",
  label: "Switch",
  shortLabel: "SWITCH",
  description: "Alternate rules without losing the thread.",
  generate: (level, rng, ctx): Challenge => {
    const rule = ctx.trialIndex % 2 === 0 ? "COLOR" : "WORD";
    const word = pick(palette, rng);
    const ink = pick(palette, rng);
    const safeInk = ink.id === word.id && level > 3 ? pick(palette.filter((item) => item.id !== word.id), rng) : ink;
    const correct = rule === "COLOR" ? safeInk.id : word.id;
    return {
      id: `switch-${level}-${ctx.trialIndex}`,
      mode: "switch",
      kind: "switch",
      level,
      prompt: rule === "COLOR" ? "Name the ink." : "Name the word.",
      options: palette.map((item) => ({ id: item.id, label: item.word, tone: item.id === correct ? "accent" as const : "neutral" as const })),
      correctAnswer: correct,
      targetRt: targetResponseMs("switch", level, ctx.activity, ctx.bias),
      data: { rule, word: word.word, ink: safeInk.id, inkClass: safeInk.hexClass, switchTrial: ctx.trialIndex % 2 === 0 }
    };
  },
  View: ({ challenge, onAnswer }) => {
    const data = challenge.data as { rule:string; word:string; inkClass:string };
    return (
      <div className="mode-view switch-mode">
        <div className="rule-banner">{data.rule}</div>
        <motion.div key={challenge.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className={`switch-stimulus ${data.inkClass}`}>
          {data.word}
        </motion.div>
        <div className="answer-grid answer-grid-4">
          {challenge.options.map((option) => (
            <motion.button key={option.id} className="answer-pad compact" whileTap={{scale:.96}} onClick={() => onAnswer(option.id)} aria-label={option.label}>
              {option.label}
            </motion.button>
          ))}
        </div>
      </div>
    );
  }
};
