# CardioBrain: Design

**Subject:** someone mid-workout, glancing at a phone for under a second, in full sun or a dim gym. Every screen has to be read instantly, tapped with a shaky thumb, and feel like an athletic product rather than a dashboard.

**The one bold move:** during a session, the whole screen is one flat, saturated activity color, with giant condensed type and large chalk tiles. Everything outside the session stays quiet.

## Tokens (source of truth: `src/styles.css`, checked by `npm run contrast`)

| Token                | Hex       | Text on it       |
| -------------------- | --------- | ---------------- |
| Lagoon (Walk)        | `#0B7A6B` | White, 5.24:1    |
| Signal (Bike)        | `#FFC400` | Asphalt, 11.12:1 |
| Ultraviolet (Stairs) | `#5B2EFF` | White, 6.40:1    |
| Vermilion (Run)      | `#FF4B2B` | Asphalt, 5.32:1  |
| Asphalt              | `#16181D` | Chalk, 16.12:1   |
| Chalk                | `#F4F4F1` | Asphalt, 16.12:1 |
| Muted (on Chalk)     | `#5A5D66` | 5.97:1           |

- No red for wrong answers, no gradients, no glows.
- Tiles on Signal carry a 2px Asphalt edge, because chalk on yellow can't meet the 3:1 non-text floor.
- The primary button is Chalk on Lagoon and Ultraviolet, Asphalt on Signal and Vermilion.

## Type

Archivo variable (width axis), self-hosted and preloaded.

- **Display and stimulus:** 62% width, weight 800, line-height 0.92.
- **Body:** 100% width, weight 500–650.
- **Scale:** 14 / 17 / 24 / 40 / 72 / 160.
- **Numbers:** tabular figures for all changing numbers.
- **Style:** sentence case, no tracked capitals, no monospace labels.

## Layout

- 20px gutters, left-aligned.
- One primary action per screen, in the bottom 40%.
- Answer tiles at least 96px tall (132px when there are only two), with 12px gaps.
- Every control is at least 48px.
- Structure comes from color blocks and whitespace. No card grids.

## Motion

- Ease `cubic-bezier(0.2, 0.8, 0.2, 1)`. Feedback 120ms, screen change 280ms.
- **The orchestrated moment:** the 3-2-1 on the field, then the session layer wipes up (360ms) and the stimulus resolves from condensed width.
- **Correct:** the stimulus breathes (wider, then back). **Wrong:** the tile nudges 4px.
- **Results:** a 0 to N count-up over 900ms with a tick every 10 points. Tap to skip.
- **Reduced motion:** every animation becomes a fade under 100ms.

## Voice

Plain, specific, sentence case: "Start", "Resume", "Go again", "Paused. Your session is saved." Errors say what happened and what to do next.
