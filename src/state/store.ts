import { create } from "zustand";
import type { Activity, Challenge, ModeChoice, ModeId, SessionResult, TrialResult } from "../engine/types";
import { hashSeed, mulberry32 } from "../engine/rng";
import { challengeScore, sessionMetrics } from "../engine/scoring";
import { createDifficultyState, updateDifficulty, type DifficultyState } from "../engine/difficulty";
import { GUIDED_BLOCK_MS, GUIDED_MODES, MIX_BLOCK_MS, mixModeAt } from "../engine/mix";
import { DAILY_BLOCK_MS, DAILY_SECONDS, dailyKey, dailyLevel, dailyModeAt, dailyModes, dailySeed } from "../engine/daily";
import { intervalAt } from "../engine/intervals";
import { ZONE_TIME_FACTOR, zoneFor, type Zone } from "../platform/heartRate";
import { logSessionToHealth } from "../platform/health";
import { AUTO_PAUSE_MS, DURATION_SECONDS, GUIDED_SECONDS, RESUME_WINDOW_MS, makeSessionId } from "../engine/session";
import { GENERATORS } from "../modes/generate";
import { isRhymeReady, loadRhymeData } from "../modes/generate/rhyme";
import {
  clearActiveSession,
  clearHistory,
  clearLocal,
  ALL_MODES,
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
  mergeHistory,
  parseImport,
  type Flags,
  type IntervalChoice,
  type PersistedProgress,
  type SessionSetup,
  type UserPrefs,
} from "../storage";

export type Screen = "boot" | "welcome" | "home" | "session" | "results" | "history" | "settings" | "insights";
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
  /** The modes this session's Mix rotates through, fixed at start. */
  mixModes: ModeId[];
  /** What each mode showed most recently in its current block (N-back reads it). */
  memory: Partial<Record<ModeId, string[]>>;
  intervals: IntervalChoice;
  playDuring: "work" | "rest";
  /** Daily challenge date key, or null. */
  daily: string | null;
  moodBefore?: number;
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
  /** Intervals: the quiet part of the cycle, no challenge on screen. */
  resting: boolean;
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
  /** A start waiting on the mood check-in. */
  pendingStart: { daily?: boolean } | null;
  /** Live heart rate from a connected strap. */
  heart: { bpm: number; zone: Zone; at: number; device: string } | null;
  setHeart: (bpm: number | null, device?: string) => void;

  boot: () => Promise<void>;
  go: (screen: Screen) => void;
  chooseActivity: (activity: Activity) => void;
  updateSetup: (patch: Partial<SessionSetup>) => void;
  updatePrefs: (patch: Partial<UserPrefs>) => void;
  markInstallOffered: () => void;
  startSession: (options?: { guided?: boolean; daily?: boolean; moodBefore?: number }) => Promise<void>;
  /** Start, asking how you feel first when mood check-ins are on. */
  requestStart: (options?: { daily?: boolean }) => void;
  cancelStart: () => void;
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
  updateResult: (id: string, patch: Partial<Pick<SessionResult, "rpe" | "moodAfter">>) => void;
  importData: (text: string) => Promise<string>;
  markModeSeen: (mode: ModeId) => void;
  markPauseHintShown: () => void;
  markBackedUp: () => void;
}

const now = () => performance.now();

export function elapsedMs(active: Pick<ActiveSession, "elapsedMs" | "runningSince"> | null): number {
  if (!active) return 0;
  return active.elapsedMs + (active.runningSince !== null ? now() - active.runningSince : 0);
}

type Plan = Pick<SessionSnapshot, "requestedMode" | "guided" | "seed" | "mixModes" | "daily">;

/** Every mode this session can show. */
function modesOf(s: Plan): ModeId[] {
  if (s.guided) return GUIDED_MODES;
  if (s.daily) return dailyModes(s.daily);
  if (s.requestedMode === "mix") return s.mixModes;
  return [s.requestedMode];
}

const needsRhyme = (s: Plan) => modesOf(s).includes("rhyme");
const isMixing = (s: Plan) => s.guided || Boolean(s.daily) || s.requestedMode === "mix";

function modeFor(s: Plan, block: number): ModeId {
  if (s.guided) return mixModeAt(s.seed, block, GUIDED_MODES);
  if (s.daily) return dailyModeAt(s.daily, block);
  if (s.requestedMode === "mix") return mixModeAt(s.seed, block, s.mixModes);
  return s.requestedMode;
}

function blockMs(s: Plan): number {
  return s.guided ? GUIDED_BLOCK_MS : s.daily ? DAILY_BLOCK_MS : MIX_BLOCK_MS;
}

/** Live heart-rate zone, if a strap has reported in the last 10 seconds. */
function liveZone(): Zone | null {
  const h = useStore.getState().heart;
  return h && Date.now() - h.at < 10_000 ? h.zone : null;
}

function makeChallenge(s: ActiveSession, mode: ModeId, bias: UserPrefs["difficultyBias"]): Challenge {
  const c = baseChallenge(s, mode, bias);
  // Working hard? Give more time to answer. The daily stays identical for everyone.
  const zone = s.daily ? null : liveZone();
  if (!zone || ZONE_TIME_FACTOR[zone] === 1) return c;
  const f = ZONE_TIME_FACTOR[zone];
  return { ...c, targetRt: c.targetRt * f, timeoutMs: c.timeoutMs ? Math.round(c.timeoutMs * f) : undefined };
}

function baseChallenge(s: ActiveSession, mode: ModeId, bias: UserPrefs["difficultyBias"]): Challenge {
  // The daily challenge ignores personal levels and timing so everyone plays the same thing.
  const level = s.daily ? dailyLevel(s.mixBlock) : (s.levels[mode] ?? createDifficultyState()).level;
  const rng = mulberry32(hashSeed([s.seed, mode, s.trialIndex, level]));
  return GENERATORS[mode](level, rng, {
    activity: s.daily ? "walk" : s.activity,
    bias: s.daily ? "standard" : bias,
    seed: s.seed,
    trialIndex: s.trialIndex,
    modeTrialIndex: s.modeCounts[mode] ?? 0,
    recent: s.memory[mode] ?? [],
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
    mixModes: a.mixModes,
    memory: a.memory,
    intervals: a.intervals,
    playDuring: a.playDuring,
    daily: a.daily,
    moodBefore: a.moodBefore,
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
      daily: stopped.daily ?? undefined,
      moodBefore: stopped.moodBefore,
      intervals: stopped.intervals === "off" ? undefined : `${stopped.intervals} ${stopped.playDuring}`,
      avgHr: (() => {
        const hrs = stopped.trials.map((t) => t.hr).filter((x): x is number => typeof x === "number");
        return hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : undefined;
      })(),
      trials: stopped.trials,
    };
    if (get().prefs.logToHealth) void logSessionToHealth(result);
    const history = [result, ...get().history];
    // The daily challenge plays at fixed levels, so it teaches the controller nothing about you.
    const progress = stopped.daily ? get().progress : { ...get().progress, ...stopped.levels };
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
    pendingStart: null,
    heart: null,

    setHeart: (bpm, device) => {
      if (bpm === null) {
        set({ heart: null });
        return;
      }
      const prev = get().heart;
      set({ heart: { bpm, zone: zoneFor(bpm, get().prefs.maxHr), at: Date.now(), device: device ?? prev?.device ?? "Heart-rate strap" } });
    },

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
      const daily = options.daily ? dailyKey() : null;
      const { setup, progress } = get();
      const seed = daily ? dailySeed(daily) : hashSeed([Date.now(), Math.random()]);
      const durationSeconds =
        durationOverride() ?? (guided ? GUIDED_SECONDS : daily ? DAILY_SECONDS : setup.duration === "open" ? null : DURATION_SECONDS[setup.duration]);
      const mixModes = setup.mixModes.filter((m) => ALL_MODES.includes(m));
      const base: Plan = {
        requestedMode: guided || daily ? ("mix" as const) : setup.mode,
        guided,
        seed,
        daily,
        mixModes: mixModes.length >= 2 ? mixModes : ALL_MODES,
      };
      const first = modeFor(base, 0);
      void clearActiveSession();
      set({
        recoverable: null,
        error: null,
        pendingStart: null,
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
          memory: {},
          // Intervals belong to a training session, not to the first round or the daily.
          intervals: guided || daily ? "off" : setup.intervals,
          playDuring: setup.playDuring,
          moodBefore: options.moodBefore,
          resting: false,
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
      if (needsRhyme(base) && !isRhymeReady()) {
        try {
          await loadRhymeData();
        } catch {
          set({ active: null, screen: "home", error: "Rhyme words didn't load. Connect once to download them, then try again." });
        }
      }
    },

    requestStart: (options = {}) => {
      if (get().prefs.moodCheckIn) set({ pendingStart: options });
      else void get().startSession(options);
    },

    cancelStart: () => set({ pendingStart: null }),

    countdownDone: () => {
      const a = get().active;
      if (!a || a.phase !== "countdown") return;
      if (needsRhyme(a) && !isRhymeReady()) return; // still loading; the countdown waits
      let next: ActiveSession = { ...a, phase: "running", runningSince: now(), presentedAt: null, answered: false };
      if (!intervalAt(elapsedMs(next), next.intervals, next.playDuring).playing) {
        next = { ...next, current: null, resting: true };
      } else if (!next.current) {
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
      if (!a || a.phase !== "running" || !a.current || a.answered || a.presentedAt === null || a.transition || a.resting) return null;
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
        hr: liveZone() ? get().heart!.bpm : undefined,
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
      const memo = challenge.data.memo;
      const memory = typeof memo === "string" ? { ...a.memory, [challenge.mode]: [...(a.memory[challenge.mode] ?? []), memo].slice(-4) } : a.memory;
      set({
        active: {
          ...a,
          memory,
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
      if (!intervalAt(elapsed, a.intervals, a.playDuring).playing) {
        set({ active: { ...a, current: null, resting: true, presentedAt: null } });
        return;
      }
      const mixing = isMixing(a);
      const block = mixing ? Math.floor(elapsed / blockMs(a)) : 0;
      if (mixing && block !== a.mixBlock) {
        const mode = modeFor(a, block);
        // A new block starts its own stream: N-back must not compare against a letter from minutes ago.
        const memory = { ...a.memory, [mode]: [] };
        set({ active: { ...a, mixBlock: block, currentMode: mode, current: null, transition: mode, presentedAt: null, memory } });
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
          resting: false,
          current: a.answered || a.transition || a.resting ? null : a.current,
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
      const elapsed = elapsedMs(a);
      if (a.durationSeconds !== null && elapsed >= a.durationSeconds * 1000) {
        finish();
        return;
      }
      if (a.resting && intervalAt(elapsed, a.intervals, a.playDuring).playing) {
        // Back on: pick up at the right Mix block, with a fresh challenge.
        const mixing = isMixing(a);
        const block = mixing ? Math.floor(elapsed / blockMs(a)) : a.mixBlock;
        const mode = mixing ? modeFor(a, block) : a.currentMode;
        const next: ActiveSession = { ...a, resting: false, mixBlock: block, currentMode: mode, answered: false, presentedAt: null };
        set({ active: { ...next, current: makeChallenge(next, mode, get().prefs.difficultyBias) } });
        return;
      }
      if (Date.now() - a.savedAt > 5000) {
        const snap = snapshotOf(a);
        set({ active: { ...a, savedAt: snap.savedAt } });
        void saveActiveSession(snap);
      }
    },

    endSession: finish,

    resumeRecovered: async () => {
      const snap = get().recoverable;
      if (!snap) return;
      // Snapshots saved by an older version lack the newer fields.
      const defaults = { mixModes: ALL_MODES, memory: {}, intervals: "off" as const, playDuring: "work" as const, daily: null };
      const restored = { ...defaults, ...(snap as Partial<SessionSnapshot>) } as SessionSnapshot;
      if (needsRhyme(restored) && !isRhymeReady()) {
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
          ...restored,
          current: snap.answered ? null : snap.current,
          resting: false,
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

    updateResult: (id, patch) => {
      const history = get().history.map((h) => (h.id === id ? { ...h, ...patch } : h));
      const last = get().lastResult;
      void saveHistory(history);
      set({ history, lastResult: last && last.id === id ? { ...last, ...patch } : last });
    },

    importData: async (text) => {
      const parsed = parseImport(text);
      if (typeof parsed === "string") return parsed;
      const { history, added } = mergeHistory(get().history, parsed.history);
      await saveHistory(history);
      const progress = { ...(parsed.progress ?? {}), ...get().progress };
      saveProgress(progress);
      set({ history, progress, lastResult: get().lastResult ?? history[0] ?? null });
      return added ? `Imported ${added} ${added === 1 ? "session" : "sessions"}.` : "Those sessions are already here. Nothing new to import.";
    },

    markModeSeen: (mode) => {
      const f = get().flags;
      if (f.seenModes.includes(mode)) return;
      const flags = { ...f, seenModes: [...f.seenModes, mode] };
      saveFlags(flags);
      set({ flags });
    },

    markPauseHintShown: () => {
      const flags = { ...get().flags, pauseHintShown: true };
      saveFlags(flags);
      set({ flags });
    },

    markBackedUp: () => {
      const flags = { ...get().flags, lastBackupAt: Date.now() };
      saveFlags(flags);
      set({ flags });
    },
  };
});

// Test seam: e2e scripts on localhost can read the current challenge to answer it correctly.
if (typeof location !== "undefined" && ["localhost", "127.0.0.1"].includes(location.hostname)) {
  (globalThis as unknown as { __cbStore?: typeof useStore }).__cbStore = useStore;
}
