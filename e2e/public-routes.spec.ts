import { expect, test } from "../playwright-fixture";

test.describe("public web smoke", () => {
  test("landing page renders in Hebrew RTL and its FAQ is interactive", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.locator("html")).toHaveAttribute("lang", "he");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /הם לא צריכים שתראו הכול/,
      }),
    ).toBeVisible();
    await expect(page.locator("#main-content")).toBeVisible();

    const waitlistCta = page.getByRole("button", {
      name: "מצטרפים לעדכונים",
      exact: true,
    }).first();
    await expect(waitlistCta).toBeVisible();
    await waitlistCta.click();
    await expect(
      page.getByRole("dialog").getByRole("heading", {
        name: "מצטרפים לעדכוני KippyAI",
      }),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    const question = page.getByRole("button", {
      name: "מה הסטטוס של KippyAI כיום?",
    });
    await question.click();
    await expect(
      page.getByText(
        "KippyAI נמצאת בפיתוח לקראת השקה. הצטרפות לעדכונים אינה פתיחת חשבון ואינה מעידה שהמוצר זמין לציבור.",
        { exact: true },
      ),
    ).toBeVisible();

    const body = page.locator("body");
    for (const unsupportedCopy of [
      "Kippy בודקת טקסט והודעות קוליות",
      "תמלול מהיר ומדויק",
      "פרטיות מקומית",
      "צרו חשבון, הוסיפו ילד",
      "קיצור ללוח ההורה במסך הבית",
    ]) {
      await expect(body).not.toContainText(unsupportedCopy);
    }
  });

  test("waitlist submission persists once with first-touch and submission-touch attribution", async ({
    page,
  }) => {
    const waitlistRpcCalls: Record<string, unknown>[] = [];

    await page.route("**/rest/v1/rpc/v2_submit_marketing_waitlist", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }

      const body = route.request().postDataJSON() as Record<string, unknown>;
      waitlistRpcCalls.push(body);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify("11111111-1111-4111-8111-111111111111"),
      });
    });

    await page.goto(
      "/?utm_source=founder&utm_medium=organic&utm_campaign=prelaunch&utm_content=hero&utm_term=parents",
      { waitUntil: "domcontentloaded" },
    );
    await page.getByRole("button", { name: "מצטרפים לעדכונים", exact: true }).first().click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/^שם ההורה/).fill("בדיקת קיפי");
    await dialog.getByLabel(/^אימייל/).fill("landing-gate@example.com");
    await dialog.getByLabel(/^מספר טלפון/).fill("0501234567");
    await dialog.getByLabel(/^גיל הילד/).fill("11");
    await dialog.getByRole("button", { name: "Android" }).click();
    await dialog.getByRole("button", { name: "מצטרפים לעדכונים", exact: true }).click();

    await expect(dialog.getByRole("heading", { name: "נרשמת בהצלחה" })).toBeVisible();
    expect(waitlistRpcCalls).toHaveLength(1);
    expect(waitlistRpcCalls[0]).toMatchObject({
      target_parent_name: "בדיקת קיפי",
      target_email: "landing-gate@example.com",
      target_phone: "0501234567",
      target_child_age: 11,
      target_device_os: "android",
      target_landing_path: "/",
      target_referrer_host: null,
      target_marketing_notice_version: "waitlist-updates-v1",
      target_first_touch: {
        utm_source: "founder",
        utm_medium: "organic",
        utm_campaign: "prelaunch",
        utm_content: "hero",
        utm_term: "parents",
        landing_path: "/",
      },
      target_submission_touch: {
        utm_source: "founder",
        utm_medium: "organic",
        utm_campaign: "prelaunch",
        utm_content: "hero",
        utm_term: "parents",
        landing_path: "/",
      },
    });
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
        name: /הם לא צריכים שתראו הכול/,
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
      page.getByRole("heading", { name: "דרך רגועה יותר להורות בעולם הדיגיטלי" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "מה KippyAI נבנית להציע" }),
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
