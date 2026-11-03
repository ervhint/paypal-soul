import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// Tests read .env.local on localhost and GitHub Actions secrets in CI.
export default defineConfig({
  resolve: { alias: { "@": import.meta.dirname } },
  test: { env: loadEnv("test", import.meta.dirname, ""), include: ["tests/**/*.test.ts"], testTimeout: 30_000 },
});
