export function vibrate(pattern: number | number[]): void {
  try {
    if ("vibrate" in navigator) navigator.vibrate(pattern);
  } catch {
    // Haptics are enhancement-only.
  }
}

export const haptics = {
  countdown: (finalPulse = false) => vibrate(finalPulse ? 22 : 12),
  correct: () => vibrate(9),
  wrong: () => vibrate([8, 34, 8]),
  milestone: () => vibrate([10, 24, 10, 24, 18])
};
