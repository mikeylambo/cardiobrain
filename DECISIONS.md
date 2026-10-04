# CardioBrain — Decisions

This file records deliberate product and implementation choices made during the continuous build.

## Product
- CardioBrain is a glance-first cognitive training companion for cardio, not a generic brain-training dashboard.
- The v1 loop is one-screen stimulus + one-tap response. No typing during sessions.
- The four initial modes are Numbers, Switch, React, and Recall. Mix is a composition layer.
- Results prioritize actionable session metrics over gamification overload.
- No account, backend, analytics SDK, or network dependency is required for core play.

## Engineering
- Vite + React + TypeScript strict mode.
- Zustand owns UI/session state; engine modules stay pure where possible.
- IndexedDB stores history and resumable session data; localStorage only stores tiny preferences.
- WebAudio synthesizes all feedback sounds, avoiding audio asset downloads.
- Wake Lock, haptics, and offline updates fail gracefully.
- Trial reaction timing uses performance.now(). Session wall-clock duration also keeps an epoch timestamp so an interrupted session can be resumed after a reload.
- A self-hosted font is intentionally deferred until a binary asset pipeline is established; the visual system uses a premium system-font stack so offline behavior remains complete.

## UX
- Active activity controls the accent family through CSS variables.
- Running mode deliberately removes navigation chrome and keeps the interaction zone large.
- Wrong answers never punish with full-screen red; feedback is tactile, tonal, and brief.
- Reduced-motion users receive the same hierarchy without animation dependencies.
- The app is portrait-first but does not claim device-level screen locking where browsers do not expose that permission.

## Release
- Vercel serves the app as a static build.
- Service worker updates only surface on Home.
- Testability is a first-class feature: every challenge is generated from a seeded RNG and the engine has pure unit-test seams.
