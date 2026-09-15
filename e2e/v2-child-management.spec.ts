import { readFileSync } from "node:fs";
import type { Locator, Page, Route, TestInfo } from "@playwright/test";
import { expect, test } from "../playwright-fixture";
import { installSyntheticMaps } from "./synthetic-google-maps";

// Every request below is fulfilled locally. The shared fixture blocks all other
// external traffic; these identifiers, tokens and family members are synthetic.
const USER_ID = "71000000-0000-4000-8000-000000000011";
const FAMILY_ID = "72000000-0000-4000-8000-000000000011";
const CHILD_ID = "73000000-0000-4000-8000-000000000011";
const OTHER_CHILD_ID = "73000000-0000-4000-8000-000000000012";
const NOW_MS = Date.now();
const NOW = new Date(NOW_MS).toISOString();
const EMAIL = "child-management.e2e@example.invalid";
const CHILD_NAME = "ילד בדיקה ראשון";
const OTHER_CHILD_NAME = "ילדת בדיקה שנייה";
const env = new Map(
  readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => [match[1], match[2].replace(/^['"]|['"]$/g, "")]),
);
const configuredURL = env.get("VITE_SUPABASE_URL");
if (!configuredURL) throw new Error("VITE_SUPABASE_URL is required for E2E routing");
const origin = new URL(configuredURL).origin;
const user = {
  id: USER_ID, aud: "authenticated", role: "authenticated", email: EMAIL,
  email_confirmed_at: NOW, phone: "", confirmed_at: NOW, last_sign_in_at: NOW,
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { full_name: "הורה בדיקה" }, identities: [],
  created_at: NOW, updated_at: NOW, is_anonymous: false,
};
const jwtPart = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
const session = {
  access_token: [jwtPart({ alg: "HS256", typ: "JWT" }), jwtPart({
    aud: "authenticated", exp: 4_102_444_800, iat: 1_775_000_000,
    iss: `${origin}/auth/v1`, role: "authenticated", sub: USER_ID, email: EMAIL,
  }), "synthetic-e2e-signature"].join("."),
  token_type: "bearer", expires_in: 2_147_483_647, expires_at: 4_102_444_800,
  refresh_token: "synthetic-e2e-refresh-token", user,
};
const headers = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, prefer, range, x-client-info",
  "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS, HEAD",
  "access-control-expose-headers": "content-range",
  "content-type": "application/json",
};
type Body = Record<string, unknown>;
type Reply = { status: number; json: unknown; gate?: ReturnType<typeof deferred> };
type InstallStatus = "created" | "activated" | "consumed" | "expired" | "cancelled";
type SyntheticInstall = {
  childId: string; id: string; token: string; status: InstallStatus; expiresAt: string;
};

function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}

async function fulfill(route: Route, json: unknown, status = 200) {
  await route.fulfill({ status, headers, json });
}

async function installManagementHarness(page: Page) {
  await installSyntheticMaps(page);
  await page.clock.install({ time: NOW_MS });
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  const children = [
    { id: CHILD_ID, display_name: CHILD_NAME, gender: "male" },
    { id: OTHER_CHILD_ID, display_name: OTHER_CHILD_NAME, gender: "female" },
  ].map((child) => ({ ...child, family_id: FAMILY_ID, birth_year: 2014,
    status: "active", created_at: NOW, updated_at: NOW }));
  const calls = {
    create: [] as Body[], activate: [] as Body[], status: [] as Body[], archive: [] as Body[],
    unexpectedWrites: [] as string[], childReads: [] as string[], protectedDeviceReads: 0,
  };
  const replies = { create: [] as Reply[], activate: [] as Reply[], status: [] as Reply[], archive: [] as Reply[] };
  const holds: {
    create?: ReturnType<typeof deferred>;
    activate?: ReturnType<typeof deferred>;
    childRead?: { childId: string; gate: ReturnType<typeof deferred> };
  } = {};
  const installs: SyntheticInstall[] = [];
  const rows: Record<string, Body[]> = {
    v2_guardian_memberships: [{ guardian_user_id: USER_ID, family_id: FAMILY_ID,
      role: "owner", status: "active", created_at: NOW }],
    v2_guardian_profiles: [{ user_id: USER_ID, display_name: "הורה בדיקה", phone: null }],
    v2_children: children,
    v2_protected_devices: [],
    v2_parental_settings: children.map((child) => ({ child_id: child.id,
      daily_screen_time_limit_minutes: 120, exit_debounce_seconds: 180,
      home_exit_alert_enabled: true, school_exit_alert_enabled: true,
      location_tracking_enabled: true, location_update_interval_minutes: 15,
      lost_mode_enabled: false, lost_mode_message: null, revision: 1,
      created_at: NOW, updated_at: NOW, updated_by: USER_ID })),
  };

  await page.route("**/auth/v1/**", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers }); return;
    }
    await fulfill(route, new URL(route.request().url()).pathname.endsWith("/user") ? user : session);
  });
  await page.route("**/functions/v1/**", async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers }); return;
    }
    const endpoint = new URL(request.url()).pathname.split("/").pop();
    const body = (request.postDataJSON() ?? {}) as Body;
    if (endpoint === "v2-create-child-install") {
      calls.create.push(body);
      const hold = holds.create;
      if (hold) await hold.promise;
      const reply = replies.create.shift();
      if (reply) { await fulfill(route, reply.json, reply.status); return; }
      const sequence = installs.length + 1;
      const install: SyntheticInstall = {
        childId: String(body.child_id),
        id: `77000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
        token: `${"A".repeat(42)}${sequence}`, status: "created",
        expiresAt: new Date(NOW_MS + 20 * 60_000).toISOString(),
      };
      installs.push(install);
      const activationURL = `https://example.invalid/install/${install.token}`;
      await fulfill(route, { install_session_id: install.id, expires_at: install.expiresAt,
        activation_url: activationURL, qr_payload: activationURL });
      return;
    }
    if (endpoint === "v2-activate-child-install") {
      calls.activate.push(body);
      const hold = holds.activate;
      if (hold) await hold.promise;
      const reply = replies.activate.shift();
      if (reply) { await fulfill(route, reply.json, reply.status); return; }
      const install = installs.find((candidate) => candidate.token === body.activation_token);
      if (!install) { await fulfill(route, { error: "invalid_activation_token" }, 400); return; }
      install.status = "activated";
      await fulfill(route, { activated: true, otp_sent: true, otp_delivery: "requested",
        expires_at: install.expiresAt,
        play_store_url: "https://play.google.com/store/apps/details?id=synthetic.never.open" });
      return;
    }
    calls.unexpectedWrites.push(`${request.method()} ${endpoint}`);
    await fulfill(route, { error: "unexpected_synthetic_endpoint" }, 400);
  });
  await page.route("**/rest/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers }); return;
    }
    const endpoint = url.pathname.split("/").pop() ?? "";
    if (endpoint === "v2_get_child_install_session_status") {
      const body = request.postDataJSON() as Body;
      calls.status.push(body);
      const reply = replies.status.shift();
      if (reply) {
        if (reply.gate) await reply.gate.promise;
        await fulfill(route, reply.json, reply.status); return;
      }
      const install = installs.find((candidate) => candidate.id === body.target_session_id);
      await fulfill(route, install ? [{ status: install.status, expires_at: install.expiresAt }] : []);
      return;
    }
    if (endpoint === "v2_archive_guardian_child") {
      const body = request.postDataJSON() as Body;
      calls.archive.push(body);
      const reply = replies.archive.shift();
      if (reply) { await fulfill(route, reply.json, reply.status); return; }
      const child = children.find((candidate) => candidate.id === body.target_child_id);
      if (!child) { await fulfill(route, { code: "42501", message: "forbidden" }, 403); return; }
      child.status = "archived";
      await fulfill(route, [{ child_id: child.id, archived: true }]);
      return;
    }
    if (request.method() !== "GET" && request.method() !== "HEAD") {
      calls.unexpectedWrites.push(`${request.method()} ${endpoint}`);
      await fulfill(route, { code: "unexpected_write" }, 400); return;
    }
    if (endpoint === "v2_protected_devices") calls.protectedDeviceReads += 1;
    if (endpoint === "v2_children" && url.searchParams.get("id")?.startsWith("eq.")) {
      const childId = url.searchParams.get("id")!.slice(3);
      calls.childReads.push(childId);
      const hold = holds.childRead;
      if (hold?.childId === childId) await hold.gate.promise;
    }
    let selected = [...(rows[endpoint] ?? [])];
    for (const [key, condition] of url.searchParams) {
      if (condition.startsWith("eq.")) selected = selected.filter((row) => String(row[key]) === condition.slice(3));
      if (condition.startsWith("neq.")) selected = selected.filter((row) => String(row[key]) !== condition.slice(4));
      if (condition.startsWith("in.(")) {
        const values = condition.slice(4, -1).split(",");
        selected = selected.filter((row) => values.includes(String(row[key])));
      }
    }
    const responseHeaders = { ...headers, "content-profile": "public",
      "content-range": selected.length ? `0-${selected.length - 1}/${selected.length}` : "*/0" };
    if (request.method() === "HEAD") {
      await route.fulfill({ status: 200, headers: responseHeaders }); return;
    }
    const single = (request.headers().accept ?? "").includes("application/vnd.pgrst.object+json");
    await route.fulfill({ status: 200, headers: responseHeaders, json: single ? (selected[0] ?? null) : selected });
  });
  return { calls, replies, holds, installs, runtimeErrors };
}

async function authenticate(page: Page) {
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.getByLabel("אימייל").fill(EMAIL);
  await page.getByLabel("סיסמה").fill("Synthetic123!");
  await page.getByRole("button", { name: "התחבר", exact: true }).click();
  await expect(page).toHaveURL(/\/home-v2$/);
  await expect(page.getByText(CHILD_NAME, { exact: true }).first()).toBeVisible();
}

async function navigateWithinApp(page: Page, path: string) {
  await page.evaluate((path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
}

async function navigateToChild(page: Page, childId = CHILD_ID, name = CHILD_NAME) {
  await navigateWithinApp(page, `/child-v2/${childId}`);
  await expect(page.getByRole("heading", { level: 1, name, exact: true })).toBeVisible();
}

async function openReconnect(page: Page) {
  await page.getByRole("button", { name: "חיבור מחדש", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: /חיבור מחדש/ })).toBeVisible();
  return dialog;
}

function managementDialog(page: Page) {
  return page.locator('[role="dialog"], [role="alertdialog"]');
}

async function assertDialogLayout(page: Page, dialog: Locator, testInfo: TestInfo, name: string) {
  await expect(dialog).toHaveAttribute("dir", "rtl");
  await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Tab");
  await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Shift+Tab");
  await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  const bounds = await dialog.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(-1);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  await testInfo.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
}

test.describe("V2 child management with isolated synthetic traffic", () => {
  test.use({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });

  test("reconnect sends only on explicit action and reuses the session with cooldown and attempt cap", async ({ page }) => {
    const app = await installManagementHarness(page);
    await authenticate(page);
    await navigateToChild(page);
    const dialog = await openReconnect(page);
    await page.clock.fastForward(6_000);
    expect(app.calls.create).toEqual([]);
    expect(app.calls.activate).toEqual([]);
    expect(app.calls.status).toEqual([]);
    await expect(dialog.getByRole("link")).toHaveCount(0);
    await expect(dialog.getByText(/Google Play|סרקו|קוד QR/)).toHaveCount(0);
    await dialog.getByRole("button", { name: "שליחת קוד לאימייל", exact: true }).click();
    const resend = dialog.getByRole("button", { name: "שליחה חוזרת", exact: true });
    await expect(resend).toBeVisible();
    await expect(resend).toBeDisabled();
    expect(app.calls.create).toEqual([{ child_id: CHILD_ID }]);
    expect(app.calls.activate).toEqual([{ activation_token: app.installs[0].token }]);
    for (const expectedAttempts of [2, 3]) {
      await page.clock.fastForward(61_000);
      await expect(resend).toBeEnabled();
      await resend.click();
      await expect.poll(() => app.calls.activate.length).toBe(expectedAttempts);
      await expect(resend).toBeDisabled();
    }
    await page.clock.fastForward(61_000);
    await expect(resend).toBeDisabled();
    expect(app.calls.create).toHaveLength(1);
    expect(new Set(app.calls.activate.map((body) => body.activation_token))).toEqual(new Set([app.installs[0].token]));
    expect(new Set(app.calls.status.map((body) => body.target_session_id))).toEqual(new Set([app.installs[0].id]));
    await expect(page).toHaveURL(new RegExp(`/child-v2/${CHILD_ID}$`));
    expect(app.calls.unexpectedWrites).toEqual([]);
    expect(app.runtimeErrors).toEqual([]);
  });

  test("create and delivery failures do not claim success or create another session on retry", async ({ page }) => {
    const app = await installManagementHarness(page);
    app.replies.create.push({ status: 503, json: { error: "temporarily_unavailable" } });
    app.replies.activate.push({ status: 502, json: { error: "otp_delivery_failed" } });
    await authenticate(page);
    await navigateToChild(page);
    const dialog = await openReconnect(page);
    await dialog.getByRole("button", { name: "שליחת קוד לאימייל", exact: true }).click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    expect(app.calls.activate).toHaveLength(0);
    await expect(dialog.getByText("המכשיר קושר בהצלחה", { exact: true })).toHaveCount(0);
    await dialog.getByRole("button", { name: "שליחת קוד לאימייל", exact: true }).click();
    await expect.poll(() => app.calls.activate.length).toBe(1);
    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(dialog.getByText("המכשיר קושר בהצלחה", { exact: true })).toHaveCount(0);
    await page.clock.fastForward(61_000);
    await dialog.getByRole("button", { name: "שליחה חוזרת", exact: true }).click();
    await expect.poll(() => app.calls.activate.length).toBe(2);
    await expect(dialog.getByRole("button", { name: "שליחה חוזרת", exact: true })).toBeDisabled();
    expect(app.calls.create).toHaveLength(2); // One failed create, one actual session.
    expect(app.installs).toHaveLength(1);
    expect(app.calls.activate[1]).toEqual(app.calls.activate[0]);
    expect(app.runtimeErrors).toEqual([]);
  });

  for (const terminal of ["consumed", "expired"] as const) {
    test(`polling ${terminal} keeps the exact session and stops without automatic issuance`, async ({ page }) => {
      const app = await installManagementHarness(page);
      await authenticate(page);
      await navigateToChild(page);
      const dialog = await openReconnect(page);
      await dialog.getByRole("button", { name: "שליחת קוד לאימייל", exact: true }).click();
      await expect(dialog.getByRole("button", { name: "שליחה חוזרת", exact: true })).toBeVisible();
      const deviceReads = app.calls.protectedDeviceReads;
      app.installs[0].status = terminal;
      await page.clock.fastForward(5_100);
      await expect(dialog.getByText(terminal === "consumed" ? "המכשיר קושר בהצלחה" : /תוקף קוד החיבור פג/).first()).toBeVisible();
      if (terminal === "consumed") {
        await expect.poll(() => app.calls.protectedDeviceReads).toBeGreaterThan(deviceReads);
        await expect(dialog.getByText("הגנה פעילה", { exact: true })).toHaveCount(0);
      }
      const pollCount = app.calls.status.length;
      await page.clock.fastForward(20_000);
      expect(app.calls.status).toHaveLength(pollCount);
      expect(app.calls.create).toEqual([{ child_id: CHILD_ID }]);
      expect(app.calls.activate).toHaveLength(1);
      expect(new Set(app.calls.status.map((body) => body.target_session_id))).toEqual(new Set([app.installs[0].id]));
      expect(app.runtimeErrors).toEqual([]);
    });
  }

  test("a recent delivery reservation is shown truthfully without a new delivery claim", async ({ page }) => {
    const app = await installManagementHarness(page);
    app.replies.activate.push({ status: 200, json: {
      activated: true, otp_sent: false, otp_delivery: "recent_request_exists",
      expires_at: new Date(NOW_MS + 20 * 60_000).toISOString(),
      play_store_url: "https://play.google.com/store/apps/details?id=synthetic.never.open",
    } });
    await authenticate(page);
    await navigateToChild(page);
    const dialog = await openReconnect(page);
    await dialog.getByRole("button", { name: "שליחת קוד לאימייל", exact: true }).click();
    await expect(dialog.getByText(/לא נשלח קוד נוסף/)).toBeVisible();
    await expect(dialog.getByText(/בקשת שליחת הקוד לאימייל אושרה/)).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "שליחה חוזרת", exact: true })).toBeDisabled();
    expect(app.calls.create).toHaveLength(1);
    expect(app.calls.activate).toHaveLength(1);
    await expect(page).toHaveURL(new RegExp(`/child-v2/${CHILD_ID}$`));
    expect(app.runtimeErrors).toEqual([]);
  });

  test("a status failure retries only status when explicitly requested, without resending email", async ({ page }) => {
    const app = await installManagementHarness(page);
    app.replies.status.push({ status: 503, json: { code: "unavailable", message: "Unavailable" } });
    await authenticate(page);
    await navigateToChild(page);
    const dialog = await openReconnect(page);
    await dialog.getByRole("button", { name: "שליחת קוד לאימייל", exact: true }).click();
    const check = dialog.getByRole("button", { name: "בדיקת מצב החיבור", exact: true });
    await expect(check).toBeEnabled();
    const failedCount = app.calls.status.length;
    await page.clock.fastForward(20_000);
    expect(app.calls.status).toHaveLength(failedCount);
    await check.click();
    await expect(check).toBeHidden();
    await expect.poll(() => app.calls.status.length).toBe(failedCount + 1);
    expect(app.calls.create).toHaveLength(1);
    expect(app.calls.activate).toHaveLength(1);
    expect(new Set(app.calls.status.map((body) => body.target_session_id))).toEqual(new Set([app.installs[0].id]));
    expect(app.runtimeErrors).toEqual([]);
  });

  test("closing during create prevents a late response from sending an email", async ({ page }) => {
    const app = await installManagementHarness(page);
    const held = deferred();
    app.holds.create = held;
    await authenticate(page);
    await navigateToChild(page);
    const dialog = await openReconnect(page);
    await dialog.getByRole("button", { name: "שליחת קוד לאימייל", exact: true }).click();
    await expect.poll(() => app.calls.create.length).toBe(1);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    held.release();
    await expect.poll(() => app.installs.length).toBe(1);
    await page.waitForLoadState("networkidle");
    await page.clock.fastForward(6_000);
    expect(app.calls.activate).toEqual([]);
    expect(app.calls.status).toEqual([]);
    expect(app.runtimeErrors).toEqual([]);
  });

  test("a late activation for the first child cannot affect the second child's dialog", async ({ page }) => {
    const app = await installManagementHarness(page);
    const held = deferred();
    app.holds.activate = held;
    await authenticate(page);
    await navigateToChild(page);
    let dialog = await openReconnect(page);
    await dialog.getByRole("button", { name: "שליחת קוד לאימייל", exact: true }).click();
    await expect.poll(() => app.calls.activate.length).toBe(1);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await navigateToChild(page, OTHER_CHILD_ID, OTHER_CHILD_NAME);
    dialog = await openReconnect(page);
    held.release();
    await page.waitForLoadState("networkidle");
    await expect(dialog.getByRole("heading", { name: new RegExp(OTHER_CHILD_NAME) })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "שליחת קוד לאימייל", exact: true })).toBeEnabled();
    await expect(dialog.getByText("המכשיר קושר בהצלחה", { exact: true })).toHaveCount(0);
    expect(app.calls.create).toEqual([{ child_id: CHILD_ID }]);
    delete app.holds.activate;
    await dialog.getByRole("button", { name: "שליחת קוד לאימייל", exact: true }).click();
    await expect.poll(() => app.calls.activate.length).toBe(2);
    expect(app.calls.create).toEqual([{ child_id: CHILD_ID }, { child_id: OTHER_CHILD_ID }]);
    expect(app.calls.activate[1]).toEqual({ activation_token: app.installs[1].token });
    expect(app.calls.activate[1]).not.toEqual(app.calls.activate[0]);
    expect(app.runtimeErrors).toEqual([]);
  });

  test("leaving and returning to a child keeps the same account's session and resend cooldown", async ({ page }) => {
    const app = await installManagementHarness(page);
    await authenticate(page);
    await navigateToChild(page);
    let dialog = await openReconnect(page);
    await dialog.getByRole("button", { name: "שליחת קוד לאימייל", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "שליחה חוזרת", exact: true })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await navigateWithinApp(page, "/home-v2");
    await expect(page.getByText(CHILD_NAME, { exact: true }).first()).toBeVisible();
    await navigateToChild(page);
    dialog = await openReconnect(page);
    const resend = dialog.getByRole("button", { name: "שליחה חוזרת", exact: true });
    await expect(resend).toBeDisabled();
    expect(app.calls.create).toEqual([{ child_id: CHILD_ID }]);
    expect(app.calls.activate).toHaveLength(1);
    await page.clock.fastForward(61_000);
    await expect(resend).toBeEnabled();
    await resend.click();
    await expect(resend).toBeDisabled();
    expect(app.calls.create).toHaveLength(1);
    expect(app.calls.activate).toEqual([
      { activation_token: app.installs[0].token }, { activation_token: app.installs[0].token },
    ]);
    expect(new Set(app.calls.status.map((body) => body.target_session_id))).toEqual(new Set([app.installs[0].id]));
    expect(app.runtimeErrors).toEqual([]);
  });

  test("a late activated poll cannot regress a consumed session after closing and reopening", async ({ page }) => {
    const app = await installManagementHarness(page);
    const oldPoll = deferred();
    app.replies.status.push({ status: 200, gate: oldPoll, json: [{
      status: "activated", expires_at: new Date(NOW_MS + 20 * 60_000).toISOString(),
    }] });
    await authenticate(page);
    await navigateToChild(page);
    let dialog = await openReconnect(page);
    try {
      await dialog.getByRole("button", { name: "שליחת קוד לאימייל", exact: true }).click();
      await expect.poll(() => app.calls.status.length).toBe(1);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      app.installs[0].status = "consumed";
      dialog = await openReconnect(page);
      await expect(dialog.getByText("המכשיר קושר בהצלחה", { exact: true })).toBeVisible();
      const pollsAtCompletion = app.calls.status.length;
      oldPoll.release();
      await page.waitForLoadState("networkidle");
      await page.clock.fastForward(6_000);
      await expect(dialog.getByText("המכשיר קושר בהצלחה", { exact: true })).toBeVisible();
      await expect(dialog.getByRole("button", { name: "שליחה חוזרת", exact: true })).toHaveCount(0);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      dialog = await openReconnect(page);
      await expect(dialog.getByText("המכשיר קושר בהצלחה", { exact: true })).toBeVisible();
      expect(app.calls.status).toHaveLength(pollsAtCompletion);
      expect(app.calls.create).toHaveLength(1);
      expect(app.calls.activate).toHaveLength(1);
      expect(app.runtimeErrors).toEqual([]);
    } finally {
      oldPoll.release();
    }
  });

  test("a stale initial child response cannot display or remove the previous child after a route switch", async ({ page }) => {
    const app = await installManagementHarness(page);
    await authenticate(page);
    const oldChild = deferred();
    app.holds.childRead = { childId: CHILD_ID, gate: oldChild };
    try {
      await navigateWithinApp(page, `/child-v2/${CHILD_ID}`);
      await expect.poll(() => app.calls.childReads.includes(CHILD_ID)).toBe(true);
      await expect(page.getByRole("button", { name: "הסרת ילד", exact: true })).toHaveCount(0);
      await navigateToChild(page, OTHER_CHILD_ID, OTHER_CHILD_NAME);
      oldChild.release();
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("heading", { level: 1, name: OTHER_CHILD_NAME, exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { level: 1, name: CHILD_NAME, exact: true })).toHaveCount(0);
      await page.getByRole("button", { name: "הסרת ילד", exact: true }).click();
      const dialog = page.getByRole("alertdialog");
      await expect(dialog.getByRole("heading", { name: `הסרת ${OTHER_CHILD_NAME} מהמשפחה`, exact: true })).toBeVisible();
      await dialog.getByRole("button", { name: "המשך לאישור", exact: true }).click();
      expect(app.calls.archive).toEqual([]);
      await dialog.getByRole("button", { name: `כן, להסיר את ${OTHER_CHILD_NAME}`, exact: true }).click();
      await expect(page).toHaveURL(/\/home-v2$/);
      expect(app.calls.archive).toEqual([{ target_child_id: OTHER_CHILD_ID,
        target_request_key: expect.stringMatching(/\S+/) }]);
      await expect(page.getByText(CHILD_NAME, { exact: true }).first()).toBeVisible();
      await expect(page.getByText(OTHER_CHILD_NAME, { exact: true })).toHaveCount(0);
      expect(app.runtimeErrors).toEqual([]);
    } finally {
      oldChild.release();
    }
  });

  test("stalled create and activation time out without permanently blocking explicit retry", async ({ page }) => {
    const app = await installManagementHarness(page);
    const stalledCreate = deferred();
    const stalledActivation = deferred();
    app.holds.create = stalledCreate;
    app.holds.activate = stalledActivation;
    await authenticate(page);
    await navigateToChild(page);
    const dialog = await openReconnect(page);
    try {
      const send = dialog.getByRole("button", { name: "שליחת קוד לאימייל", exact: true });
      await send.click();
      await expect.poll(() => app.calls.create.length).toBe(1);
      await page.clock.fastForward(30_100);
      await expect(dialog.getByRole("alert")).toBeVisible();
      await expect(send).toBeEnabled();
      expect(app.calls.activate).toHaveLength(0);
      delete app.holds.create;
      await send.click();
      await expect.poll(() => app.calls.activate.length).toBe(1);
      await page.clock.fastForward(30_100);
      await expect(dialog.getByRole("alert")).toBeVisible();
      await expect(dialog.getByText("המכשיר קושר בהצלחה", { exact: true })).toHaveCount(0);
      expect(app.calls.create).toHaveLength(2);
      expect(app.calls.activate).toHaveLength(1);
      delete app.holds.activate;
      await page.clock.fastForward(31_000);
      const resend = dialog.getByRole("button", { name: "שליחה חוזרת", exact: true });
      await expect(resend).toBeEnabled();
      await resend.click();
      await expect(dialog.getByText(/בקשת שליחת הקוד לאימייל אושרה/)).toBeVisible();
      await expect(resend).toBeDisabled();
      expect(app.calls.create).toHaveLength(2);
      expect(app.calls.activate).toHaveLength(2);
      expect(app.calls.activate[1]).toEqual(app.calls.activate[0]);
      expect(app.runtimeErrors).toEqual([]);
    } finally {
      stalledCreate.release();
      stalledActivation.release();
    }
  });

  test("remove cancel is inert; failed submission retains the child and retries with one request key", async ({ page }, testInfo) => {
    const app = await installManagementHarness(page);
    app.replies.archive.push({ status: 503, json: { code: "temporary_failure", message: "Temporary failure" } });
    await authenticate(page);
    await navigateToChild(page);
    const remove = page.getByRole("button", { name: "הסרת ילד", exact: true });
    await remove.click();
    let dialog = managementDialog(page);
    await expect(dialog.getByRole("button", { name: "המשך לאישור", exact: true })).toBeVisible();
    expect(app.calls.archive).toEqual([]);
    await dialog.getByRole("button", { name: "ביטול", exact: true }).click();
    await expect(dialog).toBeHidden();
    expect(app.calls.archive).toEqual([]);
    await remove.click();
    dialog = managementDialog(page);
    await dialog.getByRole("button", { name: "המשך לאישור", exact: true }).click();
    expect(app.calls.archive).toEqual([]);
    await dialog.getByRole("button", { name: `כן, להסיר את ${CHILD_NAME}`, exact: true }).click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/child-v2/${CHILD_ID}$`));
    await expect(dialog).toContainText(CHILD_NAME);
    expect(app.calls.archive).toHaveLength(1);
    expect(app.calls.archive[0]).toEqual({ target_child_id: CHILD_ID,
      target_request_key: expect.stringMatching(/\S+/) });
    await testInfo.attach("remove-child-retry-desktop-rtl", {
      body: await page.screenshot({ fullPage: true }), contentType: "image/png",
    });
    await dialog.getByRole("button", { name: `כן, להסיר את ${CHILD_NAME}`, exact: true }).click();
    await expect(page).toHaveURL(/\/home-v2$/);
    expect(app.calls.archive).toHaveLength(2);
    expect(app.calls.archive[1]).toEqual(app.calls.archive[0]);
    await expect(page.getByText(CHILD_NAME, { exact: true })).toHaveCount(0);
    await expect(page.getByText(OTHER_CHILD_NAME, { exact: true }).first()).toBeVisible();
    expect(app.calls.create).toEqual([]);
    expect(app.calls.unexpectedWrites).toEqual([]);
    expect(app.runtimeErrors).toEqual([]);
  });

  test("removal requires an authoritative response for exactly the selected child", async ({ page }) => {
    const app = await installManagementHarness(page);
    app.replies.archive.push(
      { status: 200, json: [{ child_id: OTHER_CHILD_ID, archived: true }] },
      { status: 200, json: [{ child_id: CHILD_ID, archived: false }] },
    );
    await authenticate(page);
    await navigateToChild(page);
    await page.getByRole("button", { name: "הסרת ילד", exact: true }).click();
    const dialog = managementDialog(page);
    await dialog.getByRole("button", { name: "המשך לאישור", exact: true }).click();
    expect(app.calls.archive).toEqual([]);
    for (const attempts of [1, 2]) {
      await dialog.getByRole("button", { name: `כן, להסיר את ${CHILD_NAME}`, exact: true }).click();
      await expect.poll(() => app.calls.archive.length).toBe(attempts);
      await expect(dialog.getByRole("alert")).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`/child-v2/${CHILD_ID}$`));
      await expect(dialog).toContainText(CHILD_NAME);
    }
    expect(app.calls.archive[1]).toEqual(app.calls.archive[0]);
    await dialog.getByRole("button", { name: "חזרה", exact: true }).click();
    await dialog.getByRole("button", { name: "ביטול", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: CHILD_NAME, exact: true })).toBeVisible();
    await expect(page.getByText("הילד הוסר מהמשפחה", { exact: true })).toHaveCount(0);
    expect(app.runtimeErrors).toEqual([]);
  });
});

for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  test.describe(`Child management dialogs at ${viewport.width}px`, () => {
    test.use({ viewport, reducedMotion: "reduce" });
    test("are RTL, keyboard accessible and contained in the viewport", async ({ page }, testInfo) => {
      const app = await installManagementHarness(page);
      await authenticate(page);
      await navigateToChild(page);
      const trigger = page.getByRole("button", { name: "חיבור מחדש", exact: true });
      await trigger.focus();
      await page.keyboard.press("Enter");
      let dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await assertDialogLayout(page, dialog, testInfo, `reconnect-${viewport.width}-rtl-reduced-motion`);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();
      const remove = page.getByRole("button", { name: "הסרת ילד", exact: true });
      await remove.focus();
      await page.keyboard.press("Enter");
      dialog = managementDialog(page);
      await expect(dialog).toBeVisible();
      await assertDialogLayout(page, dialog, testInfo, `remove-${viewport.width}-rtl-reduced-motion`);
      await dialog.getByRole("button", { name: "המשך לאישור", exact: true }).click();
      await expect(dialog.getByRole("heading", { name: `אישור סופי להסרת ${CHILD_NAME}`, exact: true })).toBeVisible();
      await assertDialogLayout(page, dialog, testInfo, `remove-final-${viewport.width}-rtl-reduced-motion`);
      expect(app.calls.archive).toEqual([]);
      await dialog.getByRole("button", { name: "חזרה", exact: true }).click();
      await dialog.getByRole("button", { name: "ביטול", exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect(remove).toBeFocused();
      expect(app.calls.create).toEqual([]);
      expect(app.calls.activate).toEqual([]);
      expect(app.calls.archive).toEqual([]);
      expect(app.runtimeErrors).toEqual([]);
    });
  });
}
