import React from "react";
import { setSoundEnabled, unlockAudio } from "./audio/synth";
import { setHapticsEnabled } from "./haptics";
import { hideSplash, setStatusBar } from "./platform/native";
import { onStorageFailure } from "./storage";
import { useStore, type Screen } from "./state/store";
import { Mark } from "./ui/components";
import { ErrorBoundary } from "./ui/ErrorBoundary";
import { HistoryScreen } from "./ui/HistoryScreen";
import { HomeScreen } from "./ui/HomeScreen";
import { WelcomeScreen } from "./ui/OnboardingScreen";
import { ResultsScreen } from "./ui/ResultsScreen";
import { SessionScreen } from "./ui/SessionScreen";
import { SettingsScreen } from "./ui/SettingsScreen";
import { ACTIVITY_COLOR, ACTIVITY_ON } from "./ui/copy";

const PAPER = new Set<Screen>(["history", "settings"]);
const INK = new Set<Screen>(["welcome", "boot"]);

export function App() {
  const screen = useStore((s) => s.screen);
  const boot = useStore((s) => s.boot);
  const prefs = useStore((s) => s.prefs);
  const activity = useStore((s) => s.active?.activity ?? s.lastResult?.activity ?? s.setup.activity);
  const sessionPhase = useStore((s) => s.active?.phase);
  const [storageNotice, setStorageNotice] = React.useState(false);

  React.useEffect(() => {
    void boot().then(() => hideSplash());
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
      {screen === "history" && <HistoryScreen />}
      {screen === "settings" && <SettingsScreen />}
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
