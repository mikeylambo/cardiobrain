let lock: WakeLockSentinel | null = null;

export async function requestWakeLock(): Promise<boolean> {
  if (!("wakeLock" in navigator)) return false;
  try {
    lock = await navigator.wakeLock.request("screen");
    lock.addEventListener("release", () => { lock = null; });
    return true;
  } catch {
    return false;
  }
}

export async function releaseWakeLock(): Promise<void> {
  try {
    await lock?.release();
  } catch {
    // Already released.
  } finally {
    lock = null;
  }
}

export function isWakeLockSupported(): boolean {
  return "wakeLock" in navigator;
}
