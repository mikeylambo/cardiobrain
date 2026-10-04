# CardioBrain: Decisions

Calls made during the builds, newest first. Each one can be revisited; the reason is here so it does not have to be rediscovered.

## v2.2 (October 2026): feel and flow

- **Copy:** a plain-language pass removed filler ("That's the whole game.", "It happens.", "Can you beat it?"). Lines now say what happened or what to do.
- **Splash:** the web splash starts from the same mark as the native and iOS launch images, so the handoff looks seamless. The ring sweeps in, the dot pops, the wordmark rises, and it all fades after at least 1.15s. Its styles and @font-face are inlined in `index.html` so it paints before the CSS bundle arrives. The wordmark animates by transform only: text that starts invisible doesn't count as Largest Contentful Paint, and Lighthouse had reported none.
- **Press feedback:** every control scales on press and springs back, with a light haptic and a quiet tick. Correct tiles pop with a ring burst, wrong ones nudge and dim, and the streak counter bumps. Answer tiles keep their own feedback, so there's no double tick.
- **Screen transitions:** the View Transitions API runs only between Home, History, Insights and Settings. Deeper screens slide in from the right, and going back slides from the left. Sessions keep their countdown and wipe, and Results rises in by itself. In testing, a transition into a live session sometimes never finished and stalled the countdown, so sessions are excluded, and every transition is cut short after 700ms.
- **Countdown:** centered.
- **Placement** replaces the slow 20-trial calibration. A mode you've never played moves up a level for each quick correct answer, holds on a slow correct one, and drops on a wrong one, for 12 challenges (capped at level 12). The guided round stays at level 4 or below.
- **iPhone speech:** iOS only speaks after speech starts inside a tap, so the Start tap speaks a silent utterance.
- **Voice commands:** "pause" or "stop" pauses, and while paused, "resume", "continue" or "go" resumes. Results read themselves aloud when spoken prompts are on.
- **Fewer reminders:** the "play seated" reminder shows once per mode. The Read aloud and Eyes-free tip shows once, after the third real session.
- **Layout:** Daily is a single line under Start. The setup sheet shows only the selected mode, with a Change mode link. N-back is now "Look back", with N-back mentioned in its description.

## v2.1 (October 2026)

### Scope

- Built everything in the refinement list except items 11 and 12 (Bar mode, syllable count), which were declined.
- **Device-dependent features:** the owner has no test devices or developer accounts yet.
  - **Built and tested in the browser with fakes:** spoken prompts, voice answers and Bluetooth heart rate. Each e2e test installs a stand-in for the browser API.
  - **Built, untested (marked so in the code):** the native paths for text-to-speech, speech recognition, Bluetooth and Health logging.
  - **Spec only:** the Apple Watch companion and the Home Screen widget, in `docs/native/`. Building them blind would ship Swift and Kotlin that has never run.

### Play while moving

- **Spoken prompts:** generators now produce `speech` text, so what is read aloud is tested alongside the challenge. Eyes-free adds the answers with their places ("Left, odd. Right, even.").
- **Voice answers:** a pure matcher (`src/audio/voiceMatch.ts`, unit-tested) normalises spoken numbers ("a hundred and four", "minus five") and option aliases ("higher", "over"). The last thing said wins, because people correct themselves. React and Recall stay tap-only: reflex timing and sequences don't suit speech. Transcripts arriving while the app itself is speaking are ignored, so the prompt can't answer itself.
- **Native speech:** Capacitor Text-to-Speech, because Android's WebView has no speechSynthesis. Voice input uses @capgo/capacitor-speech-recognition, chosen over the community plugin because that one has no Swift Package Manager support and would be silently dropped from the iOS build.
- **Landscape:** allowed on phones, with stimulus on the left and tiles on the right. The desktop centering rule no longer applies to short landscape screens, which had clamped the treadmill layout to 480px.
- **Intervals:** 30/30, 1/1 and 4/1 minutes. Challenges play during work bouts or during recovery, and the other bout shows a quiet card with a countdown. Interval timing is a pure function of elapsed running time, so pause and reload can't desync it.

### New modes

- **N-back:** 1-back to 3-back by level. The stream is the session's real memory of shown letters (`memory` in the snapshot), so N can change mid-block without corrupting matches. Memory resets at each Mix block.
- **Estimate:** options sit on a geometric ladder (Weber ratio 1.75 down to 1.18), and the right answer is always the exact count. Dots are scattered without overlap, hidden after 1.6 to 0.65 seconds, and shown again after answering so you can check.
- **Rotate:** ten polyominoes, each tested to be chiral, so "same or mirror" always has exactly one answer. Angles grow from quarter turns to 30-degree steps.

### Measurement

- **Seated baseline:** a fifth activity, "still", on a chalk field. Motion cost compares the last moving session with the mean of the last three seated sessions of the same mode.
- **Effort:** a 1–10 rating with Borg CR10 anchors. **Mood** check-ins are optional and off by default, because they add a tap before starting.
- **Insights:** every finding needs a minimum sample (usually 3 per group) and a difference worth mentioning (3+ accuracy points). The copy describes patterns, never causes.
- **Science notes:** each cites the classic paradigm the task is modelled on, and says plainly that transfer to everyday thinking is debated. **These are worth a review by you as a psychologist.**

### Progress

- **Daily challenge:** the seed comes from the local date. It runs six 30-second blocks at fixed levels 3, 5, 7 and up, using walking timing and standard bias for everyone. It never touches personal levels.
- **Personal bests:** accuracy needs 20 or more challenges, and a speed best needs 80% or better accuracy, so mashing fast never wins it.
- **Headlines:** under 3 points and under 0.1s count as "the same". Trade-offs name both sides ("Faster, but less accurate than last time.").

### Platform

- **Heart rate:** the standard GATT Heart Rate service. Zones are shares of max heart rate (set in Settings). Zones 3, 4 and 5 widen answer windows by 1.1×, 1.25× and 1.4×. The daily challenge ignores heart rate.
- **Health:** the plugin can't write workouts, so sessions are written as Mindful Minutes. Off by default.
- **Code splitting:** History, Insights, Settings and the share card are separate chunks. The main bundle is about 106 KB gzipped. An idle preload of the rhyme words was tried and removed: building the index is a half-second main-thread task, it cost Lighthouse about 8 performance points, and the service worker already precaches the file. The index builds during the 3-second countdown instead.
- **CI:** GitHub Actions runs the full gated build and e2e suite on Chromium, plus a real WebKit (Safari engine) job on macOS. That job is the first true Safari coverage; until now iPhone was emulated in Chromium.

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
- **Correct-answer test hook:** on localhost only, the store is exposed as `globalThis.__cbStore`, so the store-screenshot script can answer correctly. Production builds served from any other host never expose it.
- **Results at release:** 28 unit and property tests; 22 e2e flow and floor tests on iPhone 14 and Pixel 7; 12 of 12 three-minute sessions (6 modes × 2 devices); Lighthouse mobile 99 / 100 / 100 / 100; main JS 97 KB gzipped (budget 200 KB), with the lazy rhyme list at 70 KB gzipped on top.
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

## v2.3

- **Splash only on a cold start.** The full beat plays when the app hasn't opened in 12 hours; otherwise it's a 250ms blink, and a tap skips it either way. Seeing the same animation five times a day stops being a welcome.
- **Tap feedback setting (Off / Standard / Strong).** Feel is personal and context-dependent (a gym vs. a quiet room), so it's a choice, not a constant. Answer tiles keep their own feedback.
- **Progress cues.** "Halfway" with accuracy so far (sessions of 2 minutes or more), "One minute left" (3 minutes or more), and a rail pulse in the last 10 seconds. These are spoken when Read aloud is on, so you get them without looking.
- **By mode on Results.** For Mix and Daily, accuracy and speed per mode (3 or more trials), weakest last, so the summary says where to look.
- **Delete one session** from its detail sheet, with an inline confirm. Mistaken sessions shouldn't need a full data wipe.
- **Day streak on Home**, shown from 2 days. It's quiet text, not a badge: a nudge, not a guilt machine.
- **Keyboard.** Keys 1–9 or the arrow keys answer; Space, P or Esc pause; Enter starts; Backspace undoes in Recall. This is for tablets on a treadmill with a keyboard, and it helps accessibility.
- **The resume countdown is skippable.** You already know the game after a pause; the first countdown stays.
- **"Try it" on Insights.** A one-minute practice per mode, kept in History but left out of stats, streak, weekly goal and comparisons.

## v2.4

- **Version and What's new in Settings → About.** This confirms an update actually applied, which matters most while testing.
- **Report a problem.** It builds a plain-text report (version, platform, device, screen, settings, last session, and the on-device error log) that you read before sharing or copying it. There's no server, so nothing is sent automatically.
- **Error log.** It records uncaught errors, rejected promises and render crashes caught by the ErrorBoundary, keeping the last 20 with trimmed stacks. Browser noise (ResizeObserver loops, cross-origin "Script error.") is filtered out. Delete data clears it.
- **5-minute sessions.**
- **Warm-up and cool-down.** Timed sessions of 5 minutes or more play 2 levels below yours for the first 20 seconds, 1 below until 45 seconds, and 1 below for the last 45 seconds. Open sessions only warm up. Eased trials don't move your level: they're below it, so they say nothing about it. Daily, guided and Try it sessions are exempt. A small "Warm-up" or "Cool-down" tag shows next to the clock.
- **Response time counts correct answers only.** A fast wrong guess used to lower your average, which rewarded guessing. Older sessions are recomputed from their stored trials on load (`rtBasis`), so comparisons stay fair. Times under one second show hundredths.
- **The weekly goal ring.** Once you meet the goal, it becomes a solid disc with a check, labeled "4 this week". "4 of 3" read like an error.
- **Tablets and treadmill consoles.** From 768px wide (and 561px tall), the session leaves the phone column, scales targets by 1.4× (1.7× at arm's length) and grows the stimulus with the stage, up to 1.8×. Wide landscape screens put the challenge on the left and the answers on the right, centered as a group. Calm screens keep the phone column, where reading is easier.
- **Opt-in usage stats (web only).** Vercel Web Analytics, which uses no cookies. It's off by default. When on, screens are counted as virtual pages (`/home`, `/session`…), sessions send "Session started" and "Session finished" with mode, activity, length and kind, and query strings are stripped. Turning it off drops events in `beforeSend` at once. Native apps never load it. Web Analytics must be enabled once in the Vercel project. Custom events need a paid Vercel plan; page counts work on Hobby.

## v2.5

- **Challenge a friend.** A daily result shares `cardiobrain.vercel.app/?daily=YYYY-MM-DD&beat=NN`, which opens that exact daily: past days are playable because the daily is seeded by date. The share sheet also has "Send a challenge link" (share sheet, or copy where there isn't one), because some apps drop the text when an image is attached. Links to future days, pre-launch days, malformed dates and scores outside 0–100 are ignored. The friend's score is kept (`cb-challenge`) until it's played or skipped, so it survives onboarding or a session already in progress. Home offers it in place of the daily line. Results says "You beat your friend's 64% by 4 points" and stores `rival` with the session. There's still no server: the score travels in the link.
- **Moving vs. seated chart.** On Insights, a dumbbell per mode: seated (your three latest) vs. all moving sessions. Shape encodes identity (hollow vs. solid), so it needs no color and survives CVD and print. The scale is accuracy from a rounded floor to 100%, sorted by biggest cost, with the point change on the right. Tapping or focusing a row shows response times and session counts, and there's a screen-reader table.
- **Undo instead of confirm** for deleting a session: the delete is immediate, with an 8-second Undo toast. It's faster, and just as safe.
- **Reset a level** (History → Levels). It sends one mode back to placement, so its next session finds your level again over the first 12 answers. History is untouched.
- **"Updated to 2.5" note** on Home, once per minor release. A fresh install starts caught up, and existing users with real sessions see it.
- **Copy a problem report from the crash screen.** The moment something breaks is when the report matters most.
- **"Warm-up done"** is shown (and spoken with Read aloud) at 45 seconds, but only when the session actually eased in.
