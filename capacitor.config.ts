import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The one place the app id lives. Confirm it before the first store submission:
 * it cannot change once an app is published.
 */
export const APP_ID = "com.mikeylambo.cardiobrain";

const config: CapacitorConfig = {
  appId: APP_ID,
  appName: "CardioBrain",
  // The web build is bundled into the app, so it runs fully offline. No server.url.
  webDir: "dist",
  backgroundColor: "#16181D",
  ios: {
    contentInset: "never",
    scrollEnabled: false,
  },
  android: {
    backgroundColor: "#16181D",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: "#16181D",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#16181D",
      overlaysWebView: true,
    },
  },
};

export default config;
