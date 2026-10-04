import { useStore } from "../state/store";
import { Sheet } from "./components";
import { MOODS } from "./ResultsScreen";

/** Before a session, when mood check-ins are on: one tap, or skip. */
export function MoodSheet() {
  const pending = useStore((s) => s.pendingStart);
  const startSession = useStore((s) => s.startSession);
  const cancelStart = useStore((s) => s.cancelStart);
  if (!pending) return null;
  return (
    <Sheet title="How do you feel?" onClose={cancelStart}>
      <div className="mood mood-sheet">
        {MOODS.map((m, i) => (
          <button key={m} className="segment" onClick={() => void startSession({ ...pending, moodBefore: i + 1 })}>
            {m}
          </button>
        ))}
      </div>
      <button className="btn-text" style={{ marginTop: 12 }} onClick={() => void startSession(pending)}>
        Skip and start
      </button>
    </Sheet>
  );
}
