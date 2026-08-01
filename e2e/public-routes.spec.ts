import { expect, test } from "../playwright-fixture";

test.describe("public web smoke", () => {
  test("landing page renders in Hebrew RTL and its FAQ is interactive", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.locator("html")).toHaveAttribute("lang", "he");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /להבין מה באמת קורה/,
      }),
    ).toBeVisible();
    await expect(page.locator("#main-content")).toBeVisible();

    const question = page.getByRole("button", {
      name: "איך Kippy מצמצמת התראות שווא?",
    });
    await question.click();
    await expect(
      page.getByText(
        "המערכת אינה מסתפקת במילת טריגר. היא בוחנת את רצף השיחה, הכיוון, המשתתפים והגיל כדי להבדיל בין צחוק וסלנג לבין פגיעה אמיתית.",
        { exact: true },
      ),
    ).toBeVisible();
  });

  test("authentication screen is available without submitting credentials", async ({ page }) => {
    await page.goto("/auth", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", { level: 1, name: "התחברות" }),
    ).toBeVisible();
    await expect(page.getByLabel("אימייל")).toBeVisible();
    await expect(page.getByLabel("סיסמה")).toBeVisible();
    await expect(page.getByRole("button", { name: "התחבר" })).toBeVisible();
  });

  test("legal pages are publicly reachable", async ({ page }) => {
    for (const legalPage of [
      {
        path: "/privacy",
        heading: "מדיניות פרטיות - KippyAI",
        forbiddenLegacyClaim: "נתוני שימוש באפליקציות",
      },
      {
        path: "/terms",
        heading: "תנאי שימוש - KippyAI",
        forbiddenLegacyClaim: "Telegram",
      },
    ]) {
      await test.step(legalPage.path, async () => {
        await page.goto(legalPage.path, { waitUntil: "domcontentloaded" });
        await expect(
          page.getByRole("heading", { level: 1, name: legalPage.heading }),
        ).toBeVisible();
        await expect(page.locator("main")).toBeVisible();
        await expect(page.locator('[dir="rtl"]').first()).toBeVisible();
        await expect(page.getByRole("note")).toBeVisible();
        await expect(
          page.getByText(legalPage.forbiddenLegacyClaim, { exact: false }),
        ).toHaveCount(0);
      });
    }
  });

  test("unknown routes show the local not-found page", async ({ page }) => {
    await page.goto("/this-route-does-not-exist", {
      waitUntil: "domcontentloaded",
    });

    await expect(
      page.getByRole("heading", { level: 1, name: "404" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Return to Home" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  test("the reduced-motion accessibility setting applies and persists locally", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "הגדרות נגישות" }).click();

    const panel = page.getByRole("dialog", { name: "הגדרות נגישות" });
    const reduceMotion = panel.getByRole("switch", { name: "הפסק אנימציות" });

    await expect(panel).toBeVisible();
    await expect(reduceMotion).not.toBeChecked();
    await reduceMotion.click();
    await expect(reduceMotion).toBeChecked();
    await expect(page.locator("html")).toHaveClass(/(?:^|\s)reduce-motion(?:\s|$)/);

    await page.reload();
    await expect(page.locator("html")).toHaveClass(/(?:^|\s)reduce-motion(?:\s|$)/);
  });
});

test.describe("mobile public web smoke", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });

  test("landing page keeps its primary content and accessibility control usable", async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /להבין מה באמת קורה/,
      }),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    expect(
      await page.evaluate(
        () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      ),
    ).toBe(true);

    const accessibilityButton = page.getByRole("button", {
      name: "הגדרות נגישות",
    });
    const touchTarget = await accessibilityButton.boundingBox();

    expect(touchTarget).not.toBeNull();
    expect(touchTarget?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(touchTarget?.height ?? 0).toBeGreaterThanOrEqual(44);

    // Exercise viewport-triggered content before capturing the full-page artifact.
    // This catches sections that remain hidden when motion is reduced.
    for (const section of await page.locator("main section").all()) {
      await section.scrollIntoViewIfNeeded();
      await page.waitForTimeout(50);
    }
    await expect(
      page.getByRole("heading", { name: "מזהים סיכון אמיתי" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "הודעות טקסט" }),
    ).toBeVisible();
    await page.evaluate(() => window.scrollTo({ top: 0 }));

    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth + 1,
      ),
    ).toBe(true);

    await testInfo.attach("landing-mobile-rtl-reduced-motion", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
  });
});
