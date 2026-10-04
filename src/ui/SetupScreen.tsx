import type { DurationChoice, ModeId } from "../engine/types";
import { MODE_CHOICES, MODE_INFO, PLAYABLE_MODES } from "../modes/registry";
import { useStore } from "../state/store";
import type { IntervalChoice } from "../storage";
import { Segmented, Sheet } from "./components";
import { ALL_ACTIVITIES, ACTIVITY_LABEL } from "./copy";
import { unlockAudio } from "../audio/synth";

const DURATIONS: Array<{ value: DurationChoice; label: string }> = [
  { value: 10, label: "10 min" },
  { value: 20, label: "20 min" },
  { value: 30, label: "30 min" },
  { value: "open", label: "Open" },
];

const INTERVAL_OPTIONS: Array<{ value: IntervalChoice; label: string }> = [
  { value: "off", label: "Off" },
  { value: "30/30", label: "30s/30s" },
  { value: "60/60", label: "1/1 min" },
  { value: "240/60", label: "4/1 min" },
];

/** Activity, mode, duration, intervals. A sheet over the current screen, never a separate page. */
export function SetupSheet({ onClose }: { onClose: () => void }) {
  const setup = useStore((s) => s.setup);
  const updateSetup = useStore((s) => s.updateSetup);
  const requestStart = useStore((s) => s.requestStart);

  const toggleMix = (m: ModeId) => {
    const on = setup.mixModes.includes(m);
    if (on && setup.mixModes.length <= 2) return; // Mix needs at least two
    updateSetup({ mixModes: on ? setup.mixModes.filter((x) => x !== m) : PLAYABLE_MODES.filter((x) => x === m || setup.mixModes.includes(x)) });
  };

  return (
    <Sheet title="Your session" onClose={onClose}>
      <p className="group-label">Activity</p>
      <Segmented
        label="Activity"
        cols={5}
        value={setup.activity}
        onChange={(activity) => updateSetup({ activity })}
        options={ALL_ACTIVITIES.map((a) => ({ value: a, label: ACTIVITY_LABEL[a], activity: a }))}
      />
      {setup.activity === "still" && (
        <p className="sheet-note">Seated sets your baseline. Play each mode seated once, and Results will show what moving costs you.</p>
      )}

      <p className="group-label">Mode</p>
      <div className="mode-rows" role="radiogroup" aria-label="Mode">
        {MODE_CHOICES.map((m) => (
          <button key={m} role="radio" aria-checked={setup.mode === m} className="mode-row" onClick={() => updateSetup({ mode: m })}>
            <strong>{MODE_INFO[m].label}</strong>
            <span>{MODE_INFO[m].description}</span>
          </button>
        ))}
      </div>

      {setup.mode === "mix" && (
        <>
          <p className="group-label" id="mix-label">
            In the mix ({setup.mixModes.length} of {PLAYABLE_MODES.length})
          </p>
          <div className="chips wrap" role="group" aria-labelledby="mix-label">
            {PLAYABLE_MODES.map((m) => (
              <button key={m} role="checkbox" aria-checked={setup.mixModes.includes(m)} className="chip" onClick={() => toggleMix(m)}>
                {MODE_INFO[m].label}
              </button>
            ))}
          </div>
        </>
      )}

      <p className="group-label">Duration</p>
      <Segmented label="Duration" cols={4} value={setup.duration} onChange={(duration) => updateSetup({ duration })} options={DURATIONS} />

      <p className="group-label">Intervals</p>
      <Segmented label="Intervals" cols={4} value={setup.intervals} onChange={(intervals) => updateSetup({ intervals })} options={INTERVAL_OPTIONS} />
      {setup.intervals !== "off" && (
        <>
          <p className="group-label">Challenges during</p>
          <Segmented
            label="Challenges during"
            cols={2}
            value={setup.playDuring}
            onChange={(playDuring) => updateSetup({ playDuring })}
            options={[
              { value: "work", label: "Work bouts" },
              { value: "rest", label: "Recovery" },
            ]}
          />
        </>
      )}

      <div className="stack gap-8" style={{ marginTop: 24 }}>
        <button
          className="btn-primary"
          onClick={() => {
            unlockAudio();
            onClose();
            requestStart();
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
