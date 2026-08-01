import { expect, test, type Page } from "@playwright/test";

type FixtureScenario =
  | "GRANTED_MANAGER"
  | "GRANTED_L1"
  | "GRANTED_AAL1"
  | "UNAUTHENTICATED"
  | "MFA_REQUIRED"
  | "FORBIDDEN"
  | "UNAVAILABLE";

const pageFailures = new WeakMap<Page, string[]>();

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

async function prepare(page: Page, scenario: FixtureScenario = "GRANTED_MANAGER") {
  await page.addInitScript((selectedScenario) => {
    (window as Window & { __KIPPY_CT_FIXTURE_SCENARIO__?: FixtureScenario }).__KIPPY_CT_FIXTURE_SCENARIO__ = selectedScenario;
  }, scenario);
}

async function openInbox(page: Page, scenario: FixtureScenario = "GRANTED_MANAGER") {
  await prepare(page, scenario);
  await page.goto("/control-tower/inbox");
}

test("manager sees the calm RTL three-pane inbox and all six synthetic scenarios", async ({ page }, testInfo) => {
  await openInbox(page);

  await expect(page.getByTestId("fixture-banner")).toContainText("נתוני דמה");
  await expect(page.locator(".ct-root")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("[data-conversation-id]")).toHaveCount(6);
  await expect(page.locator('[data-conversation-id="conv_fixture_delivery_001"]')).toContainText("השליחה נכשלה");

  await page.keyboard.press("Tab");
  await expect(page.locator(".ct-skip-link")).toBeFocused();
  const firstQueueBox = await page.locator(".ct-queue-button").first().boundingBox();
  expect(firstQueueBox).not.toBeNull();
  expect(firstQueueBox!.height).toBeGreaterThanOrEqual(44);

  const inboxBox = await page.locator(".ct-inbox-panel").boundingBox();
  const conversationBox = await page.locator(".ct-conversation-panel").boundingBox();
  const customerBox = await page.locator(".ct-customer-panel").boundingBox();
  expect(inboxBox).not.toBeNull();
  expect(conversationBox).not.toBeNull();
  expect(customerBox).not.toBeNull();
  expect(inboxBox!.x).toBeLessThan(conversationBox!.x);
  expect(conversationBox!.x).toBeLessThan(customerBox!.x);

  await page.locator('[data-conversation-id="conv_fixture_device_001"]').click();
  await expect(page.locator(".ct-verification-verified")).toContainText("Guardian");
  await expect(page.getByTestId("customer-360")).toContainText("Samsung");
  await expect(page.getByTestId("customer-360")).toContainText("לא נאסף");
  await expect(page.getByTestId("customer-360")).toContainText("מיושן");
  const capabilityKeys = await page.locator("[data-capability-key]").evaluateAll((items) =>
    items.map((item) => item.getAttribute("data-capability-key")),
  );
  expect(capabilityKeys).toEqual([
    "accessibility_enabled",
    "notification_listener_enabled",
    "app_notifications_allowed",
    "battery_optimization_exempt",
    "oem_autostart_review",
    "usage_access",
    "precise_location",
    "background_location",
    "location_services",
    "package_inventory",
  ]);
  await expect(page.locator('[data-capability-key="battery_optimization_exempt"]')).toContainText("חסום");
  await expect(page.locator('[data-capability-key="usage_access"]')).toContainText("לא נתמך");
  await expect(page.locator('[data-capability-key="oem_autostart_review"]')).toContainText("לא ידוע");
  const parentalSync = page.getByTestId("parental-sync");
  await expect(parentalSync).toContainText("המכשיר טרם החיל את הגרסה הרצויה");
  await expect(parentalSync).toContainText("פער גרסאות");
  await expect(parentalSync).toContainText("דוח מצב נצפה");
  await expect(parentalSync).toContainText("שלמות צילום המלאי");
  await expect(parentalSync).toContainText("לא ידוע");
  await expect(parentalSync).not.toContainText("צילום זמן מסך");
  await expect(parentalSync).not.toContainText("צילום אפליקציות");
  await page.screenshot({ path: testInfo.outputPath("control-tower-desktop.png"), fullPage: true });
});

test("prospect, ambiguous identity, unavailable source and restricted safety remain explicit", async ({ page }) => {
  await openInbox(page);

  await page.locator('[data-conversation-id="conv_fixture_prospect_001"]').click();
  await expect(page.locator(".ct-conversation-header")).toContainText("ללא Case");
  await expect(page.locator(".ct-customer-blocked")).toContainText("אין רשומת לקוח מקושרת");

  await page.locator('[data-conversation-id="conv_fixture_identity_001"]').click();
  await expect(page.locator(".ct-verification-warning")).toContainText("כמה התאמות");
  await expect(page.locator(".ct-customer-blocked")).toContainText("נדרש בירור זהות");
  await expect(page.locator(".ct-customer-toggle")).toBeDisabled();
  await expect(page.locator(".ct-composer textarea")).toBeDisabled();

  await page.locator('[data-conversation-id="conv_fixture_xiaomi_001"]').click();
  await expect(page.getByTestId("source-unavailable")).toBeVisible();
  await expect(page.getByTestId("customer-360")).toContainText("המקור אינו זמין");

  await page.locator('[data-conversation-id="conv_fixture_safety_001"]').click();
  await expect(page.locator(".ct-message-redacted")).toContainText("אין הרשאה");
  await expect(page.locator(".ct-composer textarea")).toBeDisabled();
});

test("L1 access masks sensitive finance data and hides R2 and R3 operations", async ({ page }) => {
  await openInbox(page, "GRANTED_L1");
  await expect(page.locator("[data-conversation-id]")).toHaveCount(3);
  await page.locator('[data-conversation-id="conv_fixture_device_001"]').click();
  await expect(page.getByTestId("customer-360")).toContainText("אין הרשאה");
  await expect(page.locator('[data-action-id="REPORT_HEARTBEAT"]')).toHaveCount(0);
  await expect(page.locator('[data-action-id="LOCATE_NOW"]')).toHaveCount(0);
  await expect(page.locator('[data-action-id="RING_DEVICE"]')).toHaveCount(0);
});

test("a granted AAL1 session is still stopped at the MFA gate", async ({ page }) => {
  await openInbox(page, "GRANTED_AAL1");
  await expect(page.locator('[data-access-state="MFA_REQUIRED"]')).toBeVisible();
  await expect(page.locator("[data-conversation-id]")).toHaveCount(0);
});

test("safe command confirmation is in-memory and idempotent", async ({ page }) => {
  await openInbox(page);
  await page.locator('[data-conversation-id="conv_fixture_device_001"]').click();

  const action = page.locator('[data-action-id="REPORT_HEARTBEAT"]');
  await action.getByRole("button", { name: "הפעלה" }).click();
  await action.getByTestId("confirm-REPORT_HEARTBEAT").click();
  await expect(page.getByTestId("command-message")).toContainText("הושלמה");
  await expect(page.getByTestId("customer-360")).toContainText("בתהליך התאוששות");
  await expect(page.locator('[data-event-type="ACTION"]')).toHaveCount(1);

  await action.getByRole("button", { name: "הפעלה" }).click();
  await action.getByTestId("confirm-REPORT_HEARTBEAT").click();
  await expect(page.locator('[data-event-type="ACTION"]')).toHaveCount(1);
});

test("mobile uses master-detail routes without horizontal overflow", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openInbox(page);
  await expect(page.locator(".ct-inbox-panel")).toBeVisible();
  await expect(page.locator(".ct-conversation-panel")).toBeHidden();

  await page.locator('[data-conversation-id="conv_fixture_device_001"]').click();
  await expect(page.locator(".ct-inbox-panel")).toBeHidden();
  await expect(page.locator(".ct-conversation-panel")).toBeVisible();
  await page.locator(".ct-customer-toggle").click();
  await expect(page).toHaveURL(/\/control-tower\/inbox\/conv_fixture_device_001\/customer/);
  await expect(page.locator(".ct-customer-panel")).toBeVisible();
  await expect(page.locator(".ct-conversation-panel")).toBeHidden();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: testInfo.outputPath("control-tower-mobile.png"), fullPage: true });
});

for (const [scenario, state] of [
  ["UNAUTHENTICATED", "UNAUTHENTICATED"],
  ["MFA_REQUIRED", "MFA_REQUIRED"],
  ["FORBIDDEN", "FORBIDDEN"],
  ["UNAVAILABLE", "UNAVAILABLE"],
] as const) {
  test(`access state ${scenario} fails closed`, async ({ page }) => {
    await openInbox(page, scenario);
    await expect(page.locator("[data-access-state]")).toHaveAttribute("data-access-state", state);
    await expect(page.locator("[data-conversation-id]")).toHaveCount(0);
  });
}

test("reduced-motion preference disables meaningful animation duration", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openInbox(page, "UNAVAILABLE");
  const duration = await page.locator(".ct-root *").first().evaluate((element) => getComputedStyle(element).animationDuration);
  const durationsInSeconds = duration.split(",").map((value) => Number.parseFloat(value));
  expect(durationsInSeconds.every((value) => Number.isFinite(value) && value <= 0.00001)).toBe(true);
});
