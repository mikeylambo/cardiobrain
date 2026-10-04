import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Use the preinstalled Chromium when present. iPhone 14 is emulated in Chromium (viewport,
// DPR, touch, user agent); WebKit itself is not installed on the build machine.
const local = process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium";
const launchOptions = existsSync(local) ? { executablePath: local } : {};

export default defineConfig({
  testDir: "./e2e",
  outputDir: process.env.PW_OUT ?? "test-results",
  timeout: 120_000,
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    launchOptions,
  },
  webServer: {
    command: "npx vite preview --host 127.0.0.1 --port 4173 --strictPort",
    port: 4173,
    reuseExistingServer: true,
  },
  projects: [
    { name: "iphone-14", use: { ...devices["iPhone 14"], browserName: "chromium", defaultBrowserType: "chromium" } },
    { name: "pixel-7", use: { ...devices["Pixel 7"] } },
    // Real WebKit, the engine behind Safari on iPhone. Runs in CI on macOS (PW_WEBKIT=1).
    ...(process.env.PW_WEBKIT ? [{ name: "iphone-14-webkit", use: { ...devices["iPhone 14"], launchOptions: {} } }] : []),
  ],
});
