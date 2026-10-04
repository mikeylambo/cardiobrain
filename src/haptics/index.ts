// Haptics: Capacitor Haptics in the native app (distinct impact styles per event),
// navigator.vibrate on the web where it exists. iOS Safari has neither, so sound and
// visuals always carry feedback on their own.
import { isNative } from "../platform/native";

let enabled = true;
export function setHapticsEnabled(on: boolean): void {
  enabled = on;
}

type NativeHaptics = typeof import("@capacitor/haptics");
let native: Promise<NativeHaptics> | null = null;
const plugin = () => (native ??= import("@capacitor/haptics"));

function web(pattern: number | number[]): void {
  try {
    if ("vibrate" in navigator) navigator.vibrate(pattern);
  } catch {
    // Enhancement only.
  }
}

type Kind = "light" | "medium" | "heavy" | "success" | "warning" | "selection";

function fire(kind: Kind, pattern: number | number[]): void {
  if (!enabled) return;
  if (!isNative) {
    web(pattern);
    return;
  }
  void plugin()
    .then(({ Haptics, ImpactStyle, NotificationType }) => {
      if (kind === "success") return Haptics.notification({ type: NotificationType.Success });
      if (kind === "warning") return Haptics.notification({ type: NotificationType.Warning });
      if (kind === "selection") return Haptics.selectionChanged();
      const style = kind === "heavy" ? ImpactStyle.Heavy : kind === "medium" ? ImpactStyle.Medium : ImpactStyle.Light;
      return Haptics.impact({ style });
    })
    .catch(() => undefined);
}

export const haptics = {
  tick: () => fire("light", 12),
  go: () => fire("medium", 24),
  correct: () => fire("light", 10),
  wrong: () => fire("warning", [10, 40, 10]),
  streak: () => fire("success", [12, 30, 12, 30, 20]),
  switch: () => fire("medium", 18),
  tap: () => fire("selection", 6),
  tapStrong: () => fire("light", 14),
  test: () => fire("heavy", [20, 60, 20]),
};
