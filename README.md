# CardioBrain

**Train your body. Keep your mind sharp.**

CardioBrain is a mobile-first cognitive training PWA designed for walking, biking, stairs, and running. The screen is deliberately glanceable: one huge stimulus, huge tap targets, no typing while moving.

## What ships
- Numbers, Switch, React, Recall, and Rhyme Rush
- Mix rotation across all five modes
- Adaptive difficulty across 20 levels per mode
- Activity-aware response timing
- Session scoring, streaks, history, comparisons, and share cards
- Offline-first PWA with resumable sessions
- Sound, haptic, reduced-motion, and difficulty-bias settings
- Local-only data; no accounts or backend

## Play

Live: https://cardiobrain.vercel.app

For a useful moving test:
1. Open CardioBrain on your phone and add it to the Home Screen.
2. Start with a 10-minute Walk session on Standard difficulty.
3. Use Mix and keep the phone where each large answer pad is easy to hit safely.
4. Try Numbers, Switch, Recall, React, and Rhyme Rush without stopping your workout.
5. Finish the session, inspect Results, then check History after the next workout.

## Development

```bash
npm install
npm run dev
```

Release checks:

```bash
npm run test
npm run build
npm run e2e
```

Design rules live in DESIGN.md. Critical tap paths live in FLOWS.md. The repeatable visual/function review loop lives in REVIEW.md.

The production project is connected to the `mikeylambo/cardiobrain` GitHub repository and deploys as a static Vite app on Vercel.
