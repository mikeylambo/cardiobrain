import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon.svg", "icon.svg"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest}"]
      },
      manifest: {
        name: "CardioBrain",
        short_name: "CardioBrain",
        description: "Train your body. Keep your mind sharp.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#05060A",
        theme_color: "#05060A",
        lang: "en",
        icons: [
          { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" }
        ]
      }
    })
  ],
  server: {
    host: true
  },
  build: {
    target: "es2022"
  }
});
