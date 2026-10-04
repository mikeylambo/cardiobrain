import React from "react";
import { setSoundEnabled, unlockAudio } from "./audio/synth";
import { setHapticsEnabled } from "./haptics";
import { hideSplash, setStatusBar } from "./platform/native";
import { onStorageFailure } from "./storage";
import { useStore, type Screen } from "./state/store";
import { Mark } from "./ui/components";
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

export function App() {
  const screen = useStore((s) => s.screen);
  const boot = useStore((s) => s.boot);
  const prefs = useStore((s) => s.prefs);
  const activity = useStore((s) => s.active?.activity ?? s.lastResult?.activity ?? s.setup.activity);
  const sessionPhase = useStore((s) => s.active?.phase);
  const [storageNotice, setStorageNotice] = React.useState(false);

  React.useEffect(() => {
    void boot().then(() => {
      void hideSplash();
      startFromLink();
    });
    onStorageFailure(() => setStorageNotice(true));
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, [boot]);

  React.useEffect(() => {
    setSoundEnabled(prefs.sound);
    setHapticsEnabled(prefs.haptics);
    document.documentElement.classList.toggle("reduce-motion", prefs.reducedMotion);
  }, [prefs]);

  // Browser chrome and the native status bar follow the surface on screen.
  React.useEffect(() => {
    const paused = screen === "session" && sessionPhase === "paused";
    const color = PAPER.has(screen) ? "#F4F4F1" : INK.has(screen) || paused ? "#16181D" : ACTIVITY_COLOR[activity];
    const darkText = PAPER.has(screen) || (!INK.has(screen) && !paused && ACTIVITY_ON[activity] !== "#FFFFFF");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", color);
    document.documentElement.style.background = color;
    void setStatusBar(!darkText, color);
  }, [screen, activity, sessionPhase]);

  return (
    <ErrorBoundary>
      {screen === "boot" && (
        <div className="boot" aria-label="CardioBrain is loading">
          <Mark width={40} height={40} style={{ color: "#F4F4F1" }} />
          <span>CardioBrain</span>
        </div>
      )}
      {screen === "welcome" && <WelcomeScreen />}
      {screen === "home" && <HomeScreen />}
      {screen === "session" && <SessionScreen />}
      {screen === "results" && <ResultsScreen />}
      <React.Suspense fallback={<div className="screen paper" />}>
        {screen === "history" && <HistoryScreen />}
        {screen === "settings" && <SettingsScreen />}
        {screen === "insights" && <InsightsScreen />}
      </React.Suspense>
      <MoodSheet />
      {storageNotice && screen !== "session" && (
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
