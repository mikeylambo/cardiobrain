import React from "react";
import type { DifficultyBias } from "../engine/types";
import { haptics } from "../haptics";
import { useStore } from "../state/store";
import { exportData } from "../storage";
import { BackIcon, Segmented, Sheet, Toggle } from "./components";

const BIAS_NOTE: Record<DifficultyBias, string> = {
  gentle: "More time to answer and a slower climb. Good for hard efforts.",
  standard: "Adapts to you as you play. Right for most sessions.",
  hard: "Less time to answer and a faster climb.",
};

export function SettingsScreen() {
  const prefs = useStore((s) => s.prefs);
  const updatePrefs = useStore((s) => s.updatePrefs);
  const go = useStore((s) => s.go);
  const deleteAllData = useStore((s) => s.deleteAllData);
  const [confirm, setConfirm] = React.useState(false);
  const [tested, setTested] = React.useState(false);
  const vibrates = typeof navigator !== "undefined" && "vibrate" in navigator;

  return (
    <main className="screen paper">
      <div className="back-row">
        <button className="icon-btn" onClick={() => go("home")} aria-label="Back to Home" style={{ marginLeft: -12 }}>
          <BackIcon />
        </button>
      </div>
      <h1 className="display page-title">Settings</h1>

      <div className="setting">
        <div className="setting-text">
          <strong>Sound</strong>
          <span>Chimes for right and wrong answers.</span>
        </div>
        <Toggle label="Sound" checked={prefs.sound} onChange={(sound) => updatePrefs({ sound })} />
      </div>
      <div className="setting">
        <div className="setting-text">
          <strong>Haptics</strong>
          <span>{tested && !vibrates ? "This browser can't vibrate. Sound and visuals carry feedback." : "A short buzz with each answer."}</span>
        </div>
        <div className="btn-row" style={{ gap: 12 }}>
          <button
            className="btn-text"
            onClick={() => {
              haptics.test();
              setTested(true);
            }}
            disabled={!prefs.haptics}
          >
            Test
          </button>
          <Toggle label="Haptics" checked={prefs.haptics} onChange={(h) => updatePrefs({ haptics: h })} />
        </div>
      </div>
      <div className="setting">
        <div className="setting-text">
          <strong>Reduced motion</strong>
          <span>Quick fades instead of wipes and width changes.</span>
        </div>
        <Toggle label="Reduced motion" checked={prefs.reducedMotion} onChange={(reducedMotion) => updatePrefs({ reducedMotion })} />
      </div>

      <div style={{ borderTop: "1px solid var(--rule)", paddingTop: 16 }}>
        <p className="t-17" style={{ fontWeight: 650, marginBottom: 10 }} id="diff-label">
          Difficulty
        </p>
        <Segmented
          label="Difficulty"
          cols={3}
          value={prefs.difficultyBias}
          onChange={(difficultyBias) => updatePrefs({ difficultyBias })}
          options={[
            { value: "gentle", label: "Gentle" },
            { value: "standard", label: "Standard" },
            { value: "hard", label: "Hard" },
          ]}
        />
        <p className="bias-note">{BIAS_NOTE[prefs.difficultyBias]}</p>
      </div>

      <div className="danger-zone">
        <button
          className="btn-text"
          style={{ alignSelf: "flex-start" }}
          onClick={() => {
            const s = useStore.getState();
            exportData({ history: s.history, progress: s.progress, prefs: s.prefs, setup: s.setup });
          }}
        >
          Export data
        </button>
        <button className="btn-text" style={{ alignSelf: "flex-start" }} onClick={() => setConfirm(true)}>
          Delete data
        </button>
        <p className="t-14" style={{ color: "var(--muted)", marginTop: 8 }}>
          Everything stays on this device.{" "}
          <a href="/privacy" style={{ color: "inherit" }}>
            Privacy
          </a>
        </p>
      </div>

      {confirm && (
        <Sheet title="Delete everything?" onClose={() => setConfirm(false)}>
          <p className="t-17" style={{ marginBottom: 20 }}>
            This removes your history, levels and settings from this device. It can't be undone.
          </p>
          <div className="stack gap-8">
            <button
              className="btn-primary"
              onClick={() => {
                setConfirm(false);
                void deleteAllData();
              }}
            >
              Delete data
            </button>
            <button className="btn-text" style={{ alignSelf: "center" }} onClick={() => setConfirm(false)}>
              Keep it
            </button>
          </div>
        </Sheet>
      )}
    </main>
  );
}
