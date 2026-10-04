import React from "react";
import { unlockAudio } from "../audio/synth";
import { isSpeechSupported } from "../audio/speech";
import type { Activity } from "../engine/types";
import { useStore } from "../state/store";
import type { Distance } from "../storage";
import { Mark, Segmented } from "./components";
import { ACTIVITIES, ACTIVITY_LABEL } from "./copy";

const HINT: Record<Exclude<Activity, "still">, string> = { walk: "Steady pace", bike: "Indoor or out", stairs: "Climber or steps", run: "Treadmill or road" };
/** A sensible first guess per activity; one tap changes it. */
const LIKELY_DISTANCE: Record<Exclude<Activity, "still">, Distance> = { walk: "hand", bike: "arm", stairs: "arm", run: "hand" };

/**
 * First launch: pick what you're doing, answer two questions that change how the app plays
 * (where the phone is, whether you'll listen), then a 30-second guided round.
 */
export function WelcomeScreen() {
  const chooseActivity = useStore((s) => s.chooseActivity);
  const startSession = useStore((s) => s.startSession);
  const updatePrefs = useStore((s) => s.updatePrefs);
  const skipIntro = useStore((s) => s.skipIntro);
  const prefs = useStore((s) => s.prefs);
  const [activity, setActivity] = React.useState<Exclude<Activity, "still"> | null>(null);
  const canSpeak = isSpeechSupported();

  const pick = (a: Exclude<Activity, "still">) => {
    unlockAudio();
    chooseActivity(a);
    updatePrefs({ distance: LIKELY_DISTANCE[a] });
    setActivity(a);
  };

  if (activity) {
    return (
      <main className="screen ink welcome welcome-setup" data-activity={activity}>
        <div className="wordmark">
          <Mark />
          CardioBrain
        </div>
        <h1 className="display t-40 welcome-lede">{ACTIVITY_LABEL[activity]}. Two quick choices.</h1>

        <p className="group-label" id="q-phone">
          Where's your phone?
        </p>
        <Segmented<Distance>
          label="Where's your phone?"
          cols={2}
          value={prefs.distance}
          onChange={(distance) => updatePrefs({ distance })}
          options={[
            { value: "hand", label: "In my hand" },
            { value: "arm", label: "Mounted" },
          ]}
        />
        <p className="welcome-note">{prefs.distance === "arm" ? "Everything gets bigger, to read at arm's length." : "Sized for a phone in your hand."}</p>

        {canSpeak && (
          <>
            <p className="group-label">How will you play?</p>
            <Segmented<"look" | "listen">
              label="How will you play?"
              cols={2}
              value={prefs.speak ? "listen" : "look"}
              onChange={(v) => updatePrefs({ speak: v === "listen" })}
              options={[
                { value: "look", label: "Looking" },
                { value: "listen", label: "Listening too" },
              ]}
            />
            <p className="welcome-note">
              {prefs.speak ? "Each challenge is read aloud, so you can glance less. Earbuds help." : "You can turn on Read aloud later in Settings."}
            </p>
          </>
        )}

        <div className="grow" />
        <p className="welcome-safety">Keep your eyes up between challenges, and stop if you feel dizzy.</p>
        <div className="stack gap-8">
          <button
            className="btn-primary welcome-go"
            onClick={() => {
              unlockAudio();
              void startSession({ guided: true });
            }}
          >
            Start a 30-second round
          </button>
          <button className="btn-text" style={{ alignSelf: "center" }} onClick={() => setActivity(null)}>
            Back
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="screen ink welcome">
      <div className="wordmark">
        <Mark />
        CardioBrain
      </div>
      <h1 className="display t-40 welcome-lede">Quick brain challenges you play while you move.</h1>
      <p className="t-17" style={{ marginBottom: 12 }}>
        What are you doing today?
      </p>
      <div className="activity-blocks">
        {ACTIVITIES.map((a) => (
          <button key={a} className="activity-block" data-activity={a} onClick={() => pick(a as Exclude<Activity, "still">)}>
            <span className="display">{ACTIVITY_LABEL[a]}</span>
            <small>{HINT[a as Exclude<Activity, "still">]}</small>
          </button>
        ))}
      </div>
      <div className="welcome-foot">
        <span>No account. Everything stays on this device.</span>
        <button className="btn-text" onClick={skipIntro}>
          Look around first
        </button>
      </div>
    </main>
  );
}
