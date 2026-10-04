import type { Challenge, Generator } from "../../engine/types";
import { pick, shuffle, type Rng } from "../../engine/rng";
import { targetResponseMs } from "../../engine/difficulty";

const MINUS = "−";
const fmt = (n: number) => (n < 0 ? `${MINUS}${Math.abs(n)}` : String(n));

/** Near misses a tired brain would actually pick: off by one, off by ten, digits swapped. */
export function plausibleDistractors(answer: number, count: number, rng: Rng): number[] {
  const near: number[] = [answer + 1, answer - 1, answer + 10, answer - 10];
  const digits = String(Math.abs(answer));
  if (digits.length === 2 && digits[0] !== digits[1]) {
    const swapped = Number(digits[1]! + digits[0]!);
    near.push(answer < 0 ? -swapped : swapped);
  }
  const unique = [...new Set(near.filter((n) => n !== answer && n >= 0))];
  const chosen = shuffle(unique, rng).slice(0, count);
  let spread = 2;
  while (chosen.length < count) {
    const candidate = answer + (rng() < 0.5 ? -spread : spread);
    if (candidate >= 0 && candidate !== answer && !chosen.includes(candidate)) chosen.push(candidate);
    spread += 1;
  }
  return chosen;
}

function problem(level: number, rng: Rng): { question: string; answer: number } {
  const max = Math.min(99, 6 + level * 5);
  const ops = level < 4 ? ["+", "-"] : level < 9 ? ["+", "-", "×"] : ["+", "-", "×", "÷"];
  const op = pick(ops, rng);
  let a = 1 + Math.floor(rng() * max);
  let b = 1 + Math.floor(rng() * Math.min(max, 40));
  let answer: number;
  if (op === "+") answer = a + b;
  else if (op === "-") {
    if (b > a) [a, b] = [b, a];
    answer = a - b;
  } else if (op === "×") {
    const span = Math.min(11, 3 + Math.floor(level / 2));
    a = 2 + Math.floor(rng() * span);
    b = 2 + Math.floor(rng() * span);
    answer = a * b;
  } else {
    b = 2 + Math.floor(rng() * Math.min(9, 3 + Math.floor(level / 3)));
    answer = 2 + Math.floor(rng() * Math.min(12, 4 + Math.floor(level / 2)));
    a = b * answer;
  }
  const opText = op === "-" ? MINUS : op;
  // Two-step problems from level 12: the first result plus or minus a small number.
  if (level >= 12 && rng() < 0.4) {
    const c = 2 + Math.floor(rng() * 8);
    const add = rng() < 0.5 || answer - c < 0;
    return {
      question: `${a} ${opText} ${b} ${add ? "+" : MINUS} ${c}`,
      answer: add ? answer + c : answer - c,
    };
  }
  return { question: `${a} ${opText} ${b}`, answer };
}

/** "47 × 3 − 2" read aloud: "47 times 3, minus 2". */
export function spoken(question: string): string {
  return question.replace(/×/g, "times").replace(/÷/g, "divided by").replace(/\+/g, "plus").replace(new RegExp(MINUS, "g"), "minus");
}

export const generateNumbers: Generator = (level, rng, ctx): Challenge => {
  const { question, answer } = problem(level, rng);
  const count = level < 6 ? 2 : 4;
  const values = shuffle([answer, ...plausibleDistractors(answer, count - 1, rng)], rng);
  return {
    id: `numbers-${ctx.trialIndex}-${level}`,
    mode: "numbers",
    level,
    cue: "",
    prompt: question,
    options: values.map((v) => ({ id: `n${v}`, label: fmt(v) })),
    correctAnswer: `n${answer}`,
    targetRt: targetResponseMs("numbers", level, ctx.activity, ctx.bias),
    speech: spoken(question),
    voice: true,
    data: { answer },
  };
};
