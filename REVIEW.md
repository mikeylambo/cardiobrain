# CardioBrain: Review loop

1. **`npm run build`** runs typecheck, lint (hooks rules as errors), unit and property tests, the contrast check, then the Vite build.
2. **`npm run e2e`** runs the flows on iPhone 14 and Pixel 7, plus the layout and accessibility floor at 360px.
3. **`npm run e2e:long`** plays a 3-minute session in every mode and in Mix. Each run includes 10 pause/resume cycles, a background cycle and a reload-and-resume. Any console error fails it.
4. **`npx playwright test e2e/screens.spec.ts --project iphone-14`** writes every screen and mode state at 360×800 and 390×844 to `docs/screens/`. Open them and look. If a screen reads as a generic card UI, reads small, wraps, clips or has weak contrast, fix it and re-shoot.
5. **Lighthouse (mobile):** Performance, Accessibility and Best Practices at 95 or above.
