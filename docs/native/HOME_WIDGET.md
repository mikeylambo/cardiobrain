# Home Screen widget: spec

Status: **specified, not built.** It needs Xcode (WidgetKit) and Android Studio (Glance or App Widgets) and a device to verify. The data it needs already exists.

## What it shows

- **Small:** the weekly goal ring ("2 of 3") and today's Daily status ("Daily #12" or "Done, 87%").
- **Medium:** the same, plus the last session as one line, and two buttons: Start (last preset) and Daily.

## How it gets data

- After every finished session, the web app writes a tiny summary to shared storage: `{week, goal, dailyKey, dailyAccuracy, last: {activity, mode, accuracy, avgRt}}`.
  - **iOS:** an App Group `UserDefaults` suite, written through a small Capacitor plugin, then `WidgetCenter.shared.reloadAllTimelines()`.
  - **Android:** `SharedPreferences` plus `AppWidgetManager.updateAppWidget`.
- **Buttons:** deep links the app already handles: `cardiobrain://start` (last preset) and `cardiobrain://start?daily` (see `src/platform/links.ts`).

## Acceptance

- The widget updates within a minute of finishing a session.
- Tapping Start lands in the countdown, never on Home.
