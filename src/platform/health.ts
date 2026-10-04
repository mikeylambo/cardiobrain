// Apple Health and Health Connect. Each finished session is written as Mindful Minutes
// (the closest category the platforms offer for focused cognitive work). Native only, off
// by default, and untested until it runs on a device: it needs the HealthKit capability
// switched on in Xcode (see STORE_RELEASE.md).
import type { SessionResult } from "../engine/types";
import { isNative } from "./native";

export const isHealthSupported = () => isNative;

export async function connectHealth(): Promise<boolean> {
  if (!isNative) return false;
  try {
    const { Health } = await import("@capgo/capacitor-health");
    const available = await Health.isAvailable();
    if (!available.available) return false;
    await Health.requestAuthorization({ write: ["mindfulness"] });
    return true;
  } catch {
    return false;
  }
}

export async function logSessionToHealth(r: SessionResult): Promise<void> {
  if (!isNative || r.durationSeconds < 60) return;
  try {
    const { Health } = await import("@capgo/capacitor-health");
    await Health.saveSample({
      dataType: "mindfulness",
      value: Math.round(r.durationSeconds / 60),
      unit: "minute",
      startDate: new Date(r.startedAt).toISOString(),
      endDate: new Date(r.finishedAt).toISOString(),
      metadata: { source: "CardioBrain", mode: r.requestedMode },
    });
  } catch {
    // Health logging is a convenience; a failure never touches the result.
  }
}
