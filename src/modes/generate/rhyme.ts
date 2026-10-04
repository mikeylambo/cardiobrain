import type { Challenge, Generator } from "../../engine/types";
import { pick, shuffle, type Rng } from "../../engine/rng";
import { targetResponseMs } from "../../engine/difficulty";
import { buildIndex, compareRimes, finalSlant, rhymes, soundsSame, syllables, type RhymeIndex, type WordEntry } from "../rhyme-engine";

export type RhymeType = "perfect" | "slant" | "odd" | "chain";
export const RHYME_TYPES: RhymeType[] = ["perfect", "slant", "odd", "chain"];

const MAX_LETTERS = 10;

interface Pools {
  index: RhymeIndex;
  /** Families of mutually rhyming, distinct-sounding common words, keyed by rhyme key. */
  families: WordEntry[][];
  monoFamilies: WordEntry[][];
  multiFamilies: WordEntry[][];
  slantTargets: Array<{ target: WordEntry; slants: WordEntry[] }>;
  distractorPool: WordEntry[];
  byEnding: Map<string, WordEntry[]>;
  byLastVowel: Map<string, WordEntry[]>;
}

let pools: Pools | null = null;
let loading: Promise<void> | null = null;

const isCommon = (e: WordEntry) => e.freq >= 5 && e.word.length <= MAX_LETTERS && e.word.length >= 3;
const isUsable = (e: WordEntry) => e.freq >= 5 && e.word.length <= MAX_LETTERS && e.word.length >= 3;

function dedupeSounds(list: WordEntry[]): WordEntry[] {
  const out: WordEntry[] = [];
  for (const e of [...list].sort((a, b) => b.freq - a.freq || a.word.localeCompare(b.word))) {
    if (!out.some((o) => soundsSame(o, e))) out.push(e);
  }
  return out.sort((a, b) => a.id - b.id);
}

function append<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

export function setRhymeData(text: string): void {
  const index = buildIndex(text);
  const families: WordEntry[][] = [];
  for (const members of index.byKey.values()) {
    const common = dedupeSounds(members.filter(isCommon));
    if (common.length >= 3) families.push(common);
  }
  const monoFamilies = families.map((f) => f.filter((e) => syllables(e) === 1)).filter((f) => f.length >= 3);
  const multiFamilies = families
    .filter((f) => f.some((e) => syllables(e) >= 2) && f.filter((e) => syllables(e) >= 2).length >= 3)
    .map((f) => f.filter((e) => syllables(e) >= 2));

  const distractorPool = index.words.filter(isUsable);
  const byEnding = new Map<string, WordEntry[]>();
  const byLastVowel = new Map<string, WordEntry[]>();
  for (const e of distractorPool) {
    const end = e.word.slice(-2);
    append(byEnding, end, e);
    append(byLastVowel, e.lastVowel, e);
  }

  // Slant targets: one-syllable common words with at least one strong slant partner
  // (same vowel, related coda, e.g. time / line) that is not a perfect rhyme.
  const slantTargets: Pools["slantTargets"] = [];
  const monos = index.words.filter((e) => isCommon(e) && syllables(e) === 1);
  const monoByVowel = new Map<string, WordEntry[]>();
  for (const e of monos) append(monoByVowel, e.lastVowel, e);
  for (const target of monos) {
    const slants = (monoByVowel.get(target.lastVowel) ?? []).filter(
      (c) => c.id !== target.id && !soundsSame(c, target) && !rhymes(c, target) && finalSlant(target, c) >= 0.8,
    );
    if (slants.length) slantTargets.push({ target, slants });
  }

  pools = { index, families, monoFamilies, multiFamilies, slantTargets, distractorPool, byEnding, byLastVowel };
}

export const isRhymeReady = () => pools !== null;

/** Fetch and index the word list once. Lazy: only Rhyme sessions and Mix pay for it. */
export function loadRhymeData(): Promise<void> {
  if (pools) return Promise.resolve();
  if (!loading) {
    loading = import("../../data/rhyme-words.txt?url")
      .then((m) => fetch(m.default))
      .then((r) => {
        if (!r.ok) throw new Error(`Rhyme words failed to load (${r.status})`);
        return r.text();
      })
      .then(setRhymeData)
      .catch((err: unknown) => {
        loading = null;
        throw err;
      });
  }
  return loading;
}

function requirePools(): Pools {
  if (!pools) throw new Error("Rhyme data is not loaded");
  return pools;
}

/** A clear non-rhyme for every word in `against`: different final rime, weak slant. */
function isClearMiss(d: WordEntry, against: WordEntry[], slantCeiling: number): boolean {
  for (const a of against) {
    if (d.id === a.id || soundsSame(d, a) || rhymes(d, a)) return false;
    if (compareRimes(a.rimes, d.rimes).depth > 0) return false;
    if (finalSlant(a, d) > slantCeiling) return false;
  }
  return true;
}

/**
 * Near-miss distractors: words that share the anchor's vowel or its spelled ending but
 * not its sound, so the question tests the ear rather than the eye.
 */
function nearMisses(anchor: WordEntry, against: WordEntry[], taken: WordEntry[], count: number, rng: Rng, slantCeiling: number): WordEntry[] | null {
  const p = requirePools();
  const sources = [p.byEnding.get(anchor.word.slice(-2)) ?? [], p.byLastVowel.get(anchor.lastVowel) ?? [], p.distractorPool];
  const chosen: WordEntry[] = [];
  const ok = (d: WordEntry) =>
    isClearMiss(d, against, slantCeiling) && ![...taken, ...chosen].some((t) => t.id === d.id || t.word === d.word || soundsSame(t, d) || rhymes(t, d));
  for (let s = 0; s < sources.length && chosen.length < count; s++) {
    const src = sources[s]!;
    if (!src.length) continue;
    // One spelled-ending near miss at most, so it never becomes a pattern to spot.
    const want = s === 0 ? 1 : count;
    let found = 0;
    for (let tries = 0; tries < 60 && chosen.length < count && found < want; tries++) {
      const d = pick(src, rng);
      if (ok(d)) {
        chosen.push(d);
        found++;
      }
    }
  }
  return chosen.length === count ? chosen : null;
}

interface Built {
  type: RhymeType;
  cue: string;
  prompt: string;
  shown: WordEntry[];
  options: WordEntry[];
  correct: WordEntry;
}

function familyFor(level: number, rng: Rng): WordEntry[] {
  const p = requirePools();
  if (level <= 4) return pick(p.monoFamilies, rng);
  if (level >= 14 && rng() < 0.5) return pick(p.multiFamilies, rng);
  return pick(p.families, rng);
}

function buildPerfect(level: number, rng: Rng): Built | null {
  const fam = familyFor(level, rng);
  const [target, correct] = shuffle(fam, rng) as [WordEntry, WordEntry];
  const misses = nearMisses(target, [target, correct], [target, correct], 3, rng, 0.7);
  if (!misses) return null;
  return { type: "perfect", cue: "Rhymes with", prompt: target.word, shown: [target], options: [correct, ...misses], correct };
}

function buildSlant(_level: number, rng: Rng): Built | null {
  const p = requirePools();
  const { target, slants } = pick(p.slantTargets, rng);
  const correct = pick(slants, rng);
  const misses = nearMisses(target, [target, correct], [target, correct], 3, rng, 0.5);
  if (!misses) return null;
  return { type: "slant", cue: "Closest sound to", prompt: target.word, shown: [target], options: [correct, ...misses], correct };
}

function buildOdd(level: number, rng: Rng): Built | null {
  const fam = familyFor(level, rng);
  const three = shuffle(fam, rng).slice(0, 3);
  const misses = nearMisses(three[0]!, three, three, 1, rng, 0.7);
  if (!misses) return null;
  const odd = misses[0]!;
  return { type: "odd", cue: "Three rhyme. Which one doesn't?", prompt: "Odd one out", shown: [], options: [...three, odd], correct: odd };
}

function buildChain(level: number, rng: Rng): Built | null {
  const fam = familyFor(level, rng);
  const [a, b, c] = shuffle(fam, rng) as [WordEntry, WordEntry, WordEntry];
  const misses = nearMisses(a, [a, b, c], [a, b, c], 3, rng, 0.7);
  if (!misses) return null;
  return { type: "chain", cue: "What comes next?", prompt: `${a.word}, ${b.word}`, shown: [a, b], options: [c, ...misses], correct: c };
}

const BUILDERS: Record<RhymeType, (level: number, rng: Rng) => Built | null> = {
  perfect: buildPerfect,
  slant: buildSlant,
  odd: buildOdd,
  chain: buildChain,
};

export function typeForLevel(level: number, rng: Rng): RhymeType {
  const r = rng();
  if (level <= 3) return "perfect";
  if (level <= 7) return r < 0.6 ? "perfect" : "odd";
  if (level <= 12) return r < 0.35 ? "perfect" : r < 0.65 ? "odd" : "slant";
  return r < 0.25 ? "perfect" : r < 0.45 ? "odd" : r < 0.7 ? "slant" : "chain";
}

/**
 * Exactly one defensible answer, four distinct words, four distinct sounds.
 * Returns a reason when the challenge fails, null when it holds.
 */
export function validateRhyme(type: RhymeType, shown: WordEntry[], options: WordEntry[], correct: WordEntry): string | null {
  if (options.length !== 4) return "needs four options";
  if (new Set(options.map((o) => o.word)).size !== 4) return "duplicate word";
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) if (soundsSame(options[i]!, options[j]!)) return "two options sound the same";
    if (shown.some((s) => s.word === options[i]!.word || soundsSame(s, options[i]!))) return "option repeats the prompt";
  }
  if (!options.includes(correct)) return "correct answer missing";
  const others = options.filter((o) => o !== correct);
  if (type === "perfect") {
    const t = shown[0]!;
    if (!rhymes(t, correct)) return "correct does not rhyme";
    if (others.some((o) => rhymes(t, o))) return "a distractor also rhymes";
  } else if (type === "slant") {
    const t = shown[0]!;
    if (options.some((o) => rhymes(t, o))) return "slant question contains a perfect rhyme";
    const best = finalSlant(t, correct);
    if (others.some((o) => finalSlant(t, o) > 0.5 || finalSlant(t, o) >= best)) return "a distractor is as close";
  } else if (type === "odd") {
    for (const a of others) for (const b of others) if (a !== b && !rhymes(a, b)) return "the three do not rhyme";
    if (others.some((o) => rhymes(o, correct))) return "odd word rhymes";
  } else {
    const [a, b] = shown as [WordEntry, WordEntry];
    if (!rhymes(a, b) || !rhymes(a, correct) || !rhymes(b, correct)) return "chain is broken";
    if (others.some((o) => rhymes(o, a) || rhymes(o, b))) return "a distractor continues the chain";
  }
  return null;
}

export function buildRhyme(type: RhymeType, level: number, rng: Rng): Built {
  for (let attempt = 0; attempt < 40; attempt++) {
    const built = BUILDERS[type](level, rng);
    if (built && validateRhyme(built.type, built.shown, built.options, built.correct) === null) return built;
  }
  throw new Error(`Could not build a ${type} rhyme challenge`);
}

export const generateRhyme: Generator = (level, rng, ctx): Challenge => {
  const type = typeForLevel(level, rng);
  const built = buildRhyme(type, level, rng);
  const options = shuffle(built.options, rng);
  return {
    id: `rhyme-${ctx.trialIndex}-${level}`,
    mode: "rhyme",
    level,
    cue: built.cue,
    prompt: built.prompt,
    options: options.map((o) => ({ id: `w-${o.word}`, label: o.word })),
    correctAnswer: `w-${built.correct.word}`,
    targetRt: targetResponseMs("rhyme", level, ctx.activity, ctx.bias),
    data: { type: built.type, shown: built.shown.map((s) => s.word) },
  };
};
