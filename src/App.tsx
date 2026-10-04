import React from "react";
import { flushSync } from "react-dom";
import { setSoundEnabled, sfx, unlockAudio } from "./audio/synth";
import { haptics, setHapticsEnabled } from "./haptics";
import { hideSplash, setStatusBar } from "./platform/native";
import { onStorageFailure } from "./storage";
import { useStore, type Screen } from "./state/store";
import { ErrorBoundary } from "./ui/ErrorBoundary";
import { MoodSheet } from "./ui/MoodSheet";
import { startFromLink } from "./platform/links";
import { HomeScreen } from "./ui/HomeScreen";
import { WelcomeScreen } from "./ui/OnboardingScreen";
import { ResultsScreen } from "./ui/ResultsScreen";
import { SessionScreen } from "./ui/SessionScreen";

// Screens you visit between workouts load on demand; the session path stays in the main bundle.
const HistoryScreen = React.lazy(() => import("./ui/HistoryScreen").then((m) => ({ default: m.HistoryScreen })));
const InsightsScreen = React.lazy(() => import("./ui/InsightsScreen").then((m) => ({ default: m.InsightsScreen })));
const SettingsScreen = React.lazy(() => import("./ui/SettingsScreen").then((m) => ({ default: m.SettingsScreen })));
import { ACTIVITY_COLOR, ACTIVITY_ON } from "./ui/copy";

const PAPER = new Set<Screen>(["history", "settings", "insights"]);
const INK = new Set<Screen>(["welcome", "boot"]);

/** How "deep" each screen sits, to pick a transition: deeper slides in from the right, shallower from the left. */
const DEPTH: Record<Screen, number> = { boot: 0, welcome: 0, home: 1, history: 2, insights: 2, settings: 2, session: 3, results: 4 };
/**
 * Sessions and Results have their own choreography (countdown, wipe, count-up), so view
 * transitions only run between the calm screens. A transition into a live session also
 * risked stalling the countdown behind a transition that never finished.
 */
const OWN_MOTION = new Set<Screen>(["session", "results", "boot"]);
const TRANSITION_GUARD_MS = 700;
const loadSecondary = () => Promise.all([import("./ui/HistoryScreen"), import("./ui/InsightsScreen"), import("./ui/SettingsScreen")]);

const SPLASH_MIN_MS = 1150;
const SPLASH_QUICK_MS = 250;

/** Fade the splash once boot is done: the full beat on a cold start, a blink otherwise, or straight away on a tap. */
function dismissSplash(reduced: boolean): void {
  const el = document.getElementById("splash");
  if (!el) return;
  const quick = document.documentElement.dataset.splash === "quick";
  const min = reduced ? 0 : quick ? SPLASH_QUICK_MS : SPLASH_MIN_MS;
  let gone = false;
  const go = () => {
    if (gone) return;
    gone = true;
    el.classList.add("out");
    window.setTimeout(() => el.remove(), 450);
  };
  el.addEventListener("pointerdown", go, { once: true });
  window.setTimeout(go, Math.max(0, min - performance.now()));
}

export function App() {
  const screen = useStore((s) => s.screen);
  const boot = useStore((s) => s.boot);
  const prefs = useStore((s) => s.prefs);
  const activity = useStore((s) => s.active?.activity ?? s.lastResult?.activity ?? s.setup.activity);
  const sessionPhase = useStore((s) => s.active?.phase);
  const [storageNotice, setStorageNotice] = React.useState(false);
  const [shown, setShown] = React.useState<Screen>(screen);

  React.useEffect(() => {
    // Native: drop the static launch image at once; the animated web splash takes over from the same mark.
    void hideSplash();
    void boot().then(() => {
      const reduced = useStore.getState().prefs.reducedMotion || matchMedia("(prefers-reduced-motion: reduce)").matches;
      dismissSplash(reduced);
      startFromLink();
      // Fetch the small secondary screens early so a transition never shows a loading frame.
      window.setTimeout(() => void loadSecondary().catch(() => undefined), 1500);
    });
    onStorageFailure(() => setStorageNotice(true));
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    // Every control answers a press with a light tick and haptic. Answer tiles have their own feedback.
    const tap = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.("button, [role=radio], [role=switch], [role=checkbox]");
      if (!el || el.classList.contains("tile") || (el as HTMLButtonElement).disabled) return;
      const feel = useStore.getState().prefs.feedback;
      if (feel === "off") return;
      if (feel === "strong") {
        haptics.tapStrong();
        sfx.tap(1.8);
      } else {
        haptics.tap();
        sfx.tap();
      }
    };
    window.addEventListener("pointerdown", tap);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("pointerdown", tap);
    };
  }, [boot]);

  // Screen changes go through the View Transitions API where the browser has it.
  React.useEffect(() => {
    if (screen === shown) return;
    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => { finished: Promise<void>; skipTransition?: () => void };
    };
    const reduced = prefs.reducedMotion || matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!doc.startViewTransition || reduced || OWN_MOTION.has(screen) || OWN_MOTION.has(shown)) {
      setShown(screen);
      return;
    }
    const html = document.documentElement;
    html.dataset.nav = DEPTH[screen] >= DEPTH[shown] ? "forward" : "back";
    html.classList.add("vt");
    const done = () => {
      html.classList.remove("vt");
      delete html.dataset.nav;
    };
    const t = doc.startViewTransition(() => flushSync(() => setShown(screen)));
    // Never let a transition hold the screen: cut it short if it hasn't finished in time.
    const guard = window.setTimeout(() => {
      t.skipTransition?.();
      setShown(screen);
      done();
    }, TRANSITION_GUARD_MS);
    void t.finished.finally(() => {
      window.clearTimeout(guard);
      done();
    });
  }, [screen, shown, prefs.reducedMotion]);

  React.useEffect(() => {
    setSoundEnabled(prefs.sound);
    setHapticsEnabled(prefs.haptics);
    document.documentElement.classList.toggle("reduce-motion", prefs.reducedMotion);
    document.documentElement.dataset.feel = prefs.feedback;
  }, [prefs]);

  // Browser chrome and the native status bar follow the surface on screen.
  React.useEffect(() => {
    const screen = shown;
    const paused = screen === "session" && sessionPhase === "paused";
    const color = PAPER.has(screen) ? "#F4F4F1" : INK.has(screen) || paused ? "#16181D" : ACTIVITY_COLOR[activity];
    const darkText = PAPER.has(screen) || (!INK.has(screen) && !paused && ACTIVITY_ON[activity] !== "#FFFFFF");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", color);
    document.documentElement.style.background = color;
    void setStatusBar(!darkText, color);
  }, [shown, activity, sessionPhase]);

  return (
    <ErrorBoundary>
      {shown === "welcome" && <WelcomeScreen />}
      {shown === "home" && <HomeScreen />}
      {shown === "session" && <SessionScreen />}
      {shown === "results" && <ResultsScreen />}
      <React.Suspense fallback={<div className="screen paper" />}>
        {shown === "history" && <HistoryScreen />}
        {shown === "settings" && <SettingsScreen />}
        {shown === "insights" && <InsightsScreen />}
      </React.Suspense>
      <MoodSheet />
      {storageNotice && shown !== "session" && (
        <div className="toast" role="status">
          <span>Storage is unavailable, so results last until you close the app.</span>
          <button className="btn-text" onClick={() => setStorageNotice(false)}>
            OK
          </button>
        </div>
      )}
    </ErrorBoundary>
  );
}
