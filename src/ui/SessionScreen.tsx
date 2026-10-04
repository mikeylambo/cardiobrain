import React from "react";
import { sfx } from "../audio/synth";
import { hush, readOptions, say } from "../audio/speech";
import { listen } from "../audio/listen";
import { matchSpoken } from "../audio/voiceMatch";
import { haptics } from "../haptics";
import { MODE_INFO, MODE_VIEWS } from "../modes/registry";
import type { Feedback } from "../modes/shared";
import { elapsedMs, useStore } from "../state/store";
import { easePhase, formatClock } from "../engine/session";
import { intervalAt } from "../engine/intervals";
import { onAppStateChange } from "../platform/native";
import { releaseWakeLock, requestWakeLock } from "../wakelock";
import { PauseIcon, Sheet, useLongPress } from "./components";
import { Countdown } from "./CountdownScreen";

const FEEDBACK_MS = { correct: 280, wrong: 700 };
const TRANSITION_MS = 1200;
/** Coach lines show on the first few challenges of a mode you have never played. */
const COACH_TRIALS = 3;
const GUIDED_COACH = ["Tap the answer.", "Faster is better, but accuracy counts more.", "Pause is top right."];

export function SessionScreen() {
  // Every hook sits above the first return. v1 crashed on pause because it did not.
  const active = useStore((s) => s.active);
  const prefs = useStore((s) => s.prefs);
  const flags = useStore((s) => s.flags);
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
  const markModeSeen = useStore((s) => s.markModeSeen);
  const markPauseHintShown = useStore((s) => s.markPauseHintShown);
  const heart = useStore((s) => s.heart);

  const [, setClock] = React.useState(0);
  const [feedback, setFeedback] = React.useState<Feedback | null>(null);
  const [announce, setAnnounce] = React.useState("");
  const [confirmEnd, setConfirmEnd] = React.useState(false);
  const [wiping, setWiping] = React.useState(false);
  const [voiceNote, setVoiceNote] = React.useState<string | null>(null);
  const [coachMode, setCoachMode] = React.useState<string | null>(null);
  const [showPauseHint, setShowPauseHint] = React.useState(false);
  const [progressCue, setProgressCue] = React.useState<string | null>(null);
  const cuesFired = React.useRef<Set<string>>(new Set());
  const advanceTimer = React.useRef<number | null>(null);
  const coachCount = React.useRef<Record<string, number>>({});

  const phase = active?.phase;
  const current = active?.current ?? null;
  const transition = active?.transition ?? null;
  const resting = active?.resting ?? false;
  const countdownKind = active?.countdownKind;
  const presentedAt = active?.presentedAt ?? null;
  const answered = active?.answered ?? false;

  // Clock: re-render the rail and let the store finish on time and save every 5s.
  React.useEffect(() => {
    const id = window.setInterval(() => {
      tick();
      setClock((c) => c + 1);
    }, 250);
    return () => window.clearInterval(id);
  }, [tick]);

  // Screen stays on for the whole session; speech stops when it ends.
  React.useEffect(() => {
    void requestWakeLock();
    return () => {
      void releaseWakeLock();
      hush();
    };
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

  // Progress cues: halfway and one minute left, shown briefly and spoken when Read aloud is on.
  React.useEffect(() => {
    if (!active || phase !== "running" || !active.durationSeconds) return;
    const total = active.durationSeconds * 1000;
    const elapsed = elapsedMs(active);
    const fire = (key: string, text: string, spoken: string) => {
      if (cuesFired.current.has(key)) return;
      cuesFired.current.add(key);
      setProgressCue(text);
      sfx.transition();
      if (prefs.speak) say(spoken);
      window.setTimeout(() => setProgressCue((c) => (c === text ? null : c)), 2600);
    };
    const acc = active.trials.length ? Math.round((active.trials.filter((t) => t.correct).length / active.trials.length) * 100) : null;
    if (total >= 120_000 && elapsed >= total / 2 && elapsed < total / 2 + 5000)
      fire("half", acc === null ? "Halfway." : `Halfway. ${acc}% so far.`, acc === null ? "Halfway." : `Halfway. ${acc} percent so far.`);
    if (total >= 180_000 && elapsed >= total - 60_000 && elapsed < total - 55_000) fire("minute", "One minute left.", "One minute left.");
  });

  // Keyboard, for laptops and keyboards paired to tablets: Space or P pauses and resumes.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey) return;
      const phaseNow = useStore.getState().active?.phase;
      if (e.key === " " || e.key === "p" || e.key === "P" || e.key === "Escape") {
        e.preventDefault();
        if (phaseNow === "running") pause();
        else if (phaseNow === "paused" && e.key !== "Escape") resume();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pause, resume]);

  // Mix transition card: hold for 1.2s, then the next block's first challenge.
  React.useEffect(() => {
    if (!transition || phase !== "running") return;
    sfx.transition();
    if (prefs.speak) say(`Next up, ${MODE_INFO[transition].label}.`);
    const t = window.setTimeout(endTransition, TRANSITION_MS);
    return () => window.clearTimeout(t);
  }, [transition, phase, endTransition, prefs.speak]);

  // Interval bouts: a cue on every change between work and recovery.
  const wasResting = React.useRef(resting);
  React.useEffect(() => {
    if (phase !== "running" || wasResting.current === resting) return;
    wasResting.current = resting;
    const toWork = active ? intervalAt(elapsedMs(active), active.intervals, active.playDuring).bout === "work" : true;
    sfx.bout(toWork);
    haptics.switch();
    if (prefs.speak) say(resting ? (toWork ? "Work bout. Challenges paused." : "Recovery. Challenges paused.") : "Challenges back on.");
  }, [resting, phase, active, prefs.speak]);

  const handleAnswer = React.useCallback(
    (answerId: string) => {
      const c = useStore.getState().active?.current;
      const outcome = answer(answerId);
      if (!outcome || !c) return;
      setFeedback({ challengeId: c.id, pickedId: answerId, correct: outcome.correct, correctId: c.correctAnswer });
      if (outcome.correct) {
        sfx.correct(outcome.streak);
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
      setAnnounce(outcome.correct ? (outcome.milestone ? `Correct. ${outcome.streak} in a row.` : "Correct.") : "Incorrect.");
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

  // React no-go and misses: the trial ends by itself once its window passes.
  React.useEffect(() => {
    if (phase !== "running" || !current?.timeoutMs || presentedAt === null || answered) return;
    const fallback = current.timeoutAnswer ?? "timeout";
    const t = window.setTimeout(() => handleAnswer(fallback), Math.max(0, current.timeoutMs - (performance.now() - presentedAt)));
    return () => window.clearTimeout(t);
  }, [phase, current, presentedAt, answered, handleAnswer]);

  // Spoken prompts: read the challenge (and, eyes-free, the answers with their places).
  const spokenFor = React.useRef<string | null>(null);
  const speakingUntil = React.useRef(0);
  React.useEffect(() => {
    if (!prefs.speak || phase !== "running" || !current || spokenFor.current === current.id) return;
    spokenFor.current = current.id;
    const parts = [current.speech ?? ""];
    if (prefs.eyesFree && current.voice !== false && current.options.length <= 4) parts.push(readOptions(current.options.map((o) => o.label)));
    const text = parts.filter(Boolean).join(" ");
    if (!text) return;
    say(text);
    // Rough speaking time, so voice answers don't hear the prompt itself.
    speakingUntil.current = performance.now() + text.split(/\s+/).length * 330 + 250;
  }, [prefs.speak, prefs.eyesFree, phase, current]);

  // Voice answers: one listener for the session, matched against whatever is on screen.
  // "Pause" or "stop" pauses; while paused, "resume", "continue" or "go" brings it back.
  const listening = prefs.voiceAnswers && (phase === "running" || phase === "paused");
  React.useEffect(() => {
    if (!listening) return;
    const l = listen(
      (heard) => {
        const s = useStore.getState().active;
        if (!s) return;
        if (performance.now() < speakingUntil.current) return;
        const words = heard.toLowerCase();
        if (s.phase === "paused") {
          if (/\b(resume|continue|go|start)\b/.test(words)) resume();
          return;
        }
        if (/\b(pause|stop)\b/.test(words)) {
          pause();
          return;
        }
        const c = s.current;
        if (!c || c.voice === false || s.answered || s.presentedAt === null) return;
        const id = matchSpoken(heard, c.options);
        if (id) handleAnswer(id);
      },
      (message) => setVoiceNote(message),
    );
    return () => l.stop();
  }, [listening, handleAnswer, pause, resume]);

  // First-time coach line for each mode, on its first few challenges.
  const [seenAtStart] = React.useState(() => new Set(flags.seenModes));
  React.useEffect(() => {
    if (!current || phase !== "running") return;
    const mode = current.mode;
    if (seenAtStart.has(mode)) {
      setCoachMode(null);
      return;
    }
    const n = (coachCount.current[current.id] =
      coachCount.current[current.id] ?? Object.keys(coachCount.current).filter((k) => k.startsWith(`${mode}-`)).length + 1);
    setCoachMode(n <= COACH_TRIALS ? mode : null);
    markModeSeen(mode);
  }, [current, phase, seenAtStart, markModeSeen]);

  // A pause drops any pending advance; resume replays or re-generates the challenge.
  React.useEffect(() => {
    if (phase === "running") return;
    if (advanceTimer.current !== null) {
      window.clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
    setFeedback(null);
    hush();
    spokenFor.current = null;
  }, [phase]);

  React.useEffect(() => {
    if (phase !== "paused" || flags.pauseHintShown) return;
    setShowPauseHint(true);
    markPauseHintShown();
  }, [phase, flags.pauseHintShown, markPauseHintShown]);

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
  const bout = intervalAt(elapsed, active.intervals, active.playDuring);
  // The guided first round has its own three lines; after that, the per-mode coach.
  const guidedLine = active.guided && current ? GUIDED_COACH[active.trialIndex] : undefined;
  const coach = guidedLine ?? (coachMode && current?.mode === coachMode && !feedback ? MODE_INFO[current.mode].instruction : null);

  const easeTag = current?.eased ? easePhase(elapsed, active.durationSeconds) : null;

  return (
    <div
      className="session field"
      data-activity={active.activity}
      data-dark={prefs.darkSessions ? "true" : undefined}
      data-distance={prefs.distance}
      data-eyes-free={prefs.eyesFree ? "true" : undefined}
    >
      <div className="session-bar">
        {progress !== null ? (
          <div
            className={`rail${active.durationSeconds && active.durationSeconds * 1000 - elapsed < 10_000 ? " ending" : ""}`}
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
        {easeTag && <span className="phase-tag">{easeTag === "warm-up" ? "Warm-up" : "Cool-down"}</span>}
        <span className="clock num" aria-label={`Elapsed ${formatClock(elapsed)}`}>
          {formatClock(elapsed)}
        </span>
        {heart && Date.now() - heart.at < 10_000 && (
          <span className="hr num" aria-label={`Heart rate ${heart.bpm}, zone ${heart.zone}`}>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path
                d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.2 4.3 2.6.7-1.4 2.2-2.6 4.3-2.6 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z"
                fill="currentColor"
              />
            </svg>
            {heart.bpm} Z{heart.zone}
          </span>
        )}
        {active.streak >= 3 && (
          <span key={active.streak} className="streak num bump" aria-label={`${active.streak} in a row`}>
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

      {progressCue && (
        <p className="progress-cue" role="status">
          {progressCue}
        </p>
      )}

      {coach && (
        <p className="coach" role="status">
          {!guidedLine && <strong>New: {MODE_INFO[current!.mode].label}. </strong>}
          {coach}
        </p>
      )}

      <div className={`stack grow session-body${wiping ? " wipe" : ""}`} style={{ minHeight: 0 }}>
        {phase === "running" && View && current && !transition && !resting && (
          <View
            key={`${current.id}-${active.presentation}`}
            challenge={current}
            onAnswer={handleAnswer}
            onPresented={onPresented}
            feedback={feedback}
            entering={wiping}
          />
        )}
        {phase === "running" && resting && (
          <div className="rest-card" role="status" aria-live="polite">
            <p className="cue">{bout.bout === "rest" ? "Recovery" : "Work bout"}</p>
            <p className="display rest-clock num">{formatClock(bout.remainingMs)}</p>
            <p className="t-24">{bout.bout === "rest" ? "Challenges return at the next work bout." : "Challenges return at your next recovery."}</p>
          </div>
        )}
      </div>

      {voiceNote && (
        <p className="voice-note" role="alert">
          {voiceNote}
        </p>
      )}

      {phase === "countdown" && (
        <Countdown
          key={`${countdownKind}-${active.presentation}`}
          onFinished={onCountdownFinished}
          skippable={countdownKind === "resume"}
          label={countdownKind === "resume" ? "Back in" : active.daily ? "Daily challenge" : MODE_INFO[active.guided ? "mix" : active.requestedMode].label}
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
            {showPauseHint && <p className="t-17 hint">Tip: press and hold the pause button to end a session in one step.</p>}
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
