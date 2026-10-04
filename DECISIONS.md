# CardioBrain: Decisions

Calls made during the builds, newest first. Each one can be revisited; the reason is here so it does not have to be rediscovered.

## v2 (October 2026)

### Scope and process

- **Kept from v1:** seeded RNG, difficulty controller, scoring, IndexedDB storage. **Rebuilt:** the store, every mode (generator and view) and every screen. The v1 UI was replaced outright, because the v2 design changes every component.
- **Branch.** v2 was built on `claude/vigilant-pascal-gq5ryl`, the branch this session was assigned, instead of a new `v2` branch. Merging to `main` waits for the owner's go-ahead.
- **v1 files** were overwritten in place rather than deleted, so each has a v2 counterpart with the same name (`OnboardingScreen.tsx` is the Welcome screen, `SetupScreen.tsx` is the setup sheet, `CountdownScreen.tsx` is the countdown overlay).

### Bugs fixed (from the v2 brief, section 1)

1. **Pause crash:** every hook in `SessionScreen` sits above the first return. `eslint-plugin-react-hooks` runs `rules-of-hooks` and `exhaustive-deps` as errors, and `npm run build` runs lint. Covered by the e2e test that pauses and resumes 10 times.
2. **Unwinnable Recall:** pads are built from the sequence (every distinct symbol plus fillers up to four), never drawn independently. Covered by a property test over 2,000 seeds × levels 1–20.
3. **Rhyme data:** CMU Pronouncing Dictionary via Barsmith (see Rhyme Rush below). Every challenge passes a validator before it is shown.
4. **Switch** rule runs last 2–4 trials (the rule repeats 1–3 times, then switches), derived from the session seed so a resumed session keeps its schedule. A switch plays its own tone and haptic, and the rule banner wipes in with a ring. Each trial records `switchTrial`, and Results and History report switch cost (mean correct RT on switch trials minus repeat trials, needing at least 3 of each).
5. **Mix:** 75-second blocks, shuffled so no mode runs twice in a row (including across the seam between cycles), with a 1.2s transition card.
6. **Results** shows both the accuracy and the response deltas, plus a count-up.
7. **History** trends are per mode, chosen with a mode picker.
8. `user-scalable=no` removed; `touch-action: manipulation` prevents double-tap zoom.
9. The `View.toString()` hack and the dead code are gone; Prettier runs across the repo.

### Rhyme Rush

- **Barsmith reuse.** `src/modes/rhyme-engine.ts` ports Barsmith's rime-by-rime comparison, phonetic similarity groups and compact CMU encoding. To it, CardioBrain adds a symmetric `rhymes()` relation and a final-syllable slant score, so a four-option question can hold a clear gap between the one right answer and the near misses.
- **Word list.** `scripts/build-rhyme-data.py` filters Barsmith's 41k-word payload down to about 9,900 words. It keeps frequency bucket 4 and up (Zipf at least 3.4) and words Webster's Second lists in lowercase. Words Webster's also capitalises (`ross`, `toby`, `bill`) are dropped unless they are on a hand-checked list, and a blocklist removes words that don't belong in a workout game. The result is 68 KB gzipped, lazy-loaded the first time Rhyme or Mix starts, and precached by the service worker so it works offline.
- **Precache, not idle prefetch.** The brief asked for precaching on idle. Workbox's install step already runs in the background after first load, so the word list goes in the regular precache, not a separate idle fetch.
- **One defensible answer.** Prompts and correct answers come from Zipf 4+ words of 10 letters or fewer. Distractors are near misses: same vowel with a different coda, or the same spelled ending with a different sound (`word` / `lord`). A distractor must differ on the final rime and score at most 0.7 on slant against the prompt (0.5 for Slant questions, where the correct answer scores at least 0.8). Homophones never share a question.
- **Types by level:** Perfect only at levels 1–3; Odd one out from 4; Slant from 8; Chain from 13. Chain prompts come from the data (any rhyme family with three or more common members), not from a fixed list.

### Design system

- **One family:** Archivo variable, latin subset, width axis 62–125%, self-hosted at `/fonts`, preloaded with `font-display: swap`. Display and stimulus text use 62% width at weight 800; body text uses 100% width at 500–650.
- **Contrast is a build gate.** `scripts/check-contrast.mjs` reads the tokens from `styles.css` and fails the build if any pair misses AA. Two fixes came out of it: chalk tiles get a 2px Asphalt edge on Signal (chalk on yellow is 1.45:1, which fails the 3:1 non-text floor), and the primary button is Chalk on Lagoon and Ultraviolet but Asphalt on Signal and Vermilion.
- **Surfaces.** Activity fields carry the whole app: Home, the session, the countdown, the Mix card and Results. The Welcome and Paused screens are Asphalt. History and Settings are Chalk, so the quiet screens stay quiet.
- **No framer-motion.** Motion is CSS: a 120ms feedback step, a 280ms screen change, and a 360ms wipe at session start. Dropping it saved about 40 KB gzipped.
- **The orchestrated start.** After the 3-2-1 on the activity field, the session layer wipes up from the bottom (360ms) and the first stimulus resolves from condensed width to resting width. With reduced motion on (system setting or in-app), every animation becomes a fade under 100ms.
- **Wrong answers:** the tile nudges 4px twice, a low note plays, and the correct tile gets a thick Asphalt ring for 700ms. No red anywhere.
- **React mode:** the target appears in one of four positions on the field, mirroring the 2×2 tiles below it, and you tap the matching tile. A no-go is a solid square with the cue "Hold. Don't tap.", and from level 8 a hollow ring appears as a decoy.
- **Results headline** for a first session is "Baseline set." (one line), with the activity and mode in a small kicker above it. The guided round's headline is "That's the whole game."
- **Countdown** sits in the lower half, near where the stimulus will appear, with the mode name at 40px and the number at 160px.

### Flow

- **Guided first round:** 30 seconds of Mix at calibration level, using Numbers, React and Switch in 10-second blocks so a first-timer sees three modes. The first challenge appears about 4 seconds after tapping an activity: the 3-second countdown plus the wipe.
- **Auto-pause:** when the app is hidden, the clock stops at once. Back within 3 seconds, play continues and the time away is not charged to the response. Away longer, the session is paused. A countdown that gets backgrounded pauses too.
- **Timing** is accumulated running time from `performance.now()`, never wall-clock time, so pauses, background time and reloads cannot leak into elapsed time. The snapshot saves every 5 seconds and on every pause.
- **Add to Home Screen** is offered once, on iOS Safari only, on Home after the first round, never on first load.

### Platform

- **Capacitor 8.** The app id is a single constant in `capacitor.config.ts`: `com.mikeylambo.cardiobrain`. **Confirm it before the first store submission.** It cannot change after publishing.
- The web build is bundled into the native apps (`webDir: dist`, no `server.url`), so they run fully offline.
- **Native plugins:** Haptics, with a distinct impact style per event; Keep Awake, which replaces the Wake Lock API; Status Bar, which follows the surface on screen; Splash Screen, hidden once boot finishes; App, whose lifecycle events feed the auto-pause; and Share plus Filesystem, which write the result card to cache and open the native share sheet. All are imported lazily, so the web bundle doesn't pay for them.
- Portrait is locked in `Info.plist` and `AndroidManifest.xml`. iPad requires full screen.

### Testing

- **Playwright:** the iPhone 14 profile is emulated in Chromium (viewport, pixel ratio, touch and user agent), because WebKit is not installed on the build machine. Pixel 7 runs as itself. The suites use the machine's preinstalled Chromium when present.
- **Short test sessions:** `sessionStorage['cb-test-duration-seconds']` sets the session length, honoured on localhost only.
- **"Under 15 seconds"** is measured from page load to the first answerable challenge (about 4–5 seconds). The guided round itself lasts 30 seconds, so reaching Results takes longer by design.

## v1

### Product

- CardioBrain is a glance-first cognitive training companion for cardio, not a generic brain-training dashboard.
- The v1 loop is one-screen stimulus + one-tap response. No typing during sessions.
- The four initial modes are Numbers, Switch, React, and Recall. Mix is a composition layer.
- Results prioritize actionable session metrics over gamification overload.
- No account, backend, analytics SDK, or network dependency is required for core play.

### Engineering

- Vite + React + TypeScript strict mode.
- Zustand owns UI/session state; engine modules stay pure where possible.
- IndexedDB stores history and resumable session data; localStorage only stores tiny preferences.
- WebAudio synthesizes all feedback sounds, avoiding audio asset downloads.
- Wake Lock, haptics, and offline updates fail gracefully.
- Trial reaction timing uses performance.now(). Session wall-clock duration also keeps an epoch timestamp so an interrupted session can be resumed after a reload.
- A self-hosted font is intentionally deferred until a binary asset pipeline is established; the visual system uses a premium system-font stack so offline behavior remains complete.

- Barsmith's existing rhyme service was inspected. Its production engine uses stressed-tail comparison and coda/vowel similarity. CardioBrain reuses that scoring approach in a deliberately compact, curated v1 word corpus rather than importing Barsmith's ~804 KB pronunciation payload.
- The four JSX-bearing mode files were corrected to .tsx after the first Vercel build exposed TypeScript parser errors. This is now part of the release gate.

### UX

- Active activity controls the accent family through CSS variables.
- Running mode deliberately removes navigation chrome and keeps the interaction zone large.
- Wrong answers never punish with full-screen red; feedback is tactile, tonal, and brief.
- Reduced-motion users receive the same hierarchy without animation dependencies.
- The app is portrait-first but does not claim device-level screen locking where browsers do not expose that permission.

### Release

- Vercel serves the app as a static build.
- Service worker updates only surface on Home.
- Testability is a first-class feature: every challenge is generated from a seeded RNG and the engine has pure unit-test seams.

### Build-process hardening

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
