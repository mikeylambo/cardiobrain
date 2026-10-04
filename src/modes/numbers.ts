import { motion } from "framer-motion";
import type { Challenge, ModeDefinition } from "../engine/types";
import { pick, shuffle } from "../engine/rng";
import { targetResponseMs } from "../engine/difficulty";

function makeId(prefix: string, level: number, salt: number): string {
  return `numbers-${prefix}-${level}-${salt}`;
}

function plausibleDistractors(answer: number, count: number, rng: () => number): number[] {
  const candidates = new Set<number>();
  const text = String(Math.abs(answer));
  const swaps = text.length > 1 ? text.split("").map((_, i) => {
    const chars = text.split("");
    [chars[i], chars[(i + 1) % chars.length]] = [chars[(i + 1) % chars.length], chars[i]!];
    const n = Number(chars.join(""));
    return answer < 0 ? -n : n;
  }) : [];
  for (const value of [answer - 1, answer + 1, answer - 10, answer + 10, ...swaps]) {
    if (Number.isFinite(value) && value !== answer) candidates.add(value);
  }
  while (candidates.size < count) {
    const delta = Math.max(2, Math.round((rng() * 2 - 1) * Math.max(3, Math.abs(answer) * 0.18)));
    const value = answer + delta;
    if (value !== answer) candidates.add(value);
  }
  return shuffle([...candidates].slice(0, count), rng);
}

function problemForLevel(level: number, rng: () => number): { question: string; answer: number } {
  const max = Math.min(99, 5 + level * 6);
  const ops = level < 4 ? ["+", "-"] : level < 9 ? ["+", "-", "×"] : ["+", "-", "×", "÷"];
  const op = pick(ops, rng);
  let a = 1 + Math.floor(rng() * max);
  let b = 1 + Math.floor(rng() * Math.min(max, 35));
  let answer = 0;
  if (op === "+") answer = a + b;
  if (op === "-") {
    if (b > a) [a, b] = [b, a];
    answer = a - b;
  }
  if (op === "×") {
    a = 2 + Math.floor(rng() * Math.min(14, 3 + Math.floor(level / 2)));
    b = 2 + Math.floor(rng() * Math.min(14, 3 + Math.floor(level / 2)));
    answer = a * b;
  }
  if (op === "÷") {
    b = 2 + Math.floor(rng() * Math.min(10, 3 + Math.floor(level / 3)));
    answer = 2 + Math.floor(rng() * Math.min(18, 4 + level));
    a = b * answer;
  }
  if (level >= 7 && rng() > 0.45) {
    const c = 2 + Math.floor(rng() * Math.min(9, 2 + Math.floor(level / 3)));
    const second = rng() > 0.5 ? "+" : "−";
    const displayAnswer = second === "+" ? answer + c : answer - c;
    return { question: `(${a} ${op} ${b}) ${second} ${c}`, answer: displayAnswer };
  }
  return { question: `${a} ${op} ${b}`, answer };
}

export const numbersMode: ModeDefinition = {
  id: "numbers",
  group: "core",
  label: "Numbers",
  shortLabel: "NUMBERS",
  description: "Fast mental arithmetic with plausible near-miss answers.",
  generate: (level, rng, ctx): Challenge => {
    const { question, answer } = problemForLevel(level, rng);
    const choiceCount = level < 6 ? 2 : level < 13 ? 3 : 4;
    const distractors = plausibleDistractors(answer, choiceCount - 1, rng);
    const options = shuffle([
      { id: `answer-${answer}`, label: String(answer), tone: "accent" as const },
      ...distractors.map((value) => ({ id: `answer-${value}`, label: String(value), tone: "neutral" as const }))
    ], rng);
    return {
      id: makeId("calc", level, ctx.trialIndex),
      mode: "numbers",
      kind: "numbers",
      level,
      prompt: question,
      options,
      correctAnswer: `answer-${answer}`,
      targetRt: targetResponseMs("numbers", level, ctx.activity, ctx.bias),
      data: { answer }
    };
  },
  View: ({ challenge, onAnswer }) => (
    <div className="mode-view">
      <div className="eyebrow">SOLVE</div>
      <motion.div className="number-stimulus" initial={{opacity:0,scale:.96}} animate={{opacity:1,scale:1}} key={challenge.id}>
        {challenge.prompt}
      </motion.div>
      <div className="answer-grid answer-grid-choices">
        {challenge.options.map((option) => (
          <motion.button key={option.id} className="answer-pad" whileTap={{scale:.96}} onClick={() => onAnswer(option.id)} aria-label={`Answer ${option.label}`}>
            {option.label}
          </motion.button>
        ))}
      </div>
    </div>
  )
};
