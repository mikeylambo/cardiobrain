import React from "react";
import { motion } from "framer-motion";
import type { Challenge, ModeDefinition } from "../engine/types";
import { targetResponseMs } from "../engine/difficulty";

const zones = [
  { id: "zone-0", label: "↖", className: "zone-nw" },
  { id: "zone-1", label: "↗", className: "zone-ne" },
  { id: "zone-2", label: "↙", className: "zone-sw" },
  { id: "zone-3", label: "↘", className: "zone-se" }
] as const;

export const reactMode: ModeDefinition = {
  id: "react",
  group: "core",
  label: "React",
  shortLabel: "REACT",
  description: "See it. Locate it. Tap fast.",
  generate: (level, rng, ctx): Challenge => {
    const index = Math.floor(rng() * zones.length);
    const noGo = level >= 14 && rng() < 0.12;
    const correctAnswer = noGo ? "hold" : zones[index]!.id;
    return {
      id: `react-${level}-${ctx.trialIndex}`,
      mode: "react",
      kind: "react",
      level,
      prompt: noGo ? "HOLD" : "TAP",
      options: [...zones.map((zone) => ({ id: zone.id, label: zone.label })), { id: "hold", label: "HOLD" }],
      correctAnswer,
      targetRt: targetResponseMs("react", level, ctx.activity, ctx.bias),
      data: { zone: zones[index]!.className, noGo }
    };
  },
  View: ({ challenge, onAnswer, onPresented }) => {
    const data = challenge.data as { zone:string; noGo:boolean };
    React.useEffect(() => {
      const frame = requestAnimationFrame(() => onPresented());
      return () => cancelAnimationFrame(frame);
    }, [challenge.id, onPresented]);
    return (
      <div className="mode-view react-mode">
        <div className="eyebrow">{data.noGo ? "HOLD" : "REACT"}</div>
        <div className="react-field">
          {!data.noGo && <motion.div key={challenge.id} initial={{scale:.72,opacity:0}} animate={{scale:1,opacity:1}} className={`react-target ${data.zone}`} aria-hidden="true" />}
          {data.noGo && <motion.div initial={{opacity:0}} animate={{opacity:1}} className="hold-mark">—</motion.div>}
        </div>
        <div className="answer-grid answer-grid-4">
          {zones.map((zone) => (
            <motion.button key={zone.id} className="answer-pad react-pad" whileTap={{scale:.95}} onClick={() => onAnswer(zone.id)} aria-label={`Tap ${zone.id}`}>
              {zone.label}
            </motion.button>
          ))}
          <motion.button className="answer-pad hold-pad" whileTap={{scale:.95}} onClick={() => onAnswer("hold")} aria-label="Hold">
            HOLD
          </motion.button>
        </div>
      </div>
    );
  }
};
