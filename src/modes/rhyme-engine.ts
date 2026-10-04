// Rhyme engine for Rhyme Rush.
//
// Ported from Barsmith's offline rhyme service (src/services/rhyme.js in
// mikeylambo/barsmith): the same compact CMU encoding, the same rime-by-rime
// comparison from the end of the word, and the same phonetic similarity groups. What
// changes is the job. Barsmith lists every rhyme a writer might want; CardioBrain has
// to build four-option questions where exactly one answer is defensible, so this module
// adds a symmetric `rhymes()` relation and a slant score the generators can hold a
// clear gap against.
//
// Pronunciations: CMU Pronouncing Dictionary (BSD-2-clause), see src/data/PRONUNCIATION-LICENSE.

// Must match the build script's ALPHABET, index for index.
const ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLM";
const PHONEMES = [
  "AA",
  "AE",
  "AH",
  "AO",
  "AW",
  "AY",
  "B",
  "CH",
  "D",
  "DH",
  "EH",
  "ER",
  "EY",
  "F",
  "G",
  "HH",
  "IH",
  "IY",
  "JH",
  "K",
  "L",
  "M",
  "N",
  "NG",
  "OW",
  "OY",
  "P",
  "R",
  "S",
  "SH",
  "T",
  "TH",
  "UH",
  "UW",
  "V",
  "W",
  "Y",
  "Z",
  "ZH",
] as const;
const CH_OF: Record<string, string> = Object.fromEntries(PHONEMES.map((p, i) => [p, ALPHABET[i]!]));
const VOWEL_CHARS = new Set(PHONEMES.filter((p) => "AEIOU".includes(p[0]!)).map((p) => CH_OF[p]!));
const isVowel = (ch: string) => VOWEL_CHARS.has(ch);

const GROUPS = [
  ["P", "T", "K"],
  ["B", "D", "G"],
  ["CH", "JH"],
  ["F", "TH", "S", "SH", "HH"],
  ["V", "DH", "Z", "ZH"],
  ["M", "N", "NG"],
  ["L", "R"],
  ["W", "Y"],
  ["IY", "IH", "EY", "EH", "AE"],
  ["AH", "ER"],
  ["UW", "UH", "OW", "AO", "AA"],
  ["AY", "AW", "OY"],
];
const VOICING_PAIRS = [
  ["P", "B"],
  ["T", "D"],
  ["K", "G"],
  ["CH", "JH"],
  ["F", "V"],
  ["TH", "DH"],
  ["S", "Z"],
  ["SH", "ZH"],
];

const SIMILARITY = (() => {
  const sim = new Map<string, number>();
  const key = (a: string, b: string) => (a < b ? a + b : b + a);
  const set = (an: string, bn: string, v: number) => {
    const a = CH_OF[an];
    const b = CH_OF[bn];
    if (!a || !b) throw new Error(`unknown phoneme ${an}/${bn}`);
    if (a !== b && (sim.get(key(a, b)) ?? 0) < v) sim.set(key(a, b), v);
  };
  for (const group of GROUPS) for (const a of group) for (const b of group) set(a, b, 0.5);
  for (const [a, b] of VOICING_PAIRS) set(a!, b!, 0.75);
  return sim;
})();

function phoneSim(a: string, b: string): number {
  if (a === b) return 1;
  return SIMILARITY.get(a < b ? a + b : b + a) ?? 0;
}

function codaSim(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0.15;
  const n = Math.min(a.length, b.length);
  let total = 0;
  let weightSum = 0;
  for (let i = 1; i <= n; i++) {
    const w = 1 / i;
    total += phoneSim(a[a.length - i]!, b[b.length - i]!) * w;
    weightSum += w;
  }
  return (total / weightSum) * (n / Math.max(a.length, b.length));
}

export interface Rime {
  v: string;
  stress: string;
  coda: string;
}

export interface WordEntry {
  id: number;
  word: string;
  enc: string;
  freq: number;
  onset: string;
  rimes: Rime[];
  /** Everything from the word's own primary stress to the end: its rhyme key. */
  key: string;
  /** Final rime only. */
  tail1: string;
  /** Vowel of the final rime. */
  lastVowel: string;
}

function toRimes(enc: string): { rimes: Rime[]; onset: string } {
  const rimes: Rime[] = [];
  let onset = "";
  let i = 0;
  while (i < enc.length) {
    const ch = enc[i]!;
    if (isVowel(ch)) {
      rimes.push({ v: ch, stress: enc[i + 1] ?? "0", coda: "" });
      i += 2;
    } else {
      if (rimes.length === 0) onset += ch;
      else rimes[rimes.length - 1]!.coda += ch;
      i += 1;
    }
  }
  return { rimes, onset };
}

const MAX_TAIL = 4;

function stressedFromEnd(rimes: Rime[]): number {
  for (let i = rimes.length - 1; i >= 0; i--) if (rimes[i]!.stress === "1") return rimes.length - i;
  return 1;
}

const tailKey = (rimes: Rime[], n: number) =>
  rimes
    .slice(rimes.length - n)
    .map((r) => r.v + r.coda)
    .join("|");

const stressAgrees = (x: string, y: string) => x === "2" || y === "2" || (x !== "0") === (y !== "0");

function depthNeeded(rimes: Rime[]): number {
  return Math.min(stressedFromEnd(rimes), MAX_TAIL, rimes.length);
}

export interface RhymeIndex {
  words: WordEntry[];
  byWord: Map<string, WordEntry>;
  byKey: Map<string, WordEntry[]>;
  byTail1: Map<string, WordEntry[]>;
  byLastVowel: Map<string, WordEntry[]>;
}

export function buildIndex(text: string): RhymeIndex {
  const words: WordEntry[] = [];
  const byWord = new Map<string, WordEntry>();
  const byKey = new Map<string, WordEntry[]>();
  const byTail1 = new Map<string, WordEntry[]>();
  const byLastVowel = new Map<string, WordEntry[]>();
  const push = (map: Map<string, WordEntry[]>, k: string, e: WordEntry) => {
    const list = map.get(k);
    if (list) list.push(e);
    else map.set(k, [e]);
  };

  for (const line of text.split("\n")) {
    const sp = line.indexOf(" ");
    if (sp < 0) continue;
    const word = line.slice(0, sp);
    const rest = line.slice(sp + 1);
    const enc = rest.slice(0, -1);
    const freq = Number(rest[rest.length - 1]);
    const { rimes, onset } = toRimes(enc);
    if (!rimes.length || byWord.has(word)) continue;
    const entry: WordEntry = {
      id: words.length,
      word,
      enc,
      freq,
      onset,
      rimes,
      key: tailKey(rimes, depthNeeded(rimes)),
      tail1: tailKey(rimes, 1),
      lastVowel: rimes[rimes.length - 1]!.v,
    };
    words.push(entry);
    byWord.set(word, entry);
    push(byKey, entry.key, entry);
    push(byTail1, entry.tail1, entry);
    push(byLastVowel, entry.lastVowel, entry);
  }
  return { words, byWord, byKey, byTail1, byLastVowel };
}

/** Does b's ending reproduce a's stressed tail? (Barsmith's perfect-rhyme test, one direction.) */
function tailCovers(a: WordEntry, b: WordEntry): boolean {
  const d = depthNeeded(a.rimes);
  if (b.rimes.length < d) return false;
  if (tailKey(b.rimes, d) !== tailKey(a.rimes, d)) return false;
  return stressAgrees(a.rimes[a.rimes.length - 1]!.stress, b.rimes[b.rimes.length - 1]!.stress);
}

/** Same sound, or the same sound plus the same onset: a homophone, not a rhyme. */
export function soundsSame(a: WordEntry, b: WordEntry): boolean {
  if (a.enc === b.enc) return true;
  return a.onset === b.onset && a.key === b.key && a.rimes.length === b.rimes.length;
}

/**
 * Perfect rhyme, symmetric. True when either word's stressed tail reappears at the end
 * of the other (so `time`/`lifetime` count), and they are not the same sound twice.
 */
export function rhymes(a: WordEntry, b: WordEntry): boolean {
  if (a.id === b.id || soundsSame(a, b)) return false;
  return tailCovers(a, b) || tailCovers(b, a);
}

/** How far the endings agree: depth = whole trailing rimes identical; score adds the first near miss. */
export function compareRimes(a: Rime[], b: Rime[]): { depth: number; score: number } {
  let depth = 0;
  let score = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 1; i <= n; i++) {
    const ra = a[a.length - i]!;
    const rb = b[b.length - i]!;
    const vs = phoneSim(ra.v, rb.v);
    if (vs === 0) break;
    const cs = codaSim(ra.coda, rb.coda);
    if (vs === 1 && cs === 1) depth++;
    else {
      score += (vs * 0.6 + cs * 0.4) / i;
      break;
    }
    score += 1 / i;
  }
  return { depth, score };
}

/**
 * Slant closeness on the final syllable, 0 to 1. A perfect match on the final rime
 * returns 1; the same vowel with a related coda (`time`/`line`) lands around 0.8;
 * an unrelated vowel returns 0.
 */
export function finalSlant(a: WordEntry, b: WordEntry): number {
  const ra = a.rimes[a.rimes.length - 1]!;
  const rb = b.rimes[b.rimes.length - 1]!;
  const vs = phoneSim(ra.v, rb.v);
  if (vs === 0) return 0;
  return vs * 0.6 + codaSim(ra.coda, rb.coda) * 0.4;
}

export const syllables = (e: WordEntry) => e.rimes.length;
