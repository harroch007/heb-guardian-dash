import { expect, test, type Page } from "@playwright/test";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pageFailures = new WeakMap<Page, string[]>();
const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const assetsDirectory = path.resolve(testDirectory, "..", "dist", "assets");

test.beforeEach(async ({ page }) => {
  const failures: string[] = [];
  pageFailures.set(page, failures);
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  await page.route("https://fonts.googleapis.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/css", body: "" }),
  );
});

test.afterEach(async ({ page }) => {
  expect(pageFailures.get(page) ?? []).toEqual([]);
});

test("production ignores the fixture flag, performs no external data call and fails closed", async ({ page }) => {
  const externalDataRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      url.origin !== "http://127.0.0.1:43175" &&
      ["fetch", "xhr", "websocket"].includes(request.resourceType())
    ) {
      externalDataRequests.push(request.url());
    }
  });

  await page.goto("/control-tower/inbox");
  await expect(page.locator('[data-access-state="UNAVAILABLE"]')).toBeVisible();
  await expect(page.getByTestId("fixture-banner")).toHaveCount(0);
  await expect(page.locator("[data-conversation-id]")).toHaveCount(0);
  expect(externalDataRequests).toEqual([]);
});

test("all production assets exclude the synthetic fixture dataset", async ({ page }) => {
  const entries = await readdir(assetsDirectory, { withFileTypes: true });
  const assetFiles = entries.filter((entry) => entry.isFile()).map((entry) => path.join(assetsDirectory, entry.name));
  expect(assetFiles.length).toBeGreaterThan(0);

  const markers = [Buffer.from("conv_fixture_device_001"), Buffer.from("FixtureControlTowerRepository")];
  for (const assetFile of assetFiles) {
    const contents = await readFile(assetFile);
    for (const marker of markers) expect(contents.includes(marker), assetFile).toBeFalsy();
  }

  await page.goto("/control-tower/inbox");
  await expect(page.locator('[data-access-state="UNAVAILABLE"]')).toBeVisible();
});
