import { defineConfig } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDir, "..");

export default defineConfig({
  testDir,
  testMatch: "fixture.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 8_000 },
  reporter: "line",
  outputDir: path.join(testDir, "test-results", "fixture"),
  use: {
    baseURL: "http://127.0.0.1:43174",
    browserName: "chromium",
    locale: "he-IL",
    timezoneId: "Asia/Jerusalem",
    viewport: { width: 1440, height: 960 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 43174 --strictPort",
    cwd: repositoryRoot,
    env: {
      ...process.env,
      VITE_CONTROL_TOWER_FIXTURES: "true",
    },
    url: "http://127.0.0.1:43174/control-tower/inbox",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
