export const APP_VERSION = __APP_VERSION__;

/** Newest first. Plain sentences, the way Settings shows them. */
export const CHANGELOG: Array<{ version: string; items: string[] }> = [
  {
    version: "2.6",
    items: [
      "A new welcome: pick your activity, say where your phone is and whether you'll listen, then a 30-second round.",
      "After the first round, a short guide to Start, the Daily and the seated baseline.",
      "Look around first: skip the intro and explore.",
      "Replay the intro any time from Settings.",
    ],
  },
  {
    version: "2.5",
    items: [
      "Challenge a friend: a Daily result shares a link that opens the same challenge with your score to beat.",
      "Insights charts seated vs. moving accuracy for every mode with a baseline.",
      "Deleting a session can be undone for a few seconds.",
      "Reset a mode's level from History if it feels far off.",
      "A short note on Home after each update, linking to what's new.",
      "The crash screen can copy a problem report.",
      'A "Warm-up done" cue when a session reaches full pace.',
    ],
  },
  {
    version: "2.4",
    items: [
      "A 5-minute session length.",
      "Sessions ease in for the first 45 seconds and ease off for the last 45.",
      "Speed now counts correct answers only, shown to the hundredth under a second.",
      "The weekly ring fills in once you meet your goal.",
      "Bigger, side-by-side sessions on tablets and treadmill screens.",
      "Report a problem, in Settings, with an on-device error log.",
      "Optional anonymous usage stats on the web, off unless you turn them on.",
    ],
  },
  {
    version: "2.3",
    items: [
      "The full splash only on a cold start; tap to skip it.",
      "Tap feedback: Off, Standard or Strong.",
      "Halfway and one-minute-left cues, and a pulse in the last 10 seconds.",
      "Results break Mix and Daily down by mode.",
      "Delete a single session from History.",
      "Day streak on Home.",
      "Keyboard controls: 1–9 or arrows to answer, Space to pause, Enter to start.",
      "Tap to skip the countdown after a pause.",
      "Try any mode for one minute from Insights.",
    ],
  },
  {
    version: "2.2",
    items: ["A splash screen, firmer taps and screen transitions.", "Clearer, more honest copy throughout.", "Centered countdown."],
  },
];

/** "2.5" from "2.5.0": notes are per minor release. */
export const releaseOf = (v: string) => v.split(".").slice(0, 2).join(".");

/** The release whose notes were last acknowledged; set silently on a first install. */
export function lastSeenRelease(): string | null {
  try {
    return localStorage.getItem("cb-seen-release");
  } catch {
    return null;
  }
}
export function markReleaseSeen(): void {
  try {
    localStorage.setItem("cb-seen-release", releaseOf(APP_VERSION));
  } catch {
    // Shown again next time; harmless.
  }
}
