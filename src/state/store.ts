import { create } from "zustand";
import type { Activity, Challenge, DifficultyBias, DurationChoice, ModeId, SessionResult, SessionStatus, TrialResult } from "../engine/types";
import { hashSeed, mulberry32 } from "../engine/rng";
import { MIX_MODE_IDS, CORE_MODE_IDS, MODE_REGISTRY } from "../modes/registry";
import { challengeScore, sessionMetrics } from "../engine/scoring";
import { createDifficultyState, targetResponseMs, updateDifficulty, type DifficultyState } from "../engine/difficulty";
import { makeSessionId, transition } from "../engine/session";
import { clearActiveSession, loadActiveSession, loadHistory, loadPrefs, loadProgress, saveActiveSession, saveHistory, savePrefs, saveProgress } from "../storage";

export type AppScreen = "home" | "setup" | "countdown" | "session" | "results" | "history" | "settings" | "onboarding";

export interface UserPrefs {
  sound: boolean;
  haptics: boolean;
  reducedMotion: boolean;
  difficultyBias: DifficultyBias;
}

export type PersistedProgress = Partial<Record<ModeId, DifficultyState>>;

export interface ActiveSessionSnapshot {
  id: string;
  activity: Activity;
  requestedMode: ModeId | "mix";
  durationChoice: DurationChoice;
  durationSeconds: number | null;
  startedAt: number;
  pausedTotalMs: number;
  pauseStartedAt: number | null;
  status: SessionStatus;
  seed: number;
  trialIndex: number;
  currentChallenge: Challenge;
  currentMode: ModeId;
  trialLog: TrialResult[];
  streak: number;
  bestStreak: number;
  difficulty: PersistedProgress;
}

interface ActiveSession extends ActiveSessionSnapshot {
  trialStartedPerf: number;
}

const DEFAULT_PREFS: UserPrefs = { sound:true, haptics:true, reducedMotion:false, difficultyBias:"standard" };
const DEFAULT_PROGRESS: PersistedProgress = {};
const DURATION_SECONDS: Record<Exclude<DurationChoice, "open">, number> = { 10:600, 20:1200, 30:1800 };

function newChallenge(mode: ModeId, level: number, activity: Activity, bias: DifficultyBias, seed: number, trialIndex: number): Challenge {
  const rng = mulberry32(hashSeed([seed, mode, trialIndex, level]));
  const definition = MODE_REGISTRY[mode];
  if (mode === "rhyme" && definition.View.toString() === "() => null") throw new Error("Rhyme Rush is not ready.");
  return definition.generate(level, rng, { activity, bias, seed, trialIndex });
}

function ensureProgress(progress: PersistedProgress): PersistedProgress {
  const output = { ...DEFAULT_PROGRESS, ...progress };
  for (const mode of CORE_MODE_IDS) if (!output[mode]) output[mode] = createDifficultyState();
  return output;
}

function elapsedSeconds(session: ActiveSession): number {
  const now = Date.now();
  const livePause = session.status === "paused" && session.pauseStartedAt ? now - session.pauseStartedAt : 0;
  return Math.max(0, (now - session.startedAt - session.pausedTotalMs - livePause) / 1000);
}

function modeFor(requestedMode: ModeId | "mix", elapsed: number, trialIndex: number): ModeId {
  if (requestedMode !== "mix") return requestedMode;
  const block = Math.floor(elapsed / 75);
  return MIX_MODE_IDS[(block + Math.floor(trialIndex / 6)) % MIX_MODE_IDS.length]!;
}

function configuredDurationSeconds(choice: DurationChoice): number | null {
  if (choice === "open") return null;
  if (typeof window !== "undefined" && (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost")) {
    try {
      const override = Number(sessionStorage.getItem("cb-test-duration-seconds"));
      if (Number.isFinite(override) && override > 0 && override < 3600) return override;
    } catch {}
  }
  return DURATION_SECONDS[choice];
}

interface Store {
  screen: AppScreen;
  hydrated: boolean;
  notice: string | null;
  history: SessionResult[];
  prefs: UserPrefs;
  progress: PersistedProgress;
  onboardingDone: boolean;
  resumeAvailable: boolean;
  setup: { activity: Activity; mode: ModeId | "mix"; duration: DurationChoice };
  active: ActiveSession | null;
  lastResult: SessionResult | null;

  hydrate: () => Promise<void>;
  setScreen: (screen: AppScreen) => void;
  setSetup: (patch: Partial<Store["setup"]>) => void;
  updatePrefs: (patch: Partial<UserPrefs>) => void;
  completeOnboarding: () => void;
  startCountdown: () => void;
  finishCountdown: () => void;
  pauseSession: () => void;
  resumeCountdown: () => void;
  presentChallenge: () => void;
  answer: (answerId: string) => void;
  finishSession: () => void;
  resumeSession: () => void;
  discardResume: () => Promise<void>;
  resetData: () => Promise<void>;
  exportAll: () => Promise<void>;
  dismissNotice: () => void;
}

export const useCardioStore = create<Store>((set, get) => ({
  screen: "home",
  hydrated: false,
  notice: null,
  history: [],
  prefs: DEFAULT_PREFS,
  progress: DEFAULT_PROGRESS,
  onboardingDone: false,
  resumeAvailable: false,
  setup: { activity:"walk", mode:"mix", duration:10 },
  active:null,
  lastResult:null,

  hydrate: async () => {
    const [history, activeSnapshot] = await Promise.all([loadHistory(), loadActiveSession()]);
    const prefs = loadPrefs();
    const progress = ensureProgress(loadProgress());
    const onboardingDone = localStorage.getItem("cb-onboarding") === "1";
    const resumable = Boolean(activeSnapshot && Date.now() - activeSnapshot.startedAt < 30 * 60 * 1000 && activeSnapshot.status !== "finished");
    const active = resumable && activeSnapshot ? { ...activeSnapshot, trialStartedPerf: performance.now() } : null;
    if (!resumable && activeSnapshot) await clearActiveSession();
    set({
      hydrated:true, history, prefs, progress, onboardingDone,
      resumeAvailable:Boolean(resumable),
      active
    });
  },

  setScreen: (screen) => set({ screen }),
  setSetup: (patch) => set((state) => ({ setup:{...state.setup,...patch} })),
  updatePrefs: (patch) => set((state) => {
    const prefs = {...state.prefs,...patch};
    savePrefs(prefs);
    document.documentElement.dataset.reducedMotion = prefs.reducedMotion ? "true" : "false";
    return {prefs};
  }),
  completeOnboarding: () => {
    try { localStorage.setItem("cb-onboarding","1"); } catch {}
    set({onboardingDone:true,screen:"setup"});
  },

  startCountdown: () => {
    const {setup, progress, prefs} = get();
    const seed = hashSeed([Date.now(), setup.activity, setup.mode, Math.random()]);
    const mode = modeFor(setup.mode, 0, 0);
    const state = ensureProgress(progress);
    const level = state[mode]?.level ?? 1;
    const challenge = newChallenge(mode, level, setup.activity, prefs.difficultyBias, seed, 0);
    const durationSeconds = configuredDurationSeconds(setup.duration);
    const active:ActiveSession = {
      id:makeSessionId(),
      activity:setup.activity,
      requestedMode:setup.mode,
      durationChoice:setup.duration,
      durationSeconds,
      startedAt:Date.now(),
      pausedTotalMs:0,
      pauseStartedAt:null,
      status:"countdown",
      seed,
      trialIndex:0,
      currentChallenge:challenge,
      currentMode:mode,
      trialLog:[],
      streak:0,
      bestStreak:0,
      difficulty:state,
      trialStartedPerf:performance.now()
    };
    void saveActiveSession(active);
    set({active,screen:"countdown",resumeAvailable:false});
  },

  finishCountdown: () => {
    const active=get().active;
    if (!active) return;
    const next={...active,status:"running" as const,trialStartedPerf:performance.now()};
    void saveActiveSession(next);
    set({active:next,screen:"session"});
  },

  pauseSession: () => {
    const active=get().active;
    if (!active || active.status !== "running") return;
    const next={...active,status:"paused" as const,pauseStartedAt:Date.now()};
    void saveActiveSession(next);
    set({active:next});
  },

  resumeCountdown: () => {
    const active=get().active;
    if (!active || active.status !== "paused") return;
    const pauseDelta=active.pauseStartedAt ? Date.now()-active.pauseStartedAt : 0;
    const next={...active,status:"countdown" as const,pauseStartedAt:null,pausedTotalMs:active.pausedTotalMs+pauseDelta,trialStartedPerf:performance.now()};
    void saveActiveSession(next);
    set({active:next,screen:"countdown"});
  },

  presentChallenge: () => {
    const active=get().active;
    if (!active || active.status !== "running") return;
    const next={...active,trialStartedPerf:performance.now()};
    set({active:next});
  },

  answer: (answerId) => {
    const state=get();
    const active=state.active;
    if (!active || active.status !== "running") return;
    const challenge=active.currentChallenge;
    const responseMs=Math.max(1,performance.now()-active.trialStartedPerf);
    const correct=answerId===challenge.correctAnswer;
    const nextStreak=correct ? active.streak+1 : 0;
    const score=challengeScore(correct,challenge.level,responseMs,challenge.targetRt,nextStreak,state.prefs.difficultyBias);
    const trial:TrialResult={
      id:`${active.id}-${active.trialIndex}`,
      challengeId:challenge.id,
      mode:active.currentMode,
      activity:active.activity,
      level:challenge.level,
      answerId,
      correctAnswer:challenge.correctAnswer,
      correct,
      responseMs,
      score,
      streak:nextStreak,
      timestamp:Date.now()
    };
    const difficultyState=ensureProgress(active.difficulty);
    const updated=updateDifficulty(difficultyState[active.currentMode]!, {correct,responseMs,targetRt:challenge.targetRt}, active.activity, active.currentMode, state.prefs.difficultyBias);
    const difficulty={...difficultyState,[active.currentMode]:updated};
    saveProgress(difficulty);
    const trialLog=[...active.trialLog,trial];
    const nextIndex=active.trialIndex+1;
    const elapsed=elapsedSeconds(active);
    if (active.durationSeconds !== null && elapsed >= active.durationSeconds) {
      const temp={...active,trialLog,trialIndex:nextIndex,streak:nextStreak,bestStreak:Math.max(active.bestStreak,nextStreak),difficulty,status:"running" as const};
      set({active:temp});
      get().finishSession();
      return;
    }
    const nextMode=modeFor(active.requestedMode,elapsed,nextIndex);
    const nextLevel=ensureProgress(difficulty)[nextMode]?.level ?? 1;
    const nextChallenge=newChallenge(nextMode,nextLevel,active.activity,state.prefs.difficultyBias,active.seed,nextIndex);
    const next={...active,trialIndex:nextIndex,currentChallenge:nextChallenge,currentMode:nextMode,trialLog,streak:nextStreak,bestStreak:Math.max(active.bestStreak,nextStreak),difficulty,trialStartedPerf:performance.now()};
    void saveActiveSession(next);
    set({active:next});
  },

  finishSession: () => {
    const active=get().active;
    if (!active) return;
    const now=Date.now();
    const duration=Math.max(0, (now-active.startedAt-active.pausedTotalMs-(active.status==="paused"&&active.pauseStartedAt?now-active.pauseStartedAt:0))/1000);
    const metrics=sessionMetrics(active.trialLog);
    const result:SessionResult={
      id:active.id,
      activity:active.activity,
      requestedMode:active.requestedMode,
      durationSeconds:duration,
      ...metrics,
      startedAt:active.startedAt,
      finishedAt:now,
      trials:active.trialLog
    };
    const nextHistory=[result,...get().history].slice(0,200);
    void Promise.all([saveHistory(nextHistory),clearActiveSession()]);
    set({history:nextHistory,lastResult:result,active:null,screen:"results",resumeAvailable:false});
  },

  resumeSession: () => {
    const active=get().active;
    if (!active) return;
    const next={...active,status:"countdown" as const,pauseStartedAt:null,trialStartedPerf:performance.now()};
    void saveActiveSession(next);
    set({active:next,screen:"countdown",resumeAvailable:false});
  },

  discardResume: async () => {
    await clearActiveSession();
    set({active:null,resumeAvailable:false});
  },

  resetData: async () => {
    await Promise.all([clearActiveSession(), saveHistory([])]);
    set({history:[],active:null,lastResult:null,resumeAvailable:false,progress:ensureProgress({})});
    saveProgress(ensureProgress({}));
  },

  exportAll: async () => {
    const {history,progress,prefs}=get();
    const {exportData}=await import("../storage");
    await exportData(history,progress,prefs);
  },

  dismissNotice: () => set({notice:null})
}));

export function getDurationLabel(value: DurationChoice): string {
  return value === "open" ? "OPEN" : `${value} MIN`;
}

export function modeLabel(mode: ModeId | "mix"): string {
  return mode === "mix" ? "MIX" : MODE_REGISTRY[mode].shortLabel;
}

export function currentElapsedSeconds(active: ActiveSession | null): number {
  return active ? elapsedSeconds(active) : 0;
}

export function currentTargetMs(mode: ModeId, activity: Activity, bias: DifficultyBias, level:number):number {
  return targetResponseMs(mode,level,activity,bias);
}
