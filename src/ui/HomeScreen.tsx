import { APP_VERSION, lastSeenRelease, markReleaseSeen, releaseOf } from "../changelog";
import { WhatsNewSheet } from "./AboutSheets";
import React from "react";
import { unlockAudio } from "../audio/synth";
import { MODE_INFO } from "../modes/registry";
import { useStore } from "../state/store";
import { formatClock } from "../engine/session";
import { dailyKey, dailyNumber } from "../engine/daily";
import { dayStreak, sessionsThisWeek } from "../engine/insights";
import { Mark } from "./components";
import { ACTIVITY_LABEL, durationLabel, pct, secs } from "./copy";
import { SetupSheet } from "./SetupScreen";
import { InstallPrompt, shouldOfferInstall } from "./InstallPrompt";
import { UpdateToast } from "./UpdateToast";

/** Sessions this week against the weekly goal, as a ring. */
function GoalRing({ done, goal }: { done: number; goal: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const frac = Math.min(1, done / goal);
  const met = done >= goal;
  return (
    <div className="goal" role="img" aria-label={met ? `${done} sessions this week, weekly goal of ${goal} met` : `${done} of ${goal} sessions this week`}>
      <svg viewBox="0 0 64 64" aria-hidden="true">
        {met ? (
          <>
            <circle cx="32" cy="32" r="29.5" fill="currentColor" />
            <path className="goal-check" d="M20 33l8 8 16-17" fill="none" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : (
          <>
            <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeOpacity="0.28" strokeWidth="7" />
            <circle
              cx="32"
              cy="32"
              r={r}
              fill="none"
              stroke="currentColor"
              strokeWidth="7"
              strokeDasharray={`${c * frac} ${c}`}
              strokeLinecap={frac > 0 ? "round" : "butt"}
              transform="rotate(-90 32 32)"
            />
          </>
        )}
      </svg>
      <span className="goal-text">
        <strong className="num">{met ? `${done} this week` : `${done} of ${goal}`}</strong>
        <span>{met ? "Weekly goal met." : "this week"}</span>
      </span>
    </div>
  );
}

export function HomeScreen() {
  const setup = useStore((s) => s.setup);
  const history = useStore((s) => s.history);
  const recoverable = useStore((s) => s.recoverable);
  const error = useStore((s) => s.error);
  const flags = useStore((s) => s.flags);
  const prefs = useStore((s) => s.prefs);
  const requestStart = useStore((s) => s.requestStart);
  const resumeRecovered = useStore((s) => s.resumeRecovered);
  const discardRecovered = useStore((s) => s.discardRecovered);
  const clearError = useStore((s) => s.clearError);
  const go = useStore((s) => s.go);
  const markFeatureTipShown = useStore((s) => s.markFeatureTipShown);
  const [sheet, setSheet] = React.useState(false);
  const [install, setInstall] = React.useState(() => shouldOfferInstall(flags.installOffered, history.length));

  const today = dailyKey();
  const daily = history.find((h) => h.daily === today);
  const last = history.find((h) => !h.guided && !h.daily) ?? history[0];
  const week = sessionsThisWeek(history);
  const streakDays = dayStreak(history);

  // Enter starts, for keyboards. Ignored while a sheet is open.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || sheet || document.querySelector(".sheet") || (e.target as HTMLElement)?.closest?.("button, input")) return;
      unlockAudio();
      requestStart();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet, requestStart]);
  // After a third real session, point once at the features made for training without looking.
  const showTip = !flags.featureTipShown && !prefs.speak && history.filter((h) => !h.guided && !h.daily).length >= 3 && !recoverable && !error;
  // After an update, one quiet line pointing at what changed. A brand-new install starts caught up.
  const [newRelease, setNewRelease] = React.useState(() => {
    const seen = lastSeenRelease();
    if (seen === releaseOf(APP_VERSION)) return false;
    if (!seen && !history.some((h) => !h.guided)) {
      markReleaseSeen();
      return false;
    }
    return true;
  });
  const [notes, setNotes] = React.useState(false);
  const rival = useStore((s) => s.rival);
  const setRival = useStore((s) => s.setRival);
  const start = (opts?: { daily?: boolean | string }) => {
    unlockAudio();
    requestStart(opts);
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
          {setup.intervals !== "off" ? `, intervals ${setup.intervals}` : ""}
        </p>
        <GoalRing done={week} goal={prefs.weeklyGoal} />
        {streakDays >= 2 && <p className="streak-line">{streakDays} days in a row</p>}
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
        {newRelease && !showTip && (
          <div className="notice" role="status">
            Updated to {releaseOf(APP_VERSION)}.{" "}
            <button
              className="btn-text"
              onClick={() => {
                markReleaseSeen();
                setNewRelease(false);
                setNotes(true);
              }}
            >
              What's new
            </button>{" "}
            <button
              className="btn-text"
              onClick={() => {
                markReleaseSeen();
                setNewRelease(false);
              }}
            >
              Dismiss
            </button>
          </div>
        )}
        {notes && <WhatsNewSheet onClose={() => setNotes(false)} />}
        {showTip && (
          <div className="notice" role="status">
            Training outdoors? Read aloud and Eyes-free let you play without looking down.{" "}
            <button
              className="btn-text"
              onClick={() => {
                markFeatureTipShown();
                go("settings");
              }}
            >
              Open Settings
            </button>{" "}
            <button className="btn-text" onClick={markFeatureTipShown}>
              Dismiss
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
          <button className="btn-primary" onClick={() => start()}>
            Start
          </button>
        )}
        {rival ? (
          <div className="rival">
            <button className="daily-line btn-text" onClick={() => start({ daily: rival.daily })}>
              Beat a friend's {rival.score}% on Daily #{dailyNumber(rival.daily)}
            </button>
            <button className="btn-text rival-skip" onClick={() => setRival(null)} aria-label="Skip the friend's challenge">
              Skip
            </button>
          </div>
        ) : daily ? (
          <p className="daily-line">
            Daily #{dailyNumber(today)} done: {pct(daily.accuracy)}%. A new one tomorrow.
          </p>
        ) : (
          <button className="daily-line btn-text" onClick={() => start({ daily: true })}>
            Daily #{dailyNumber(today)}: 3 minutes, the same for everyone
          </button>
        )}
        <div className="btn-row spread">
          {recoverable && (
            <button className="btn-text" onClick={() => start()}>
              Start a new one
            </button>
          )}
          <button className="btn-text" onClick={() => setSheet(true)}>
            Change
          </button>
        </div>
        <p className="home-last">
          {last
            ? `Last time: ${pct(last.accuracy)}% accuracy, ${secs(last.avgRt)} average.`
            : "No sessions yet. Start one and your first result becomes your baseline."}
        </p>
        <div className="home-foot">
          <button className="btn-text quiet" onClick={() => go("history")}>
            History
          </button>
          <button className="btn-text quiet" onClick={() => go("insights")}>
            Insights
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
