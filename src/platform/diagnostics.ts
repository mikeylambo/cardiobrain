// An on-device error log, and the plain-text report Settings shares. Nothing is sent anywhere
// unless you share the report yourself.
import { APP_VERSION } from "../changelog";
import type { SessionResult } from "../engine/types";
import { isNative } from "./native";
import { Capacitor } from "@capacitor/core";

const KEY = "cb-errors";
const MAX = 20;
/** Browser noise that says nothing about the app. */
const IGNORE = [/ResizeObserver loop/i, /^Script error\.?$/i];

export interface ErrorEntry {
  at: number;
  where: string;
  message: string;
  stack?: string;
  screen?: string;
}

export function readErrors(): ErrorEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ErrorEntry[]) : [];
  } catch {
    return [];
  }
}

export function clearErrors(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing stored.
  }
}

let currentScreen: () => string | undefined = () => undefined;

export function logError(error: unknown, where: string): void {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : (JSON.stringify(error) ?? String(error));
  if (!message || IGNORE.some((re) => re.test(message))) return;
  const stack = error instanceof Error && error.stack ? error.stack.split("\n").slice(0, 6).join("\n") : undefined;
  const entry: ErrorEntry = { at: Date.now(), where, message: message.slice(0, 300), stack, screen: currentScreen() };
  try {
    localStorage.setItem(KEY, JSON.stringify([entry, ...readErrors()].slice(0, MAX)));
  } catch {
    // Storage full or blocked: the log is best-effort.
  }
}

/** Record uncaught errors and rejected promises from here on. */
export function installErrorCapture(screen: () => string): void {
  currentScreen = screen;
  window.addEventListener("error", (e) => logError(e.error ?? e.message, "window"));
  window.addEventListener("unhandledrejection", (e) => logError(e.reason, "promise"));
}

function platform(): string {
  if (isNative) return Capacitor.getPlatform() === "ios" ? "iPhone app" : "Android app";
  return matchMedia("(display-mode: standalone)").matches ? "Installed web app" : "Browser";
}

const when = (t: number) => new Date(t).toISOString().replace("T", " ").slice(0, 16);

export function buildReport({ note, prefs, history }: { note: string; prefs: object; history: SessionResult[] }): string {
  const last = history[0];
  const errors = readErrors();
  const lines = [
    "CardioBrain problem report",
    "",
    `What happened: ${note.trim() || "(not described)"}`,
    "",
    `Version: ${APP_VERSION}`,
    `Platform: ${platform()}`,
    `Device: ${navigator.userAgent}`,
    `Screen: ${screen.width}x${screen.height} @${devicePixelRatio}x, window ${innerWidth}x${innerHeight}`,
    `Sessions saved: ${history.length}`,
    last
      ? `Last session: ${when(last.finishedAt)}, ${last.activity}, ${last.requestedMode}, ${last.durationSeconds}s, ${last.challenges} challenges, ${Math.round(last.accuracy * 100)}%`
      : "Last session: none",
    `Settings: ${JSON.stringify(prefs)}`,
    "",
    errors.length ? `Errors (${errors.length}, newest first):` : "Errors: none recorded",
    ...errors.flatMap((e) => [
      `- ${when(e.at)} [${e.where}${e.screen ? `, ${e.screen}` : ""}] ${e.message}`,
      ...(e.stack ? [e.stack.replace(/^/gm, "    ")] : []),
    ]),
  ];
  return lines.join("\n");
}
