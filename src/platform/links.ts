// Start links: "Start CardioBrain bike" from a home-screen shortcut, a Siri Shortcut
// ("Open URL https://cardiobrain.vercel.app/?start=bike") or the app's own URL scheme
// (cardiobrain://start?activity=bike&mode=numbers).
import type { Activity, ModeChoice } from "../engine/types";
import { useStore } from "../state/store";
import { isNative } from "./native";
import { dailyKey, dailyNumber } from "../engine/daily";

/** Where shared links point, from the web and from the native apps alike. */
export const PUBLIC_URL = "https://cardiobrain.vercel.app";

const ACTIVITIES: Activity[] = ["walk", "bike", "stairs", "run", "still"];
const MODES: ModeChoice[] = ["mix", "numbers", "switch", "react", "recall", "rhyme", "nback", "estimate", "rotate"];

export interface StartLink {
  activity?: Activity;
  mode?: ModeChoice;
  /** True for today's daily, or a past day's date key from a challenge link. */
  daily?: boolean | string;
  /** A friend's accuracy to beat, 0–100. */
  beat?: number;
}

/** "Can you beat it?" link for a daily result. */
export function challengeLink(daily: string, accuracy: number): string {
  return `${PUBLIC_URL}/?daily=${daily}&beat=${Math.round(accuracy * 100)}`;
}

/** Read a start request from a URL. Unknown values are ignored rather than guessed. */
export function parseStartLink(href: string): StartLink | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const q = url.searchParams;
  const start = q.get("start") ?? (url.host === "start" || url.pathname.replace(/\//g, "") === "start" ? (q.get("activity") ?? "") : null);
  if (start === null && !q.has("daily")) return null;
  const out: StartLink = {};
  if (start && ACTIVITIES.includes(start as Activity)) out.activity = start as Activity;
  const mode = q.get("mode");
  if (mode && MODES.includes(mode as ModeChoice)) out.mode = mode as ModeChoice;
  if (q.has("daily") || start === "daily") out.daily = true;
  // A dated daily (a challenge link): only real days, never the future.
  const day = q.get("daily");
  if (day && /^\d{4}-\d{2}-\d{2}$/.test(day) && day <= dailyKey() && dailyNumber(day) >= 1) out.daily = day;
  const beat = Number(q.get("beat"));
  if (typeof out.daily === "string" && q.has("beat") && Number.isInteger(beat) && beat >= 0 && beat <= 100) out.beat = beat;
  return out;
}

function apply(link: StartLink | null): void {
  if (!link) return;
  const s = useStore.getState();
  // A challenge is remembered even when it can't start yet (first run, mid-session): Home offers it.
  if (typeof link.daily === "string" && link.beat !== undefined) s.setRival({ daily: link.daily, score: link.beat });
  if (!s.flags.onboarded || s.active) return;
  if (link.activity) s.chooseActivity(link.activity);
  if (link.mode) s.updateSetup({ mode: link.mode });
  s.requestStart({ daily: link.daily });
}

/** Called once after boot: handle the launch URL, then clean it so a reload doesn't restart. */
export function startFromLink(): void {
  const link = parseStartLink(location.href);
  if (link) {
    history.replaceState(null, "", location.pathname);
    apply(link);
  }
  if (isNative) {
    void import("@capacitor/app").then(({ App }) => {
      void App.addListener("appUrlOpen", ({ url }) => apply(parseStartLink(url)));
    });
  }
}
