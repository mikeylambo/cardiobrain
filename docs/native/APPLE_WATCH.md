# Apple Watch companion: spec

Status: **specified, not built.** It needs Xcode on a Mac, an Apple Developer account, and a watch to test on. Building it blind would ship code that has never been run.

## What it does

- **Start from the wrist:** the last preset, or pick an activity. The phone starts the session over WatchConnectivity.
- **Glance:** a live ring for session progress, accuracy so far, streak, and the elapsed clock.
- **Control:** a Pause/Resume button, and press and hold to end (the same as on the phone).
- **Heart rate:** while a session runs, the watch streams heart rate to the phone, which uses the same zone logic as a strap (`src/platform/heartRate.ts`, `ZONE_TIME_FACTOR`).
- **Haptics:** a tap for correct, a double tap for wrong, a long tap for a mode change. The phone can stay in the pocket in eyes-free mode while the wrist confirms.

## Architecture

- A SwiftUI watchOS app target inside `ios/App`, and a `WCSession` on both sides.
- **Phone side:** a small Capacitor plugin (`WatchBridge`) that sends `{phase, elapsedMs, accuracy, streak, mode}` once a second while a session runs, and receives `start`, `pause`, `resume`, `end` and `heartRate`.
- **Web side:** the store already exposes every action needed: `startSession`, `pause`, `resume`, `endSession` and `setHeart`. The bridge calls them. No game logic moves to the watch.
- **Heart rate on the watch:** an `HKWorkoutSession` of type "other", or the matching activity (walking, cycling, stair climbing, running). The workout is saved to Health, which also covers Health logging properly.

## Acceptance

- Start, pause, resume and end from the watch, with the phone screen off and eyes-free on.
- Heart-rate zones change answer windows within 5 seconds of a zone change.
- Battery: under 10% per 30-minute session on Apple Watch Series 9.
