import React from "react";
import { motion } from "framer-motion";
import type { Challenge, ModeDefinition } from "../engine/types";
import { pick, shuffle } from "../engine/rng";
import { targetResponseMs } from "../engine/difficulty";

export const RECALL_SHAPE_IDS = ["circle","triangle","square","diamond","star","plus"] as const;
type RecallShapeId = typeof RECALL_SHAPE_IDS[number];

const shapeLabels: Record<RecallShapeId,string> = {
  circle: "Circle",
  triangle: "Triangle",
  square: "Square",
  diamond: "Diamond",
  star: "Star",
  plus: "Plus"
};

function ShapeGlyph({id}:{id:string}) {
  if (!(RECALL_SHAPE_IDS as readonly string[]).includes(id)) return null;
  const common = { fill: "currentColor" as const };
  return (
    <svg className="shape-glyph-svg" viewBox="0 0 64 64" aria-hidden="true" focusable="false" data-shape={id}>
      {id === "circle" && <circle cx="32" cy="32" r="22" {...common} />}
      {id === "triangle" && <polygon points="32,7 57,54 7,54" {...common} />}
      {id === "square" && <rect x="10" y="10" width="44" height="44" rx="6" {...common} />}
      {id === "diamond" && <polygon points="32,6 58,32 32,58 6,32" {...common} />}
      {id === "star" && <polygon points="32,5 38.4,24.2 58.7,24.2 42.3,35.8 48.6,55 32,43.2 15.4,55 21.7,35.8 5.3,24.2 25.6,24.2" {...common} />}
      {id === "plus" && <path d="M25 7h14v18h18v14H39v18H25V39H7V25h18V7Z" {...common} />}
    </svg>
  );
}

export const recallMode: ModeDefinition = {
  id: "recall",
  group: "core",
  label: "Recall",
  shortLabel: "RECALL",
  description: "Hold a short sequence. Rebuild it from memory.",
  generate: (level, rng, ctx): Challenge => {
    const length = Math.min(7, 2 + Math.floor((level - 1) / 3));
    const sequence = Array.from({length}, () => pick(RECALL_SHAPE_IDS, rng) as RecallShapeId);
    const options = shuffle(
      RECALL_SHAPE_IDS.map((id) => ({ id, label: shapeLabels[id] })),
      rng
    );
    return {
      id: `recall-${level}-${ctx.trialIndex}`,
      mode: "recall",
      kind: "recall",
      level,
      prompt: "MEMORIZE",
      options,
      correctAnswer: sequence.join("|"),
      targetRt: targetResponseMs("recall", level, ctx.activity, ctx.bias),
      data: { sequence, displayMs: Math.max(420, 700 - level * 8) }
    };
  },
  View: ({ challenge, onAnswer, onPresented }) => {
    const data = challenge.data as { sequence: RecallShapeId[]; displayMs:number };
    const [index, setIndex] = React.useState(0);
    const [ready, setReady] = React.useState(false);
    const [picked, setPicked] = React.useState<string[]>([]);

    React.useEffect(() => {
      let cancelled = false;
      const timers: number[] = [];
      setIndex(0);
      setReady(false);
      setPicked([]);

      const schedule = (fn: () => void, delay: number) => {
        timers.push(window.setTimeout(() => {
          if (!cancelled) fn();
        }, delay));
      };

      let current = 0;
      const showNext = () => {
        setIndex(current);
        if (current + 1 < data.sequence.length) {
          current += 1;
          schedule(showNext, data.displayMs);
          return;
        }
        schedule(() => {
          setReady(true);
          onPresented();
        }, data.displayMs);
      };

      schedule(showNext, 80);

      return () => {
        cancelled = true;
        timers.forEach((timer) => window.clearTimeout(timer));
      };
    }, [challenge.id, data.displayMs, data.sequence.length, onPresented]);

    if (!ready) {
      const activeShape = data.sequence[index];
      return (
        <div className="mode-view recall-show">
          <div className="eyebrow">MEMORIZE</div>
          <motion.div
            key={`${challenge.id}-${index}`}
            initial={{opacity:0,scale:.7}}
            animate={{opacity:1,scale:1}}
            className="recall-symbol"
            aria-label={shapeLabels[activeShape]}
          >
            <ShapeGlyph id={activeShape} />
          </motion.div>
          <div className="sequence-dots" aria-label={`Item ${Math.min(index + 1, data.sequence.length)} of ${data.sequence.length}`}>
            {data.sequence.map((_, i) => <span className={i === index ? "active" : ""} key={i} />)}
          </div>
        </div>
      );
    }

    const tap = (shapeId:string) => {
      if (picked.length >= data.sequence.length) return;
      const next = [...picked, shapeId];
      setPicked(next);
      if (next.length === data.sequence.length) onAnswer(next.join("|"));
    };

    return (
      <div className="mode-view recall-answer-mode">
        <div className="eyebrow">REPEAT <span>{picked.length}/{data.sequence.length}</span></div>
        <div className="recall-slots">
          {data.sequence.map((_, i) => (
            <span key={i}>
              {picked[i] ? <ShapeGlyph id={picked[i]!} /> : "·"}
            </span>
          ))}
        </div>
        <div className="answer-grid answer-grid-4 recall-grid">
          {challenge.options.map((option) => (
            <motion.button
              key={option.id}
              className="answer-pad symbol-pad"
              whileTap={{scale:.94}}
              onClick={() => tap(option.id)}
              aria-label={`Choose ${option.label}`}
            >
              <ShapeGlyph id={option.id} />
            </motion.button>
          ))}
        </div>
      </div>
    );
  }
};
