// The one place that knows whether we are inside the Capacitor shell.
// Plugins are imported lazily so the web bundle never pays for them.
import { Capacitor } from "@capacitor/core";

export const isNative = Capacitor.isNativePlatform();

export async function keepAwake(on: boolean): Promise<boolean> {
  if (!isNative) return false;
  try {
    const { KeepAwake } = await import("@capacitor-community/keep-awake");
    if (on) await KeepAwake.keepAwake();
    else await KeepAwake.allowSleep();
    return true;
  } catch {
    return false;
  }
}

/** App pause/resume from the native lifecycle, feeding the same auto-pause logic as visibilitychange. */
export async function onAppStateChange(listener: (active: boolean) => void): Promise<() => void> {
  if (!isNative) return () => undefined;
  const { App } = await import("@capacitor/app");
  const handle = await App.addListener("appStateChange", ({ isActive }) => listener(isActive));
  return () => void handle.remove();
}

export async function setStatusBar(dark: boolean, color: string): Promise<void> {
  if (!isNative) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
    if (Capacitor.getPlatform() === "android") await StatusBar.setBackgroundColor({ color });
  } catch {
    // Not available on this platform.
  }
}

export async function hideSplash(): Promise<void> {
  if (!isNative) return;
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch {
    // Already hidden.
  }
}

/** Native share sheet for the result card: write the PNG to cache, then share its URI. */
export async function shareNative(blob: Blob, text: string): Promise<boolean> {
  if (!isNative) return false;
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  const { Share } = await import("@capacitor/share");
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  const file = await Filesystem.writeFile({ path: `cardiobrain-${Date.now()}.png`, data, directory: Directory.Cache });
  await Share.share({ title: "CardioBrain", text, files: [file.uri] });
  return true;
}

/** Share plain text: the native sheet in the app, the Web Share API in browsers that have it. */
export async function shareText(title: string, text: string): Promise<boolean> {
  try {
    if (isNative) {
      const { Share } = await import("@capacitor/share");
      await Share.share({ title, text });
      return true;
    }
    if (navigator.share) {
      await navigator.share({ title, text });
      return true;
    }
  } catch {
    // Dismissed or unavailable.
  }
  return false;
}
