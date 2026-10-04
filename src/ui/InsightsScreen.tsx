import { findInsights } from "../engine/insights";
import type { ModeId } from "../engine/types";
import { MODE_INFO, PLAYABLE_MODES, SCIENCE } from "../modes/registry";
import { useStore } from "../state/store";
import { BackIcon } from "./components";
import { ACTIVITY_LABEL } from "./copy";

/** Patterns in your own sessions, in plain words, plus what each challenge is modelled on. */
export function InsightsScreen() {
  const history = useStore((s) => s.history);
  const go = useStore((s) => s.go);
  const updateSetup = useStore((s) => s.updateSetup);
  const insights = findInsights(history, { mode: (m) => MODE_INFO[m].label, activity: (a) => ACTIVITY_LABEL[a] });
  const seated = new Set(history.filter((h) => h.activity === "still").map((h) => h.requestedMode));
  const missing = PLAYABLE_MODES.filter((m) => !seated.has(m));

  const takeBaseline = (mode: ModeId) => {
    updateSetup({ activity: "still", mode, duration: 10 });
    go("home");
  };

  return (
    <main className="screen paper">
      <div className="back-row">
        <button className="icon-btn" onClick={() => go("home")} aria-label="Back to Home" style={{ marginLeft: -12 }}>
          <BackIcon />
        </button>
      </div>
      <h1 className="display page-title">Insights</h1>

      {insights.length === 0 ? (
        <p className="empty" style={{ fontSize: "var(--fs-24)" }}>
          Patterns show up after a few sessions. Rate how hard each workout felt on Results and they'll come sooner.
        </p>
      ) : (
        <ul className="insights">
          {insights.map((i) => (
            <li key={i.id} className="insight">
              <h2 className="t-24" style={{ fontWeight: 750 }}>
                {i.title}
              </h2>
              <p className="t-17">{i.body}</p>
            </li>
          ))}
        </ul>
      )}
      {insights.length > 0 && <p className="sheet-note">These describe patterns in your sessions, not causes. More sessions make them steadier.</p>}

      <h2 className="t-24 section-title">Motion cost</h2>
      <p className="t-17">
        Play a mode seated once and CardioBrain can show how much moving costs your thinking on it.{" "}
        {missing.length
          ? `No seated baseline yet for ${missing.length === PLAYABLE_MODES.length ? "any mode" : missing.map((m) => MODE_INFO[m].label).join(", ")}.`
          : "Every mode has a baseline."}
      </p>
      {missing.length > 0 && (
        <button className="btn-primary" style={{ marginTop: 12 }} onClick={() => takeBaseline(missing[0]!)}>
          Set up a seated {MODE_INFO[missing[0]!].label} baseline
        </button>
      )}

      <h2 className="t-24 section-title">About the challenges</h2>
      <ul className="science">
        {PLAYABLE_MODES.map((m) => (
          <li key={m}>
            <strong>{MODE_INFO[m].label}.</strong> {SCIENCE[m]?.practises} <span className="source">{SCIENCE[m]?.source}.</span>
          </li>
        ))}
      </ul>
      <p className="sheet-note" style={{ marginTop: 12 }}>
        These are classic tasks from cognitive psychology. Practising them makes you better at them; how far that carries into everyday thinking is still
        debated in the research. CardioBrain measures, it doesn't diagnose.
      </p>
    </main>
  );
}
