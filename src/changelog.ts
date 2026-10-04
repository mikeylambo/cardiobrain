export const APP_VERSION = __APP_VERSION__;

/** Newest first. Plain sentences, the way Settings shows them. */
export const CHANGELOG: Array<{ version: string; items: string[] }> = [
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
