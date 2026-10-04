// Start links: "Start CardioBrain bike" from a home-screen shortcut, a Siri Shortcut
// ("Open URL https://cardiobrain.vercel.app/?start=bike") or the app's own URL scheme
// (cardiobrain://start?activity=bike&mode=numbers).
import type { Activity, ModeChoice } from "../engine/types";
import { useStore } from "../state/store";
import { isNative } from "./native";

const ACTIVITIES: Activity[] = ["walk", "bike", "stairs", "run", "still"];
const MODES: ModeChoice[] = ["mix", "numbers", "switch", "react", "recall", "rhyme", "nback", "estimate", "rotate"];

export interface StartLink {
  activity?: Activity;
  mode?: ModeChoice;
  daily?: boolean;
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
  return out;
}

function apply(link: StartLink | null): void {
  if (!link) return;
  const s = useStore.getState();
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
