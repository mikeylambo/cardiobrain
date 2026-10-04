import { create } from "zustand";
import type { Activity, Challenge, ModeChoice, ModeId, SessionResult, TrialResult } from "../engine/types";
import { hashSeed, mulberry32 } from "../engine/rng";
import { challengeScore, sessionMetrics } from "../engine/scoring";
import { createDifficultyState, updateDifficulty, type DifficultyState } from "../engine/difficulty";
import { GUIDED_BLOCK_MS, GUIDED_MODES, MIX_BLOCK_MS, MIX_MODES, mixModeAt } from "../engine/mix";
import { AUTO_PAUSE_MS, DURATION_SECONDS, GUIDED_SECONDS, RESUME_WINDOW_MS, makeSessionId } from "../engine/session";
import { GENERATORS } from "../modes/generate";
import { isRhymeReady, loadRhymeData } from "../modes/generate/rhyme";
import {
  clearActiveSession,
  clearHistory,
  clearLocal,
  DEFAULT_FLAGS,
  DEFAULT_PREFS,
  DEFAULT_SETUP,
  loadActiveSession,
  loadFlags,
  loadHistory,
  loadPrefs,
  loadProgress,
  loadSetup,
  saveActiveSession,
  saveFlags,
  saveHistory,
  savePrefs,
  saveProgress,
  saveSetup,
  type Flags,
  type PersistedProgress,
  type SessionSetup,
  type UserPrefs,
} from "../storage";

export type Screen = "boot" | "welcome" | "home" | "session" | "results" | "history" | "settings";
export type SessionPhase = "countdown" | "running" | "paused";

/** Everything about a session that survives a reload. Timing is stored as elapsed running time, never as wall-clock. */
export interface SessionSnapshot {
  id: string;
  activity: Activity;
  requestedMode: ModeChoice;
  durationSeconds: number | null;
  guided: boolean;
  seed: number;
  startedAt: number;
  elapsedMs: number;
  trialIndex: number;
  modeCounts: Partial<Record<ModeId, number>>;
  currentMode: ModeId;
  current: Challenge | null;
  /** The current challenge already has a logged answer. */
  answered: boolean;
  trials: TrialResult[];
  streak: number;
  bestStreak: number;
  levels: PersistedProgress;
  mixBlock: number;
  savedAt: number;
}

export interface ActiveSession extends SessionSnapshot {
  phase: SessionPhase;
  /** Countdown flavour: the first start plays the color wipe, a resume does not. */
  countdownKind: "start" | "resume";
  /** performance.now() when the clock last started, null while it is stopped. */
  runningSince: number | null;
  /** performance.now() when the current challenge became answerable. */
  presentedAt: number | null;
  /** Bumped to re-mount the challenge view (a resume replays the challenge from the top). */
  presentation: number;
  /** Mix: the mode the transition card is announcing. */
  transition: ModeId | null;
  hiddenAt: number | null;
}

export interface AnswerOutcome {
  correct: boolean;
  streak: number;
  milestone: boolean;
}

interface State {
  screen: Screen;
  prefs: UserPrefs;
  setup: SessionSetup;
  flags: Flags;
  progress: PersistedProgress;
  history: SessionResult[];
  active: ActiveSession | null;
  recoverable: SessionSnapshot | null;
  lastResult: SessionResult | null;
  error: string | null;

  boot: () => Promise<void>;
  go: (screen: Screen) => void;
  chooseActivity: (activity: Activity) => void;
  updateSetup: (patch: Partial<SessionSetup>) => void;
  updatePrefs: (patch: Partial<UserPrefs>) => void;
  markInstallOffered: () => void;
  startSession: (options?: { guided?: boolean }) => Promise<void>;
  countdownDone: () => void;
  markPresented: () => void;
  answer: (answerId: string) => AnswerOutcome | null;
  advance: () => void;
  endTransition: () => void;
  pause: () => void;
  resume: () => void;
  backgrounded: () => void;
  foregrounded: () => void;
  tick: () => void;
  endSession: () => void;
  resumeRecovered: () => Promise<void>;
  discardRecovered: () => void;
  deleteAllData: () => Promise<void>;
  clearError: () => void;
}

const now = () => performance.now();

export function elapsedMs(active: Pick<ActiveSession, "elapsedMs" | "runningSince"> | null): number {
  if (!active) return 0;
  return active.elapsedMs + (active.runningSince !== null ? now() - active.runningSince : 0);
}

const needsRhyme = (mode: ModeChoice, guided: boolean) => !guided && (mode === "rhyme" || mode === "mix");

function modeFor(s: Pick<SessionSnapshot, "requestedMode" | "guided" | "seed">, block: number): ModeId {
  if (s.guided) return mixModeAt(s.seed, block, GUIDED_MODES);
  if (s.requestedMode === "mix") return mixModeAt(s.seed, block, MIX_MODES);
  return s.requestedMode;
}

function blockMs(s: Pick<SessionSnapshot, "guided">): number {
  return s.guided ? GUIDED_BLOCK_MS : MIX_BLOCK_MS;
}

function makeChallenge(s: ActiveSession, mode: ModeId, bias: UserPrefs["difficultyBias"]): Challenge {
  const state = s.levels[mode] ?? createDifficultyState();
  const rng = mulberry32(hashSeed([s.seed, mode, s.trialIndex, state.level]));
  return GENERATORS[mode](state.level, rng, {
    activity: s.activity,
    bias,
    seed: s.seed,
    trialIndex: s.trialIndex,
    modeTrialIndex: s.modeCounts[mode] ?? 0,
  });
}

function snapshotOf(a: ActiveSession): SessionSnapshot {
  return {
    id: a.id,
    activity: a.activity,
    requestedMode: a.requestedMode,
    durationSeconds: a.durationSeconds,
    guided: a.guided,
    seed: a.seed,
    startedAt: a.startedAt,
    elapsedMs: elapsedMs(a),
    trialIndex: a.trialIndex,
    modeCounts: a.modeCounts,
    currentMode: a.currentMode,
    current: a.current,
    answered: a.answered,
    trials: a.trials,
    streak: a.streak,
    bestStreak: a.bestStreak,
    levels: a.levels,
    mixBlock: a.mixBlock,
    savedAt: Date.now(),
  };
}

/** Test seam: a fixed short duration on localhost only, so e2e runs do not take 10 minutes. */
function durationOverride(): number | null {
  try {
    if (!["localhost", "127.0.0.1"].includes(location.hostname)) return null;
    const raw = sessionStorage.getItem("cb-test-duration-seconds");
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

export const MILESTONES = new Set([5, 10, 25]);

export const useStore = create<State>((set, get) => {
  const persist = () => {
    const a = get().active;
    if (a) void saveActiveSession(snapshotOf(a));
  };

  const stopClock = (a: ActiveSession): ActiveSession => ({ ...a, elapsedMs: elapsedMs(a), runningSince: null });

  const finish = () => {
    const a = get().active;
    if (!a) return;
    const stopped = stopClock(a);
    if (stopped.guided && !get().flags.onboarded) {
      const flags = { ...get().flags, onboarded: true };
      saveFlags(flags);
      set({ flags });
    }
    if (!stopped.trials.length) {
      set({ active: null, screen: "home" });
      void clearActiveSession();
      return;
    }
    const metrics = sessionMetrics(stopped.trials);
    const result: SessionResult = {
      id: stopped.id,
      activity: stopped.activity,
      requestedMode: stopped.requestedMode,
      durationSeconds: Math.round(stopped.elapsedMs / 1000),
      ...metrics,
      startedAt: stopped.startedAt,
      finishedAt: Date.now(),
      guided: stopped.guided || undefined,
      trials: stopped.trials,
    };
    const history = [result, ...get().history];
    const progress = { ...get().progress, ...stopped.levels };
    saveProgress(progress);
    void saveHistory(history);
    void clearActiveSession();
    set({ active: null, history, progress, lastResult: result, screen: "results" });
  };

  return {
    screen: "boot",
    prefs: DEFAULT_PREFS,
    setup: DEFAULT_SETUP,
    flags: DEFAULT_FLAGS,
    progress: {},
    history: [],
    active: null,
    recoverable: null,
    lastResult: null,
    error: null,

    boot: async () => {
      const prefs = loadPrefs();
      const setup = loadSetup();
      const flags = loadFlags();
      const progress = loadProgress();
      const [history, snapshot] = await Promise.all([loadHistory(), loadActiveSession<SessionSnapshot>()]);
      const fresh = snapshot && Date.now() - snapshot.savedAt < RESUME_WINDOW_MS && snapshot.trials ? snapshot : null;
      if (snapshot && !fresh) void clearActiveSession();
      set({
        prefs,
        setup,
        flags,
        progress,
        history,
        recoverable: fresh,
        lastResult: history[0] ?? null,
        screen: flags.onboarded ? "home" : "welcome",
      });
    },

    go: (screen) => set({ screen }),

    chooseActivity: (activity) => {
      const setup = { ...get().setup, activity };
      saveSetup(setup);
      set({ setup });
    },

    updateSetup: (patch) => {
      const setup = { ...get().setup, ...patch };
      saveSetup(setup);
      set({ setup });
    },

    updatePrefs: (patch) => {
      const prefs = { ...get().prefs, ...patch };
      savePrefs(prefs);
      set({ prefs });
    },

    markInstallOffered: () => {
      const flags = { ...get().flags, installOffered: true };
      saveFlags(flags);
      set({ flags });
    },

    startSession: async (options = {}) => {
      const guided = Boolean(options.guided);
      const { setup, progress } = get();
      const seed = hashSeed([Date.now(), Math.random()]);
      const durationSeconds = durationOverride() ?? (guided ? GUIDED_SECONDS : setup.duration === "open" ? null : DURATION_SECONDS[setup.duration]);
      const base = { requestedMode: guided ? ("mix" as const) : setup.mode, guided, seed };
      const first = modeFor(base, 0);
      void clearActiveSession();
      set({
        recoverable: null,
        error: null,
        screen: "session",
        active: {
          id: makeSessionId(),
          activity: setup.activity,
          ...base,
          durationSeconds,
          startedAt: Date.now(),
          elapsedMs: 0,
          trialIndex: 0,
          modeCounts: {},
          currentMode: first,
          current: null,
          trials: [],
          streak: 0,
          bestStreak: 0,
          // Guided first rounds start everyone at the calibration level.
          levels: guided ? {} : { ...progress },
          mixBlock: 0,
          savedAt: Date.now(),
          phase: "countdown",
          countdownKind: "start",
          runningSince: null,
          presentedAt: null,
          answered: false,
          presentation: 0,
          transition: null,
          hiddenAt: null,
        },
      });
      if (needsRhyme(base.requestedMode, guided) && !isRhymeReady()) {
        try {
          await loadRhymeData();
        } catch {
          set({ active: null, screen: "home", error: "Rhyme words didn't load. Connect once to download them, then try again." });
        }
      }
    },

    countdownDone: () => {
      const a = get().active;
      if (!a || a.phase !== "countdown") return;
      if (needsRhyme(a.requestedMode, a.guided) && !isRhymeReady()) return; // still loading; the countdown waits
      let next: ActiveSession = { ...a, phase: "running", runningSince: now(), presentedAt: null, answered: false };
      if (!next.current) {
        next = { ...next, current: makeChallenge(next, next.currentMode, get().prefs.difficultyBias) };
      } else {
        next = { ...next, presentation: next.presentation + 1 };
      }
      set({ active: next });
      persist();
    },

    markPresented: () => {
      const a = get().active;
      if (!a || a.phase !== "running" || a.presentedAt !== null) return;
      set({ active: { ...a, presentedAt: now() } });
    },

    answer: (answerId) => {
      const a = get().active;
      if (!a || a.phase !== "running" || !a.current || a.answered || a.presentedAt === null || a.transition) return null;
      const challenge = a.current;
      const { difficultyBias } = get().prefs;
      const withheld = answerId === challenge.timeoutAnswer && answerId === challenge.correctAnswer;
      const correct = answerId === challenge.correctAnswer;
      // A withheld no-go has no response time; it would only drag the average toward the window.
      const responseMs = withheld ? 0 : Math.max(0, now() - a.presentedAt);
      const streak = correct ? a.streak + 1 : 0;
      const trial: TrialResult = {
        id: `${a.id}-${a.trialIndex}`,
        challengeId: challenge.id,
        mode: challenge.mode,
        level: challenge.level,
        answerId,
        correctAnswer: challenge.correctAnswer,
        correct,
        responseMs,
        score: challengeScore(correct, challenge.level, responseMs, challenge.targetRt, streak, difficultyBias),
        streak,
        switchTrial: challenge.switchTrial,
        timestamp: Date.now(),
      };
      const prior: DifficultyState = a.levels[challenge.mode] ?? createDifficultyState();
      const level = updateDifficulty(
        prior,
        { correct, responseMs: responseMs || challenge.targetRt, targetRt: challenge.targetRt },
        a.activity,
        challenge.mode,
        difficultyBias,
      );
      set({
        active: {
          ...a,
          answered: true,
          trials: [...a.trials, trial],
          streak,
          bestStreak: Math.max(a.bestStreak, streak),
          levels: { ...a.levels, [challenge.mode]: level },
          modeCounts: { ...a.modeCounts, [challenge.mode]: (a.modeCounts[challenge.mode] ?? 0) + 1 },
          trialIndex: a.trialIndex + 1,
        },
      });
      return { correct, streak, milestone: correct && MILESTONES.has(streak) };
    },

    advance: () => {
      const a = get().active;
      if (!a || a.phase !== "running" || !a.answered) return;
      const elapsed = elapsedMs(a);
      if (a.durationSeconds !== null && elapsed >= a.durationSeconds * 1000) {
        finish();
        return;
      }
      const mixing = a.guided || a.requestedMode === "mix";
      const block = mixing ? Math.floor(elapsed / blockMs(a)) : 0;
      if (mixing && block !== a.mixBlock) {
        const mode = modeFor(a, block);
        set({ active: { ...a, mixBlock: block, currentMode: mode, current: null, transition: mode, presentedAt: null } });
        return;
      }
      const current = makeChallenge(a, a.currentMode, get().prefs.difficultyBias);
      set({ active: { ...a, current, answered: false, presentedAt: null } });
    },

    endTransition: () => {
      const a = get().active;
      if (!a || !a.transition) return;
      const next = { ...a, transition: null, answered: false, presentedAt: null };
      set({ active: { ...next, current: makeChallenge(next, next.currentMode, get().prefs.difficultyBias) } });
    },

    pause: () => {
      const a = get().active;
      if (!a || a.phase === "paused") return;
      set({ active: { ...stopClock(a), phase: "paused", hiddenAt: null } });
      persist();
    },

    resume: () => {
      const a = get().active;
      if (!a || a.phase !== "paused") return;
      // An unanswered challenge is replayed from the top after the countdown.
      set({
        active: {
          ...a,
          phase: "countdown",
          countdownKind: "resume",
          presentedAt: null,
          answered: false,
          transition: null,
          current: a.answered || a.transition ? null : a.current,
        },
      });
    },

    backgrounded: () => {
      const a = get().active;
      if (!a || a.hiddenAt !== null || a.phase === "paused") return;
      if (a.phase === "countdown") {
        set({ active: { ...a, phase: "paused" } });
        persist();
        return;
      }
      set({ active: { ...stopClock(a), hiddenAt: now() } });
      persist();
    },

    foregrounded: () => {
      const a = get().active;
      if (!a || a.hiddenAt === null) return;
      const away = now() - a.hiddenAt;
      if (a.phase !== "running") {
        set({ active: { ...a, hiddenAt: null } });
        return;
      }
      if (away > AUTO_PAUSE_MS) {
        set({ active: { ...a, phase: "paused", hiddenAt: null } });
        persist();
        return;
      }
      // A glance away: carry on, and do not charge the time away to the response.
      set({
        active: {
          ...a,
          hiddenAt: null,
          runningSince: now(),
          presentedAt: a.presentedAt !== null ? a.presentedAt + away : null,
        },
      });
    },

    tick: () => {
      const a = get().active;
      if (!a || a.phase !== "running") return;
      if (a.durationSeconds !== null && elapsedMs(a) >= a.durationSeconds * 1000) finish();
      else if (Date.now() - a.savedAt > 5000) {
        const snap = snapshotOf(a);
        set({ active: { ...a, savedAt: snap.savedAt } });
        void saveActiveSession(snap);
      }
    },

    endSession: finish,

    resumeRecovered: async () => {
      const snap = get().recoverable;
      if (!snap) return;
      if (needsRhyme(snap.requestedMode, snap.guided) && !isRhymeReady()) {
        try {
          await loadRhymeData();
        } catch {
          set({ error: "Rhyme words didn't load. Connect once to download them, then try again." });
          return;
        }
      }
      set({
        recoverable: null,
        screen: "session",
        active: {
          ...snap,
          current: snap.answered ? null : snap.current,
          phase: "paused",
          countdownKind: "resume",
          runningSince: null,
          presentedAt: null,
          answered: false,
          presentation: 0,
          transition: null,
          hiddenAt: null,
        },
      });
    },

    discardRecovered: () => {
      void clearActiveSession();
      set({ recoverable: null });
    },

    deleteAllData: async () => {
      clearLocal();
      await Promise.all([clearHistory(), clearActiveSession()]);
      set({
        prefs: DEFAULT_PREFS,
        setup: DEFAULT_SETUP,
        flags: DEFAULT_FLAGS,
        progress: {},
        history: [],
        active: null,
        recoverable: null,
        lastResult: null,
        screen: "welcome",
      });
    },

    clearError: () => set({ error: null }),
  };
});
