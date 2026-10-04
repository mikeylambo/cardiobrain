import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["favicon.svg", "apple-touch-icon.png", "fonts/*.woff2", "privacy.html"],
      workbox: {
        // Everything, including the rhyme word list, is precached: the app is fully offline after one load.
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,txt,webmanifest}"],
        globIgnores: ["splash/**", "og-image.png", "twitter-card.png"],
        maximumFileSizeToCacheInBytes: 3_000_000,
        navigateFallbackDenylist: [/^\/privacy/],
      },
      manifest: {
        id: "/",
        name: "CardioBrain",
        short_name: "CardioBrain",
        description: "Quick brain challenges you play while you move.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#16181D",
        theme_color: "#16181D",
        lang: "en",
        categories: ["health", "fitness"],
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  server: { host: true },
  build: { target: "es2022" },
});
