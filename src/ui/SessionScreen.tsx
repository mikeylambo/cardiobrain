import React from "react";
import { sfx } from "../audio/synth";
import { haptics } from "../haptics";
import { MODE_INFO, MODE_VIEWS } from "../modes/registry";
import type { Feedback } from "../modes/shared";
import { elapsedMs, useStore } from "../state/store";
import { formatClock } from "../engine/session";
import { onAppStateChange } from "../platform/native";
import { releaseWakeLock, requestWakeLock } from "../wakelock";
import { PauseIcon, Sheet, useLongPress } from "./components";
import { Countdown } from "./CountdownScreen";

const FEEDBACK_MS = { correct: 280, wrong: 700 };
const TRANSITION_MS = 1200;

export function SessionScreen() {
  // Every hook sits above the first return. v1 crashed on pause because it did not.
  const active = useStore((s) => s.active);
  const countdownDone = useStore((s) => s.countdownDone);
  const markPresented = useStore((s) => s.markPresented);
  const answer = useStore((s) => s.answer);
  const advance = useStore((s) => s.advance);
  const endTransition = useStore((s) => s.endTransition);
  const pause = useStore((s) => s.pause);
  const resume = useStore((s) => s.resume);
  const endSession = useStore((s) => s.endSession);
  const tick = useStore((s) => s.tick);
  const backgrounded = useStore((s) => s.backgrounded);
  const foregrounded = useStore((s) => s.foregrounded);

  const [, setClock] = React.useState(0);
  const [feedback, setFeedback] = React.useState<Feedback | null>(null);
  const [announce, setAnnounce] = React.useState("");
  const [confirmEnd, setConfirmEnd] = React.useState(false);
  const [wiping, setWiping] = React.useState(false);
  const advanceTimer = React.useRef<number | null>(null);

  const phase = active?.phase;
  const current = active?.current ?? null;
  const transition = active?.transition ?? null;
  const countdownKind = active?.countdownKind;

  // Clock: re-render the rail and let the store finish on time and save every 5s.
  React.useEffect(() => {
    const id = window.setInterval(() => {
      tick();
      setClock((c) => c + 1);
    }, 250);
    return () => window.clearInterval(id);
  }, [tick]);

  // Screen stays on for the whole session.
  React.useEffect(() => {
    void requestWakeLock();
    return () => void releaseWakeLock();
  }, []);

  // Backgrounded, a call, or the phone locked: stop the clock; over 3s away, pause.
  React.useEffect(() => {
    const onVisibility = () => (document.visibilityState === "hidden" ? backgrounded() : foregrounded());
    const onHide = () => backgrounded();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);
    let off: (() => void) | null = null;
    let disposed = false;
    void onAppStateChange((isActive) => (isActive ? foregrounded() : backgrounded())).then((fn) => {
      if (disposed) fn();
      else off = fn;
    });
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
      off?.();
    };
  }, [backgrounded, foregrounded]);

  // Mix transition card: hold for 1.2s, then the next block's first challenge.
  React.useEffect(() => {
    if (!transition || phase !== "running") return;
    sfx.transition();
    const t = window.setTimeout(endTransition, TRANSITION_MS);
    return () => window.clearTimeout(t);
  }, [transition, phase, endTransition]);

  // React no-go and misses: the trial ends by itself once its window passes.
  const presentedAt = active?.presentedAt ?? null;
  const answered = active?.answered ?? false;
  const handleAnswer = React.useCallback(
    (answerId: string) => {
      const c = useStore.getState().active?.current;
      const outcome = answer(answerId);
      if (!outcome || !c) return;
      setFeedback({ challengeId: c.id, pickedId: answerId, correct: outcome.correct, correctId: c.correctAnswer });
      if (outcome.correct) {
        sfx.correct();
        haptics.correct();
      } else {
        sfx.wrong();
        haptics.wrong();
      }
      if (outcome.milestone) {
        window.setTimeout(() => {
          sfx.streak(outcome.streak);
          haptics.streak();
        }, 140);
      }
      setAnnounce(outcome.correct ? (outcome.milestone ? `Correct. ${outcome.streak} in a row.` : "Correct.") : "Not quite.");
      if (advanceTimer.current !== null) window.clearTimeout(advanceTimer.current);
      advanceTimer.current = window.setTimeout(
        () => {
          advanceTimer.current = null;
          setFeedback(null);
          advance();
        },
        outcome.correct ? FEEDBACK_MS.correct : FEEDBACK_MS.wrong,
      );
    },
    [answer, advance],
  );

  React.useEffect(() => {
    if (phase !== "running" || !current?.timeoutMs || presentedAt === null || answered) return;
    const fallback = current.timeoutAnswer ?? "timeout";
    const t = window.setTimeout(() => handleAnswer(fallback), Math.max(0, current.timeoutMs - (performance.now() - presentedAt)));
    return () => window.clearTimeout(t);
  }, [phase, current, presentedAt, answered, handleAnswer]);

  // A pause drops any pending advance; resume replays or re-generates the challenge.
  React.useEffect(() => {
    if (phase === "running") return;
    if (advanceTimer.current !== null) {
      window.clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
    setFeedback(null);
  }, [phase]);

  React.useEffect(
    () => () => {
      if (advanceTimer.current !== null) window.clearTimeout(advanceTimer.current);
    },
    [],
  );

  const onCountdownFinished = React.useCallback(() => {
    const first = useStore.getState().active?.countdownKind === "start";
    const attempt = () => {
      const a = useStore.getState().active;
      if (!a || a.phase !== "countdown") return;
      countdownDone();
      // Still counting down means the rhyme words are loading: try again shortly.
      if (useStore.getState().active?.phase === "countdown") window.setTimeout(attempt, 150);
      else if (first) setWiping(true);
    };
    attempt();
  }, [countdownDone]);

  React.useEffect(() => {
    if (!wiping) return;
    const t = window.setTimeout(() => setWiping(false), 700);
    return () => window.clearTimeout(t);
  }, [wiping]);

  const longPress = useLongPress(() => {
    pause();
    setConfirmEnd(true);
    haptics.switch();
  });

  const onPresented = React.useCallback(() => markPresented(), [markPresented]);

  if (!active) return null;

  const elapsed = elapsedMs(active);
  const progress = active.durationSeconds ? Math.min(1, elapsed / (active.durationSeconds * 1000)) : null;
  const View = current ? MODE_VIEWS[current.mode] : null;
  const modeLabel = MODE_INFO[active.currentMode].label;

  return (
    <div className="session field" data-activity={active.activity}>
      <div className="session-bar">
        {progress !== null ? (
          <div
            className="rail"
            role="progressbar"
            aria-label="Session progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
          >
            <div className="rail-fill" style={{ width: `${progress * 100}%` }} />
          </div>
        ) : (
          <div className="grow t-17">{modeLabel}</div>
        )}
        <span className="clock num" aria-label={`Elapsed ${formatClock(elapsed)}`}>
          {formatClock(elapsed)}
        </span>
        {active.streak >= 3 && (
          <span className="streak num" aria-label={`${active.streak} in a row`}>
            ×{active.streak}
          </span>
        )}
        <button
          className="icon-btn"
          aria-label="Pause. Press and hold to end the session"
          onClick={() => {
            if (longPress.fired.current) return;
            pause();
          }}
          {...longPress.handlers}
        >
          <PauseIcon />
        </button>
      </div>

      <div className={`stack grow${wiping ? " wipe" : ""}`} style={{ minHeight: 0 }}>
        {phase === "running" && View && current && !transition && (
          <View
            key={`${current.id}-${active.presentation}`}
            challenge={current}
            onAnswer={handleAnswer}
            onPresented={onPresented}
            feedback={feedback}
            entering={wiping}
          />
        )}
      </div>

      {phase === "countdown" && (
        <Countdown
          key={`${countdownKind}-${active.presentation}`}
          onFinished={onCountdownFinished}
          label={countdownKind === "resume" ? "Back in" : MODE_INFO[active.guided ? "mix" : active.requestedMode].label}
        />
      )}

      {phase === "running" && transition && (
        <div className="overlay transition-card field" role="status" aria-live="assertive">
          <p className="cue">Next up</p>
          <h2 className="display">{MODE_INFO[transition].label}</h2>
          <p className="t-24">{MODE_INFO[transition].instruction}</p>
        </div>
      )}

      {phase === "paused" && !confirmEnd && (
        <div className="overlay paused ink" role="dialog" aria-modal="true" aria-labelledby="paused-title">
          <div className="stack gap-12" style={{ marginTop: 40 }}>
            <h1 id="paused-title" className="display">
              Paused. Your session is saved.
            </h1>
            <p className="t-17">
              {formatClock(elapsed)} in, {active.trials.length} {active.trials.length === 1 ? "challenge" : "challenges"} done.
            </p>
          </div>
          <div className="stack gap-12">
            <button className="btn-primary" onClick={resume} autoFocus>
              Resume
            </button>
            <button className="btn-text" style={{ alignSelf: "center", color: "var(--chalk)" }} onClick={() => setConfirmEnd(true)}>
              End session
            </button>
          </div>
        </div>
      )}

      {confirmEnd && (
        <Sheet title="End this session?" onClose={() => setConfirmEnd(false)}>
          <p className="t-17" style={{ marginBottom: 20 }}>
            {active.trials.length ? "Your results so far are kept." : "Nothing has been answered yet, so nothing will be saved."}
          </p>
          <div className="stack gap-8">
            <button
              className="btn-primary"
              onClick={() => {
                setConfirmEnd(false);
                endSession();
              }}
            >
              End session
            </button>
            <button
              className="btn-text"
              style={{ alignSelf: "center" }}
              onClick={() => {
                setConfirmEnd(false);
                resume();
              }}
            >
              Keep going
            </button>
          </div>
        </Sheet>
      )}

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}
