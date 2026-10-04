import type { DurationChoice } from "../engine/types";
import { MODE_CHOICES, MODE_INFO } from "../modes/registry";
import { useStore } from "../state/store";
import { Segmented, Sheet } from "./components";
import { ACTIVITIES, ACTIVITY_LABEL } from "./copy";
import { unlockAudio } from "../audio/synth";

const DURATIONS: Array<{ value: DurationChoice; label: string }> = [
  { value: 10, label: "10 min" },
  { value: 20, label: "20 min" },
  { value: 30, label: "30 min" },
  { value: "open", label: "Open" },
];

/** Activity, mode, duration. A sheet over the current screen, never a separate page. */
export function SetupSheet({ onClose }: { onClose: () => void }) {
  const setup = useStore((s) => s.setup);
  const updateSetup = useStore((s) => s.updateSetup);
  const startSession = useStore((s) => s.startSession);
  return (
    <Sheet title="Your session" onClose={onClose}>
      <p className="group-label" id="act-label">
        Activity
      </p>
      <Segmented
        label="Activity"
        cols={4}
        value={setup.activity}
        onChange={(activity) => updateSetup({ activity })}
        options={ACTIVITIES.map((a) => ({ value: a, label: ACTIVITY_LABEL[a], activity: a }))}
      />
      <p className="group-label">Mode</p>
      <div className="mode-rows" role="radiogroup" aria-label="Mode">
        {MODE_CHOICES.map((m) => (
          <button key={m} role="radio" aria-checked={setup.mode === m} className="mode-row" onClick={() => updateSetup({ mode: m })}>
            <strong>{MODE_INFO[m].label}</strong>
            <span>{MODE_INFO[m].description}</span>
          </button>
        ))}
      </div>
      <p className="group-label">Duration</p>
      <Segmented label="Duration" cols={4} value={setup.duration} onChange={(duration) => updateSetup({ duration })} options={DURATIONS} />
      <div className="stack gap-8" style={{ marginTop: 24 }}>
        <button
          className="btn-primary"
          onClick={() => {
            unlockAudio();
            onClose();
            void startSession();
          }}
        >
          Start
        </button>
        <button className="btn-text" style={{ alignSelf: "center" }} onClick={onClose}>
          Done
        </button>
      </div>
    </Sheet>
  );
}
