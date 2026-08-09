import { readFileSync } from "node:fs";
import type { Page, Route } from "@playwright/test";
import { expect, test } from "../playwright-fixture";

const USER_ID = "71000000-0000-4000-8000-000000000099";
const NOW = "2026-08-09T20:00:00.000Z";

const env = new Map(
  readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => [match[1], match[2].replace(/^['"]|['"]$/g, "")]),
);

const supabaseURL = env.get("VITE_SUPABASE_URL");
if (!supabaseURL) throw new Error("VITE_SUPABASE_URL is required for recovery E2E");

const user = {
  id: USER_ID,
  aud: "authenticated",
  role: "authenticated",
  email: "parent.recovery@example.invalid",
  email_confirmed_at: NOW,
  phone: "",
  confirmed_at: NOW,
  last_sign_in_at: NOW,
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { full_name: "הורה בדיקת שחזור" },
  identities: [],
  created_at: NOW,
  updated_at: NOW,
  is_anonymous: false,
};

const encodeJwtPart = (value: object) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

const accessToken = [
  encodeJwtPart({ alg: "HS256", typ: "JWT" }),
  encodeJwtPart({
    aud: "authenticated",
    exp: 4_102_444_800,
    iat: 1_775_000_000,
    iss: `${new URL(supabaseURL).origin}/auth/v1`,
    role: "authenticated",
    sub: USER_ID,
    email: user.email,
  }),
  "synthetic-recovery-signature",
].join(".");

const session = {
  access_token: accessToken,
  token_type: "bearer",
  expires_in: 2_147_483_647,
  expires_at: 4_102_444_800,
  refresh_token: "synthetic-recovery-refresh-token",
  user,
};

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers":
    "authorization, apikey, content-type, prefer, range, x-client-info",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD",
  "content-type": "application/json",
};

async function fulfillJson(route: Route, json: unknown) {
  if (route.request().method() === "OPTIONS") {
    await route.fulfill({ status: 204, headers: corsHeaders });
    return;
  }
  await route.fulfill({ status: 200, headers: corsHeaders, json });
}

async function installRecoverySession(page: Page, updateBodies: unknown[]) {
  await page.route("**/auth/v1/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (request.method() === "PUT" && pathname.endsWith("/user")) {
      updateBodies.push(request.postDataJSON());
      await fulfillJson(route, user);
      return;
    }
    await fulfillJson(route, pathname.endsWith("/user") ? user : session);
  });

  await page.route("**/rest/v1/**", (route) => fulfillJson(route, []));
  await page.route("**/functions/v1/**", (route) => fulfillJson(route, {}));

  // Exercise the application's own sign-in path so supabase-js persists the
  // synthetic session exactly as it does at runtime.
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.getByLabel("אימייל").fill(user.email);
  await page.getByLabel("סיסמה").fill("Synthetic123!");
  await page.getByRole("button", { name: "התחבר", exact: true }).click();
  await expect(page).not.toHaveURL(/\/auth$/);
}

test.describe("parent password recovery", () => {
  test("shows an invalid state without a recovery session", async ({ page }) => {
    await page.goto("/auth?reset=true", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", { name: "קישור האיפוס אינו תקף" }),
    ).toBeVisible();
    await expect(page.locator('html[dir="rtl"]')).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth + 1,
      ),
    ).toBe(true);
  });

  test("keeps a valid recovery session on the form and updates the password", async ({
    page,
  }) => {
    const updateBodies: unknown[] = [];
    await installRecoverySession(page, updateBodies);

    await page.goto("/auth?reset=true", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", { name: "קביעת סיסמה חדשה" }),
    ).toBeVisible();
    await page.getByLabel("סיסמה חדשה", { exact: true }).fill("Recovery123!");
    await page.getByLabel("אישור סיסמה", { exact: true }).fill("Recovery123!");
    await page.getByRole("button", { name: "שמור סיסמה חדשה" }).click();

    await expect.poll(() => updateBodies.length).toBe(1);
    expect(updateBodies[0]).toMatchObject({ password: "Recovery123!" });
    await expect(page.getByText("הסיסמה עודכנה", { exact: true })).toBeVisible();
    await expect(page).not.toHaveURL(/\/auth\?reset=true$/);
  });
});

test.describe("parent password recovery on mobile", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });

  test("remains RTL and usable with reduced motion", async ({ page }) => {
    const updateBodies: unknown[] = [];
    await installRecoverySession(page, updateBodies);
    await page.emulateMedia({ reducedMotion: "reduce" });

    await page.goto("/auth?reset=true", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", { name: "קביעת סיסמה חדשה" }),
    ).toBeVisible();
    await expect(page.locator('html[dir="rtl"]')).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth + 1,
      ),
    ).toBe(true);
  });
});
