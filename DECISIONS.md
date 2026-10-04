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

- Barsmith's existing rhyme service was inspected. Its production engine uses stressed-tail comparison and coda/vowel similarity. CardioBrain reuses that scoring approach in a deliberately compact, curated v1 word corpus rather than importing Barsmith's ~804 KB pronunciation payload.
- The four JSX-bearing mode files were corrected to .tsx after the first Vercel build exposed TypeScript parser errors. This is now part of the release gate.

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

## Build-process hardening
- Design is now an executable artifact in DESIGN.md, including palette, type scale, spacing, motion durations/easings, screen anatomy, and sample copy.
- Critical interaction paths are enumerated in FLOWS.md with exact tap sequences.
- REVIEW.md and e2e/review.spec.ts define the repeatable mobile review loop: 390×844 screenshots plus real short sessions across all five modes.
- Local acceptance sessions can use sessionStorage key cb-test-duration-seconds on localhost only; production ignores the override.
- A Recall generation bug was found where low-level rounds could contain sequence symbols missing from the answer bank. The generator now guarantees every sequence symbol is tappable, and a 20-level × 80-seed solvability test guards it.
- A recovered paused session bug was found: resuming from a persisted paused state did not add the outstanding pause interval to pausedTotalMs. That is now fixed and covered by the mobile reload/resume acceptance flow.
- Home Start session now enters Setup instead of silently starting with defaults.

- Recall now uses six stable shape IDs rendered by shared CSS geometry in both the memorize phase and answer pads, eliminating Unicode glyph mismatch. Its presentation timers are fully cancellable on challenge changes/unmount.
- React challenge presentation is owned by the session shell rather than firing twice from the mode view.
- Settings now exposes a true Reset app action that clears history, active-session state, learned levels, preferences, onboarding, and setup defaults before returning to first launch.
- Review coverage now explicitly asserts each displayed Recall shape exists as a selectable answer and that Reset app returns the product to onboarding. A malformed multi-statement Playwright review test was also corrected.
