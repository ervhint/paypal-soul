import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// Tests read .env.local on localhost and GitHub Actions secrets in CI. REAL=1 runs the question list against
// the real models instead (T-16.13), which costs money, so it never runs with `npm test`.
export default defineConfig({
  resolve: { alias: { "@": import.meta.dirname } },
  test: { env: loadEnv("test", import.meta.dirname, ""), include: process.env.REAL ? ["tests/real/*.real.ts"] : ["tests/**/*.test.ts"], testTimeout: process.env.REAL ? 900_000 : 30_000 },
});
