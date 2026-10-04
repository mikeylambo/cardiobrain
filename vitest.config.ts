import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify("test") },
  plugins: [react()],
  test: {
    include: ["src/**/*.{test,spec}.{ts,tsx,js,jsx}"],
    environment: "node",
    globals: false,
    clearMocks: true,
    testTimeout: 120_000,
  },
});
