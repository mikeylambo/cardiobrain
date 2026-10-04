import type { AnswerOption } from "../engine/types";

const ONES: Record<string, number> = {
  zero: 0,
  oh: 0,
  one: 1,
  two: 2,
  to: 2,
  too: 2,
  three: 3,
  four: 4,
  for: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  ate: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

/**
 * Turn spoken numbers into digits: "twenty three" → "23", "a hundred and four" → "104",
 * "minus five" → "-5". Recognisers often return digits already; those pass through.
 */
export function normalizeNumbers(text: string): string {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const out: string[] = [];
  let i = 0;
  while (i < words.length) {
    let neg = false;
    let j = i;
    if ((words[j] === "minus" || words[j] === "negative") && j + 1 < words.length) {
      neg = true;
      j++;
    }
    let value: number | null = null;
    let consumed = j;
    const w = words[j]!;
    if (/^-?\d+$/.test(w)) {
      value = Number(w);
      consumed = j + 1;
    } else if (w === "hundred" || ((w === "a" || w === "one") && words[j + 1] === "hundred")) {
      value = 100;
      consumed = w === "hundred" ? j + 1 : j + 2;
      if (words[consumed] === "and") consumed++;
      const rest = readUnder100(words, consumed);
      if (rest) {
        value += rest.value;
        consumed = rest.next;
      }
    } else {
      const under = readUnder100(words, j);
      if (under) {
        value = under.value;
        consumed = under.next;
        if (words[consumed] === "hundred") {
          value *= 100;
          consumed++;
          if (words[consumed] === "and") consumed++;
          const rest = readUnder100(words, consumed);
          if (rest) {
            value += rest.value;
            consumed = rest.next;
          }
        }
      }
    }
    if (value === null) {
      out.push(words[i]!);
      i++;
    } else {
      out.push(String(neg ? -value : value));
      i = consumed;
    }
  }
  return out.join(" ");
}

function readUnder100(words: string[], j: number): { value: number; next: number } | null {
  const w = words[j];
  if (!w) return null;
  if (w in TENS) {
    const tens = TENS[w]!;
    const unit = words[j + 1];
    if (unit && unit in ONES && ONES[unit]! > 0 && ONES[unit]! < 10) return { value: tens + ONES[unit]!, next: j + 2 };
    const hyphen = w.split("-");
    return { value: tens, next: j + 1 + (hyphen.length > 1 ? 0 : 0) };
  }
  if (w.includes("-")) {
    const [a, b] = w.split("-");
    if (a && b && a in TENS && b in ONES) return { value: TENS[a]! + ONES[b]!, next: j + 1 };
  }
  if (w in ONES) return { value: ONES[w]!, next: j + 1 };
  return null;
}

/**
 * Which option did they say? Matches option labels, their spoken aliases and numbers.
 * When several match, the one said last wins: people correct themselves ("five, no, six").
 * Returns null when nothing matches clearly.
 */
export function matchSpoken(transcript: string, options: AnswerOption[]): string | null {
  const text = ` ${normalizeNumbers(transcript)} `;
  let best: { id: string; at: number } | null = null;
  for (const o of options) {
    const terms = new Set([o.label.toLowerCase(), ...(o.say ?? [])].map((t) => normalizeNumbers(t.replace(/\u2212/g, "-"))));
    for (const term of terms) {
      if (!term) continue;
      const re = new RegExp(`(^|\\s)${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s|$)`, "g");
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        const at = m.index + m[0].length;
        if (!best || at > best.at || (at === best.at && term.length > 0)) best = { id: o.id, at };
      }
    }
  }
  return best?.id ?? null;
}
