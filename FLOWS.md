# CardioBrain: Flows (each one is covered by `e2e/flows.spec.ts`)

## First launch

Welcome → tap an activity → 3-2-1 → guided round (30s of Mix at calibration level) → Results ("That's the whole game.") → Continue → Home.

- The first challenge appears within 15 seconds of load (measured: about 5 seconds).
- On iOS Safari, Home offers Add to Home Screen once.

## Returning

Home shows the activity name in display type and the preset ("Mix, 20 min").

- **Start** begins a session with the last settings.
- **Change** opens the setup sheet: activity, mode, duration, then Start.

## Interruption

- **Backgrounded:** the clock stops at once. Back within 3 seconds, play carries on. Longer than that, the screen says "Paused. Your session is saved." with Resume (3-2-1) and End session.
- **Reload or crash:** if the session was saved less than 30 minutes ago, Home shows "Resume your session" as the primary action. It reopens paused; Resume then runs the 3-2-1.

## Ending

- **Pause:** tap the icon. Press and hold it to open "End this session?".
- **Results:** Go again (same settings), Change (the sheet), Share (PNG card), Home.

## v2.1 additions

- **Daily:** Home, then Daily #N, 3-2-1, six 30-second blocks, then Results ("Daily #N done."). Home then shows "Done today: N%".
- **Seated baseline:** Change, Seated, Start. Results says "Seated baseline saved". The next moving session of that mode shows its motion cost.
- **Intervals:** Change, Intervals 1/1 min, Start. The work bout plays challenges; recovery shows a countdown card, then challenges return.
- **Mood (when on):** Start, "How do you feel?", one tap or skip, then the 3-2-1. Results asks again.
- **Start links:** `/?start=bike&mode=nback` or `cardiobrain://start?activity=bike` go straight to the countdown.
- **Backup:** Settings, Back up (export) downloads a file. Restore from a backup (import) merges it with no duplicates.
