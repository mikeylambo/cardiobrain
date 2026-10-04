import React from "react";
import { unlockAudio } from "../audio/synth";
import { MODE_INFO } from "../modes/registry";
import { useStore } from "../state/store";
import { formatClock } from "../engine/session";
import { Mark } from "./components";
import { ACTIVITY_LABEL, durationLabel, pct, presetLine } from "./copy";
import { SetupSheet } from "./SetupScreen";
import { InstallPrompt, shouldOfferInstall } from "./InstallPrompt";
import { UpdateToast } from "./UpdateToast";

export function HomeScreen() {
  const setup = useStore((s) => s.setup);
  const history = useStore((s) => s.history);
  const recoverable = useStore((s) => s.recoverable);
  const error = useStore((s) => s.error);
  const flags = useStore((s) => s.flags);
  const startSession = useStore((s) => s.startSession);
  const resumeRecovered = useStore((s) => s.resumeRecovered);
  const discardRecovered = useStore((s) => s.discardRecovered);
  const clearError = useStore((s) => s.clearError);
  const go = useStore((s) => s.go);
  const [sheet, setSheet] = React.useState(false);
  const [install, setInstall] = React.useState(() => shouldOfferInstall(flags.installOffered, history.length));

  const last = history.find((h) => !h.guided) ?? history[0];
  const start = () => {
    unlockAudio();
    void startSession();
  };

  return (
    <main className="screen field" data-activity={setup.activity}>
      <div className="home-top">
        <div className="wordmark">
          <Mark />
          CardioBrain
        </div>
      </div>

      <div className="home-hero grow">
        <h1 className="display">{ACTIVITY_LABEL[setup.activity]}</h1>
        <p className="home-preset">
          {MODE_INFO[setup.mode].label}, {durationLabel(setup.duration)}
        </p>
      </div>

      <div className="home-actions">
        {error && (
          <div className="notice" role="alert">
            {error}{" "}
            <button className="btn-text" onClick={clearError}>
              OK
            </button>
          </div>
        )}
        {recoverable && (
          <div className="stack gap-8" style={{ marginBottom: 8 }}>
            <p className="t-17">
              Pick up where you left off: {ACTIVITY_LABEL[recoverable.activity]}, {MODE_INFO[recoverable.requestedMode].label},{" "}
              {formatClock(recoverable.elapsedMs)} in.
            </p>
            <button
              className="btn-primary"
              onClick={() => {
                unlockAudio();
                void resumeRecovered();
              }}
            >
              Resume your session
            </button>
            <button className="btn-text" style={{ alignSelf: "flex-start" }} onClick={discardRecovered}>
              Discard it
            </button>
          </div>
        )}
        {!recoverable && (
          <button className="btn-primary" onClick={start} aria-describedby="preset">
            Start
          </button>
        )}
        <div className="btn-row spread">
          <span id="preset" className="sr-only">
            {presetLine(setup.activity, setup.mode, setup.duration)}
          </span>
          {recoverable && (
            <button className="btn-text" onClick={start}>
              Start a new one
            </button>
          )}
          <button className="btn-text" onClick={() => setSheet(true)}>
            Change
          </button>
        </div>
        <p className="home-last">
          {last
            ? `Last time: ${pct(last.accuracy)}% accuracy, ${(last.avgRt / 1000).toFixed(1)}s average.`
            : "No sessions yet. Start one and your first result becomes your baseline."}
        </p>
        <div className="home-foot">
          <button className="btn-text quiet" onClick={() => go("history")}>
            History
          </button>
          <button className="btn-text quiet" onClick={() => go("settings")}>
            Settings
          </button>
        </div>
      </div>

      {sheet && <SetupSheet onClose={() => setSheet(false)} />}
      {install && <InstallPrompt onClose={() => setInstall(false)} />}
      <UpdateToast />
    </main>
  );
}
