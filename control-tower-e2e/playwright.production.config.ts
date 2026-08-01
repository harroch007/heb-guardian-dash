import { defineConfig } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDir, "..");

export default defineConfig({
  testDir,
  testMatch: "production.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: "line",
  outputDir: path.join(testDir, "test-results", "production"),
  use: {
    baseURL: "http://127.0.0.1:43175",
    browserName: "chromium",
    locale: "he-IL",
    viewport: { width: 1280, height: 800 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node control-tower-e2e/serve-production.mjs",
    cwd: repositoryRoot,
    env: {
      ...process.env,
      VITE_CONTROL_TOWER_FIXTURES: "true",
    },
    url: "http://127.0.0.1:43175/control-tower/inbox",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
