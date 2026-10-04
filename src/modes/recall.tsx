import React from "react";
import { motion } from "framer-motion";
import type { Challenge, ModeDefinition } from "../engine/types";
import { pick, shuffle } from "../engine/rng";
import { targetResponseMs } from "../engine/difficulty";

const symbols = ["●", "▲", "■", "◆", "✦", "✚"];

export const recallMode: ModeDefinition = {
  id: "recall",
  group: "core",
  label: "Recall",
  shortLabel: "RECALL",
  description: "Hold a short sequence. Rebuild it from memory.",
  generate: (level, rng, ctx): Challenge => {
    const length = Math.min(7, 2 + Math.floor((level - 1) / 3));
    const sequence = Array.from({length}, () => pick(symbols, rng));
    const unique = sequence.length >= 5;
    const answerChoices = unique ? [...new Set(sequence)] : shuffle(symbols, rng).slice(0, 4);
    return {
      id: `recall-${level}-${ctx.trialIndex}`,
      mode: "recall",
      kind: "recall",
      level,
      prompt: "MEMORIZE",
      options: answerChoices.map((symbol) => ({ id: symbol, label: symbol })),
      correctAnswer: sequence.join("|"),
      targetRt: targetResponseMs("recall", level, ctx.activity, ctx.bias),
      data: { sequence, displayMs: Math.max(420, 700 - level * 8) }
    };
  },
  View: ({ challenge, onAnswer, onPresented }) => {
    const data = challenge.data as { sequence:string[]; displayMs:number };
    const [index, setIndex] = React.useState(0);
    const [ready, setReady] = React.useState(false);
    const [picked, setPicked] = React.useState<string[]>([]);
    React.useEffect(() => {
      setIndex(0); setReady(false); setPicked([]);
      let cancelled = false;
      const start = window.setTimeout(() => {
        if (!cancelled) {
          let current = 0;
          const tick = () => {
            setIndex(current);
            current += 1;
            if (current >= data.sequence.length) {
              window.setTimeout(() => {
                if (!cancelled) { setReady(true); onPresented(); }
              }, data.displayMs);
              return;
            }
            window.setTimeout(tick, data.displayMs);
          };
          tick();
        }
      }, 80);
      return () => { cancelled = true; window.clearTimeout(start); };
    }, [challenge.id, data.displayMs, data.sequence.length, onPresented]);

    if (!ready) return (
      <div className="mode-view recall-show">
        <div className="eyebrow">MEMORIZE</div>
        <motion.div key={index} initial={{opacity:0,scale:.7}} animate={{opacity:1,scale:1}} className="recall-symbol">{data.sequence[index]}</motion.div>
        <div className="sequence-dots" aria-label={`Item ${Math.min(index + 1, data.sequence.length)} of ${data.sequence.length}`}>
          {data.sequence.map((_, i) => <span className={i === index ? "active" : ""} key={i} />)}
        </div>
      </div>
    );
    const tap = (symbol:string) => {
      const next = [...picked, symbol];
      setPicked(next);
      if (next.length >= data.sequence.length) {
        onAnswer(next.join("|"));
      }
    };
    return (
      <div className="mode-view">
        <div className="eyebrow">REPEAT <span>{picked.length}/{data.sequence.length}</span></div>
        <div className="recall-slots">
          {data.sequence.map((_, i) => <span key={i}>{picked[i] ?? "·"}</span>)}
        </div>
        <div className="answer-grid answer-grid-4 recall-grid">
          {challenge.options.map((option) => (
            <motion.button key={option.id} className="answer-pad symbol-pad" whileTap={{scale:.94}} onClick={() => tap(option.id)} aria-label={`Choose ${option.label}`}>
              {option.label}
            </motion.button>
          ))}
        </div>
      </div>
    );
  }
};
