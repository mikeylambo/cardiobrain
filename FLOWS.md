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
