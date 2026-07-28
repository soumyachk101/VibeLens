import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // Playwright-backed tests need a generous budget for the first browser launch.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Browser launches are heavy; keep the suite serial for predictable resource use.
    fileParallelism: false,
  },
});
