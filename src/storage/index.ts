import { createStore, del, get, set } from "idb-keyval";
import type { Activity, DifficultyBias, DurationChoice, ModeChoice, ModeId, SessionResult } from "../engine/types";
import type { DifficultyState } from "../engine/difficulty";

export interface UserPrefs {
  sound: boolean;
  haptics: boolean;
  reducedMotion: boolean;
  difficultyBias: DifficultyBias;
}

export interface SessionSetup {
  activity: Activity;
  mode: ModeChoice;
  duration: DurationChoice;
}

export interface Flags {
  onboarded: boolean;
  installOffered: boolean;
}

export type PersistedProgress = Partial<Record<ModeId, DifficultyState>>;

export const DEFAULT_PREFS: UserPrefs = { sound: true, haptics: true, reducedMotion: false, difficultyBias: "standard" };
export const DEFAULT_SETUP: SessionSetup = { activity: "walk", mode: "mix", duration: 20 };
export const DEFAULT_FLAGS: Flags = { onboarded: false, installOffered: false };

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
