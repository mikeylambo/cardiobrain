# CardioBrain

**Quick brain challenges you play while you move.**

A mobile-first PWA, and a native iOS and Android app from the same code, for walking, biking, stairs and running. Each challenge takes a glance and a tap. During a session the whole screen is one bold activity color, the stimulus is huge, and the answer tiles are big enough to hit mid-stride.

**Live:** https://cardiobrain.vercel.app (installable, works offline after one load)

## What's in it

- **Five modes:**
  - **Numbers:** quick sums with near-miss answers.
  - **Switch:** the rule changes on an unpredictable 2–4 trial schedule; switch cost is measured.
  - **React:** go/no-go with decoys.
  - **Recall:** sequence memory, always solvable.
  - **Rhyme:** perfect, slant, odd one out and chain questions, built on the CMU Pronouncing Dictionary through Barsmith's rhyme engine.
- **Mix:** all five, in 75-second blocks with a transition card.
- **Adaptive difficulty:** 20 levels per mode, with longer answer windows for Stairs and Run, and Gentle / Standard / Hard.
- **Results:** a count-up with accuracy and response deltas against your last matching session, best streak, switch cost, and a share card (PNG).
- **History:** a trend per mode, a five-week consistency strip, and session detail.
- **Sessions survive interruptions:** a session pauses itself when you leave the app for more than 3 seconds, and resumes after a reload or crash within 30 minutes. The screen stays on while you play.
- **Private:** everything stays on the device. No account, no tracking, no network needed.

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
npm run e2e            # Playwright on iPhone 14 and Pixel 7: flows, offline, share card, layout and accessibility floor
npm run e2e:long       # 3-minute sessions in every mode with pause, background and reload cycles (~15 min)
npm run screens        # every screen and mode state at 360×800 and 390×844, written to docs/screens/
npm run store:screens  # App Store and Play screenshots, written to store/screenshots/
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
- `src/platform/native.ts`: the Capacitor bridge (lazy-loaded)
- `scripts/`: rhyme data build, icons and splash screens, contrast check
- [DESIGN.md](DESIGN.md), [FLOWS.md](FLOWS.md), [REVIEW.md](REVIEW.md), [DECISIONS.md](DECISIONS.md)

Pronunciation data: CMU Pronouncing Dictionary, BSD-2-clause (see `src/data/PRONUNCIATION-LICENSE`).
