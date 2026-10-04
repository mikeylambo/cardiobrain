# CardioBrain

**Quick brain challenges you play while you move.**

A mobile-first PWA, and a native iOS and Android app from the same code, for walking, biking, stairs and running. Each challenge takes a glance and a tap. During a session the whole screen is one bold activity color, the stimulus is huge, and the answer tiles are big enough to hit mid-stride.

**Live:** https://cardiobrain.vercel.app (installable, works offline after one load)

## What's in it

- **Eight modes:**
  - **Numbers:** quick sums with near-miss answers.
  - **Switch:** the rule changes unpredictably; switch cost is measured.
  - **React:** go/no-go with decoys.
  - **Recall:** sequence memory, always solvable.
  - **Rhyme:** built on the CMU Pronouncing Dictionary through Barsmith's rhyme engine.
  - **N-back:** working memory.
  - **Estimate:** the approximate number sense.
  - **Rotate:** mental rotation.
- **Mix:** the modes you choose, in 75-second blocks.
- **Daily challenge:** the same seeded 3 minutes for everyone, each day.
- **Play while moving:** challenges read aloud, eyes-free play with answers read by position, voice answers, a landscape treadmill layout, arm's-length scaling, dark sessions, and interval sessions (play during work or during recovery).
- **Measurement:**
  - **Motion cost:** play a mode seated once, and moving sessions show what moving costs you.
  - **Check-ins:** rate effort (1–10) after each workout, plus optional mood before and after.
  - **Insights:** plain-language patterns in your sessions, plus science notes per mode.
- **Adaptive difficulty:** 20 levels per mode. Longer answer windows for Stairs and Run, and for harder heart-rate zones when a Bluetooth strap is connected.
- **Results and progress:** count-up, honest headlines, personal bests, motion cost, poster and story share cards, a weekly goal ring, per-mode levels and trends.
- **Sessions survive interruptions:** auto-pause, reload-and-resume.
- **Shortcuts and data:** start links and app shortcuts (`/?start=bike`, `cardiobrain://start?activity=bike`), backup and restore.
- **Private:** everything stays on the device. No account, no tracking.

## Playtest while moving

1. Open the live URL on your phone and add it to your Home Screen.
2. Pick your activity and play the 30-second first round.
3. Set the phone on the treadmill console or bike mount, at eye level.
4. Start a 10-minute Mix session and play by glance. Sound and haptics confirm each answer.
5. Afterwards, check Results and History, and note anything that was hard to read or hit.

## Run it

```bash
npm install
npm run dev            # http://localhost:5173
```

## Test it

```bash
npm run build          # typecheck, lint (hooks rules as errors), unit and property tests, contrast check, vite build
npm run e2e            # Playwright on iPhone 14 and Pixel 7: flows, offline, share cards, v2.1 features, layout floor, axe audit
npm run e2e:long       # 3-minute sessions in every mode with pause, background and reload cycles (~15 min)
npm run screens        # every screen and mode state at 360×800 and 390×844, written to docs/screens/
npm run store:screens  # App Store and Play screenshots, written to store/screenshots/
npm run store:preview  # the 29.5-second App Store preview video, written to store/preview/
```

Short local sessions for testing: `sessionStorage.setItem("cb-test-duration-seconds", "20")` (localhost only).

## Build the native apps

```bash
npm run build && npx cap sync
npx cap open ios       # Xcode: set your team, then Product, Archive
npx cap open android   # Android Studio: Generate Signed App Bundle
```

Full signing and submission steps are in [STORE_RELEASE.md](STORE_RELEASE.md). The listing copy and privacy answers are in [store/listing.md](store/listing.md).

## Where things are

- `src/engine/`: seeded RNG, difficulty, scoring, Mix schedule, session constants (pure and unit-tested)
- `src/modes/generate/`: one generator per mode (pure, property-tested)
- `src/modes/*.tsx`: one view per mode
- `src/modes/rhyme-engine.ts`: phonetic comparison, ported from Barsmith
- `src/state/store.ts`: the session state machine (Zustand)
- `src/ui/`: screens, the share card, copy
- `src/platform/`: the Capacitor bridge, heart-rate straps, Health logging, start links (all lazy-loaded)
- `src/audio/`: synthesized sound, spoken prompts, voice answers and the spoken-answer matcher
- `src/engine/insights.ts`, `daily.ts`, `intervals.ts`: motion cost, findings, daily challenge, interval timing (pure and tested)
- `.github/workflows/ci.yml`: build and e2e on Chromium, plus real WebKit (Safari engine) on macOS
- `docs/native/`: specs for the Apple Watch companion and the Home Screen widget
- `scripts/`: rhyme data build, icons and splash screens, contrast check
- [DESIGN.md](DESIGN.md), [FLOWS.md](FLOWS.md), [REVIEW.md](REVIEW.md), [DECISIONS.md](DECISIONS.md)

Pronunciation data: CMU Pronouncing Dictionary, BSD-2-clause (see `src/data/PRONUNCIATION-LICENSE`).
