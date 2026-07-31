import { expect, test as base } from "@playwright/test";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

export const test = base.extend({
  page: async ({ page }, providePage) => {
    // Keep smoke tests self-contained: no Supabase, analytics, fonts, or other
    // external services are contacted from the browser.
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      const isNetworkRequest = url.protocol === "http:" || url.protocol === "https:";

      if (isNetworkRequest && !LOCAL_HOSTS.has(url.hostname)) {
        await route.abort("blockedbyclient");
        return;
      }

      await route.continue();
    });

    // Avoid a delayed cookie banner obscuring the public-page smoke checks.
    // Every Playwright test already runs in a fresh isolated browser context.
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem("cookie-consent", "essential");
      } catch {
        // Storage can be unavailable in opaque frames; the app page is unaffected.
      }
    });

    await providePage(page);
  },
});

export { expect };
