import { createStore, del, get, set } from "idb-keyval";
import type { Activity, DifficultyBias, DurationChoice, ModeChoice, ModeId, SessionResult } from "../engine/types";
import type { DifficultyState } from "../engine/difficulty";

export type Distance = "hand" | "arm";
export type IntervalChoice = "off" | "30/30" | "60/60" | "240/60";

export interface UserPrefs {
  sound: boolean;
  haptics: boolean;
  reducedMotion: boolean;
  difficultyBias: DifficultyBias;
  /** Read each challenge aloud. */
  speak: boolean;
  /** Eyes-free: also read the answers with their positions, and use big halves and quarters. */
  eyesFree: boolean;
  /** Answer by voice where the challenge allows it. */
  voiceAnswers: boolean;
  /** Arm's length scales the session up for phones mounted further away. */
  distance: Distance;
  /** Asphalt background with the activity color on the stimulus, for night sessions. */
  darkSessions: boolean;
  /** Ask how you feel before and after. */
  moodCheckIn: boolean;
  /** Sessions per week for the ring on Home. */
  weeklyGoal: number;
  /** For heart-rate zones. */
  maxHr: number;
  /** Native apps: write each session to Apple Health or Health Connect. */
  logToHealth: boolean;
  /** How much every press answers back: tick, haptic and press motion. */
  feedback: "off" | "standard" | "strong";
}

export interface SessionSetup {
  activity: Activity;
  mode: ModeChoice;
  duration: DurationChoice;
  /** The modes Mix rotates through (at least two). */
  mixModes: ModeId[];
  intervals: IntervalChoice;
  /** With intervals on: play during the work bouts, or during recovery. */
  playDuring: "work" | "rest";
}

export interface Flags {
  onboarded: boolean;
  installOffered: boolean;
  /** Modes that have shown their first-time coach line. */
  seenModes: ModeId[];
  pauseHintShown: boolean;
  lastBackupAt: number | null;
  /** Modes whose "play it seated" reminder has already shown once. */
  motionNudged: ModeChoice[];
  /** The one-time tip pointing at Read aloud and Eyes-free. */
  featureTipShown: boolean;
}

export type PersistedProgress = Partial<Record<ModeId, DifficultyState>>;

export const ALL_MODES: ModeId[] = ["numbers", "switch", "react", "recall", "rhyme", "nback", "estimate", "rotate"];

export const DEFAULT_PREFS: UserPrefs = {
  sound: true,
  haptics: true,
  reducedMotion: false,
  difficultyBias: "standard",
  speak: false,
  eyesFree: false,
  voiceAnswers: false,
  distance: "hand",
  darkSessions: false,
  moodCheckIn: false,
  weeklyGoal: 3,
  maxHr: 185,
  logToHealth: false,
  feedback: "standard",
};
export const DEFAULT_SETUP: SessionSetup = { activity: "walk", mode: "mix", duration: 20, mixModes: ALL_MODES, intervals: "off", playDuring: "work" };
export const DEFAULT_FLAGS: Flags = {
  onboarded: false,
  installOffered: false,
  seenModes: [],
  pauseHintShown: false,
  lastBackupAt: null,
  motionNudged: [],
  featureTipShown: false,
};

// IndexedDB can be unavailable (private windows, storage pressure). Every call degrades
// to an in-memory copy and reports the failure once so the app can say so quietly.
let idb: ReturnType<typeof createStore> | null = null;
function store() {
  if (!idb) idb = createStore("cardiobrain", "cardiobrain-data");
  return idb;
}
const memory = new Map<string, unknown>();
let failureListener: (() => void) | null = null;
let failed = false;
export function onStorageFailure(listener: () => void): void {
  failureListener = listener;
  if (failed) listener();
}
function reportFailure() {
  if (!failed) {
    failed = true;
    failureListener?.();
  }
}

async function read<T>(key: string): Promise<T | undefined> {
  try {
    return (await get<T>(key, store())) ?? (memory.get(key) as T | undefined);
  } catch {
    reportFailure();
    return memory.get(key) as T | undefined;
  }
}

async function write(key: string, value: unknown): Promise<void> {
  memory.set(key, value);
  try {
    await set(key, value, store());
  } catch {
    reportFailure();
  }
}

async function remove(key: string): Promise<void> {
  memory.delete(key);
  try {
    await del(key, store());
  } catch {
    reportFailure();
  }
}

export const loadHistory = async () => (await read<SessionResult[]>("history")) ?? [];
export const saveHistory = (history: SessionResult[]) => write("history", history.slice(0, 300));
export const loadActiveSession = <T>() => read<T>("active-session");
export const saveActiveSession = (snapshot: unknown) => write("active-session", snapshot);
export const clearActiveSession = () => remove("active-session");
export const clearHistory = () => remove("history");

function readLocal<T extends object>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<T>) } : { ...fallback };
  } catch {
    return { ...fallback };
  }
}
function writeLocal(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Preferences live in memory for this visit.
  }
}

export const loadPrefs = () => readLocal("cb-prefs", DEFAULT_PREFS);
export const savePrefs = (prefs: UserPrefs) => writeLocal("cb-prefs", prefs);
export const loadSetup = () => readLocal("cb-setup", DEFAULT_SETUP);
export const saveSetup = (setup: SessionSetup) => writeLocal("cb-setup", setup);
export const loadFlags = () => readLocal("cb-flags", DEFAULT_FLAGS);
export const saveFlags = (flags: Flags) => writeLocal("cb-flags", flags);
export const loadProgress = () => readLocal<PersistedProgress>("cb-progress", {});
export const saveProgress = (progress: PersistedProgress) => writeLocal("cb-progress", progress);

export function clearLocal(): void {
  try {
    for (const key of ["cb-prefs", "cb-setup", "cb-flags", "cb-progress"]) localStorage.removeItem(key);
  } catch {
    // Nothing stored.
  }
}

export interface ExportPayload {
  app: "CardioBrain";
  history: SessionResult[];
  progress?: PersistedProgress;
  prefs?: Partial<UserPrefs>;
  setup?: Partial<SessionSetup>;
}

/** Validate an export file. Returns the payload, or a plain reason it can't be used. */
export function parseImport(text: string): ExportPayload | string {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return "That file isn't a CardioBrain export.";
  }
  const d = data as Partial<ExportPayload>;
  if (!d || d.app !== "CardioBrain" || !Array.isArray(d.history)) return "That file isn't a CardioBrain export.";
  const ok = d.history.every((h) => h && typeof h.id === "string" && typeof h.accuracy === "number" && typeof h.startedAt === "number");
  if (!ok) return "That export is damaged. Nothing was imported.";
  return d as ExportPayload;
}

/** Merge imported sessions into existing history: no duplicates, newest first. */
export function mergeHistory(current: SessionResult[], incoming: SessionResult[]): { history: SessionResult[]; added: number } {
  const seen = new Set(current.map((h) => h.id));
  const fresh = incoming.filter((h) => !seen.has(h.id));
  const history = [...current, ...fresh].sort((a, b) => b.startedAt - a.startedAt);
  return { history, added: fresh.length };
}

export function exportData(payload: object): void {
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), app: "CardioBrain", ...payload }, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cardiobrain-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
