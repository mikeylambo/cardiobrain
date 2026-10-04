// Opt-in, anonymous usage stats for the web build (Vercel Web Analytics: no cookies, no personal
// data). Off by default; the native apps never load it.
import { isNative } from "./native";

let enabled = false;
let loaded: Promise<typeof import("@vercel/analytics")> | null = null;

function lib() {
  loaded ??= import("@vercel/analytics").then((m) => {
    m.inject({
      mode: "production",
      // Turning it off stops everything at once, even though the script stays loaded.
      // The automatic first page view is dropped too: screens are counted as their own pages.
      beforeSend: (event) => {
        if (!enabled) return null;
        const url = event.url.split("?")[0]!;
        return event.type === "pageview" && new URL(url).pathname === "/" ? null : { ...event, url };
      },
    });
    return m;
  });
  return loaded;
}

const usable = () => !isNative && import.meta.env.PROD && location.hostname !== "localhost" && location.hostname !== "127.0.0.1";

export function setAnalytics(on: boolean): void {
  enabled = on;
  if (on && usable()) void lib().catch(() => undefined);
}

/** A screen view, as a virtual page ("/settings"), so screens show up as pages. */
export function trackScreen(screen: string): void {
  if (!enabled || !usable()) return;
  void lib()
    .then((m) => m.pageview({ route: `/${screen}`, path: `/${screen}` }))
    .catch(() => undefined);
}

export function trackEvent(name: string, props: Record<string, string | number | boolean>): void {
  if (!enabled || !usable()) return;
  void lib()
    .then((m) => m.track(name, props))
    .catch(() => undefined);
}
