import { unlockAudio } from "../audio/synth";
import type { Activity } from "../engine/types";
import { useStore } from "../state/store";
import { Mark } from "./components";
import { ACTIVITIES, ACTIVITY_LABEL } from "./copy";

const HINT: Record<Activity, string> = { walk: "Steady pace", bike: "Indoor or out", stairs: "Climber or steps", run: "Treadmill or road" };

/** First launch: one sentence, four activities, straight into a guided round. */
export function WelcomeScreen() {
  const chooseActivity = useStore((s) => s.chooseActivity);
  const startSession = useStore((s) => s.startSession);
  const pick = (a: Activity) => {
    unlockAudio();
    chooseActivity(a);
    void startSession({ guided: true });
  };
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
          <button key={a} className="activity-block" data-activity={a} onClick={() => pick(a)}>
            <span className="display">{ACTIVITY_LABEL[a]}</span>
            <small>{HINT[a]}</small>
          </button>
        ))}
      </div>
    </main>
  );
}
