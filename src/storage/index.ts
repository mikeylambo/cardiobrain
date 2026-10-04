import { createStore, del, get, set } from "idb-keyval";
import type { SessionResult } from "../engine/types";
import type { ActiveSessionSnapshot, PersistedProgress, UserPrefs } from "../state/store";

const db = createStore("cardiobrain", "cardiobrain-data");
const HISTORY_KEY = "history";
const ACTIVE_KEY = "active-session";
const PREFS_KEY = "prefs";
const PROGRESS_KEY = "progress";

export async function loadHistory(): Promise<SessionResult[]> {
  try { return (await get<SessionResult[]>(HISTORY_KEY, db)) ?? []; } catch { return []; }
}

export async function saveHistory(history: SessionResult[]): Promise<boolean> {
  try { await set(HISTORY_KEY, history.slice(0, 200), db); return true; } catch { return false; }
}

export async function saveActiveSession(active: ActiveSessionSnapshot): Promise<boolean> {
  try { await set(ACTIVE_KEY, active, db); return true; } catch { return false; }
}

export async function loadActiveSession(): Promise<ActiveSessionSnapshot | undefined> {
  try { return await get<ActiveSessionSnapshot>(ACTIVE_KEY, db); } catch { return undefined; }
}

export async function clearActiveSession(): Promise<void> {
  try { await del(ACTIVE_KEY, db); } catch { /* degrade silently */ }
}

export function loadPrefs(): UserPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { sound: true, haptics: true, reducedMotion: false, difficultyBias: "standard", ...JSON.parse(raw) } : { sound:true,haptics:true,reducedMotion:false,difficultyBias:"standard" };
  } catch { return { sound:true,haptics:true,reducedMotion:false,difficultyBias:"standard" }; }
}

export function savePrefs(prefs: UserPrefs): void {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* in-memory fallback */ }
}

export function loadProgress(): PersistedProgress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? JSON.parse(raw) as PersistedProgress : {};
  } catch { return {}; }
}

export function saveProgress(progress: PersistedProgress): void {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch { /* in-memory fallback */ }
}

export async function exportData(history: SessionResult[], progress: PersistedProgress, prefs: UserPrefs): Promise<void> {
  const payload = JSON.stringify({ exportedAt: new Date().toISOString(), app: "CardioBrain", version: "1.0.0", history, progress, prefs }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `cardiobrain-export-${new Date().toISOString().slice(0,10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
