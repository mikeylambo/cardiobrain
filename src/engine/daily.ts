import type { ModeId } from "./types";
import { hashSeed } from "./rng";
import { mixModeAt } from "./mix";

export const DAILY_SECONDS = 180;
export const DAILY_BLOCK_MS = 30_000;
export const DAILY_MODES: ModeId[] = ["numbers", "switch", "react", "recall", "rhyme", "nback", "estimate", "rotate"];

/** Local calendar date, YYYY-MM-DD: everyone on the same day gets the same challenge. */
export function dailyKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Day number since launch, for "Daily #42". */
export function dailyNumber(key: string): number {
  const start = Date.UTC(2026, 9, 1);
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  return Math.floor((Date.UTC(y, m - 1, d) - start) / 86_400_000) + 1;
}

export const dailySeed = (key: string) => hashSeed(["daily", key]);

/** Six 30-second blocks, each a different mode, the difficulty stepping up each block, identical for everyone. */
export const dailyModeAt = (key: string, block: number) => mixModeAt(dailySeed(key), block, DAILY_MODES);
export const dailyLevel = (block: number) => Math.min(20, 3 + block * 2);
export const dailyModes = (key: string) => Array.from({ length: DAILY_SECONDS / (DAILY_BLOCK_MS / 1000) }, (_, b) => dailyModeAt(key, b));
