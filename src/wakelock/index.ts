import { isNative, keepAwake } from "../platform/native";

let lock: WakeLockSentinel | null = null;
let wanted = false;

export const isWakeLockSupported = () => isNative || (typeof navigator !== "undefined" && "wakeLock" in navigator);

/** Keep the screen on. Re-acquired automatically when the page becomes visible again. */
export async function requestWakeLock(): Promise<boolean> {
  wanted = true;
  if (isNative) return keepAwake(true);
  if (!("wakeLock" in navigator)) return false;
  if (lock) return true;
  try {
    lock = await navigator.wakeLock.request("screen");
    lock.addEventListener("release", () => {
      lock = null;
    });
    return true;
  } catch {
    return false;
  }
}

export async function releaseWakeLock(): Promise<void> {
  wanted = false;
  if (isNative) {
    await keepAwake(false);
    return;
  }
  try {
    await lock?.release();
  } catch {
    // Already released.
  } finally {
    lock = null;
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && wanted && !lock) void requestWakeLock();
  });
}
