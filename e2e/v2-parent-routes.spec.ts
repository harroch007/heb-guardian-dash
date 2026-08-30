import { readFileSync } from "node:fs";
import type { Page, Route } from "@playwright/test";
import { expect, test } from "../playwright-fixture";

const USER_ID = "71000000-0000-4000-8000-000000000001";
const FAMILY_ID = "72000000-0000-4000-8000-000000000001";
const CHILD_ID = "73000000-0000-4000-8000-000000000001";
const DEVICE_ID = "74000000-0000-4000-8000-000000000001";
const INCIDENT_ID = "75000000-0000-4000-8000-000000000001";
const NOW_MS = Date.now();
const NOW = new Date(NOW_MS).toISOString();
const LATE_AFTER = new Date(NOW_MS + 15 * 60_000).toISOString();
const INTERRUPTED_AFTER = new Date(NOW_MS + 45 * 60_000).toISOString();

const env = new Map(
  readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => [match[1], match[2].replace(/^['"]|['"]$/g, "")]),
);

const supabaseURL = env.get("VITE_SUPABASE_URL");
if (!supabaseURL) throw new Error("VITE_SUPABASE_URL is required for E2E routing");

const supabaseOrigin = new URL(supabaseURL).origin;

const user = {
  id: USER_ID,
  aud: "authenticated",
  role: "authenticated",
  email: "parent.e2e@example.invalid",
  email_confirmed_at: NOW,
  phone: "",
  confirmed_at: NOW,
  last_sign_in_at: NOW,
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { full_name: "הורה בדיקה" },
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
    iss: `${supabaseOrigin}/auth/v1`,
    role: "authenticated",
    sub: USER_ID,
    email: user.email,
  }),
  "synthetic-e2e-signature",
].join(".");

const session = {
  access_token: accessToken,
  token_type: "bearer",
  expires_in: 2_147_483_647,
  expires_at: 4_102_444_800,
  refresh_token: "synthetic-e2e-refresh-token",
  user,
};

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers":
    "authorization, apikey, content-type, prefer, range, x-client-info",
  "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS, HEAD",
  "access-control-expose-headers": "content-range",
};

const child = {
  id: CHILD_ID,
  family_id: FAMILY_ID,
  display_name: "ילד בדיקה",
  gender: "male",
  birth_year: 2014,
  status: "active",
  created_at: NOW,
  updated_at: NOW,
};

const device = {
  id: DEVICE_ID,
  child_id: CHILD_ID,
  installation_id: "synthetic-installation",
  app_version: "2.0.0-alpha.2",
  capture_contract_version: 2,
  platform: "android",
  manufacturer: "Kippy Lab",
  model: "Synthetic Device",
  status: "active",
  registered_at: NOW,
  last_seen_at: NOW,
  created_at: NOW,
  updated_at: NOW,
};

const incident = {
  id: INCIDENT_ID,
  child_id: CHILD_ID,
  device_id: DEVICE_ID,
  client_incident_id: "synthetic-incident",
  category: "bullying",
  severity: "high",
  child_role: "target",
  confidence: 0.94,
  capture_quality: 0.99,
  source_platform: "whatsapp",
  model_contract_version: 2,
  privacy_contract_version: 3,
  status: "confirmed",
  occurred_at: NOW,
  received_at: NOW,
};

const rowsByTable: Record<string, object[]> = {
  v2_guardian_memberships: [
    {
      guardian_user_id: USER_ID,
      family_id: FAMILY_ID,
      role: "owner",
      status: "active",
      created_at: NOW,
    },
  ],
  v2_guardian_profiles: [
    { user_id: USER_ID, display_name: "הורה בדיקה", phone: null },
  ],
  v2_children: [child],
  v2_protected_devices: [device],
  v2_parental_settings: [
    {
      child_id: CHILD_ID,
      daily_screen_time_limit_minutes: 120,
      exit_debounce_seconds: 180,
      home_exit_alert_enabled: true,
      school_exit_alert_enabled: true,
      location_tracking_enabled: true,
      location_update_interval_minutes: 15,
      lost_mode_enabled: false,
      lost_mode_message: null,
      revision: 3,
      created_at: NOW,
      updated_at: NOW,
      updated_by: USER_ID,
    },
  ],
  v2_parental_bonus_grants: [],
  v2_parental_schedules: [],
  v2_parental_places: [],
  v2_parental_geofence_events: [],
  v2_parental_app_policies: [],
  v2_parental_app_usage_daily: [
    {
      device_id: DEVICE_ID,
      usage_date: "2026-07-31",
      app_name: "WhatsApp",
      package_name: "com.whatsapp",
      usage_minutes: 17,
    },
  ],
  v2_parental_device_state: [
    {
      device_id: DEVICE_ID,
      event_key: "synthetic-state",
      latitude: 32.166,
      longitude: 34.82,
      location_accuracy_meters: 10,
      location_address: "כתובת בדיקה",
      location_observed_at: NOW,
      observed_at: NOW,
      received_at: NOW,
      settings_revision_applied: 3,
      total_screen_minutes: 42,
      usage_date: "2026-07-31",
      updated_at: NOW,
    },
  ],
  v2_device_health_events: [
    {
      id: "76000000-0000-4000-8000-000000000001",
      device_id: DEVICE_ID,
      event_key: "synthetic-health",
      accessibility_enabled: true,
      notification_listener_enabled: true,
      battery_optimization_exempt: true,
      capture_ready: true,
      product_ready: true,
      battery_level_percent: 78,
      capabilities: {
        app_notifications_allowed: {
          state: "satisfied",
          requiredForCapture: false,
          requiredForProduct: true,
        },
      },
      degraded_reasons: [],
      affects_current_state: true,
      contract_version: 2,
      expected_interval_seconds: 900,
      observed_at: NOW,
      received_at: NOW,
      report_reason: "periodic",
      oem_autostart_state: "enabled",
      app_version: "2.0.0-alpha.2",
      boot_session_id: "synthetic-boot",
      payload_hash: null,
      sequence_no: 1,
    },
  ],
  v2_device_monitoring_state: [
    {
      device_id: DEVICE_ID,
      monitoring_state: "protected",
      reason_codes: [],
      expected_interval_seconds: 900,
      healthy_streak: 3,
      last_event_key: "synthetic-health",
      last_health_event_id: "76000000-0000-4000-8000-000000000001",
      last_observed_at: NOW,
      last_received_at: NOW,
      last_sequence_no: 1,
      last_boot_session_id: "synthetic-boot",
      late_after_at: LATE_AFTER,
      interrupted_after_at: INTERRUPTED_AFTER,
      interruption_started_at: null,
      episode_id: null,
      state_version: 1,
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  v2_safety_incidents: [incident],
  v2_incident_analysis: [
    {
      incident_id: INCIDENT_ID,
      outcome: "confirmed",
      action_code: "professional_support",
      reason_code: "bullying_pattern",
      safe_summary: "זוהתה שיחה שעשויה לדרוש תשומת לב הורית.",
      safe_reason: "ההודעה נשלחה ישירות לילד ובהקשר חוזר.",
      recommended_action: "מומלץ לפתוח בשיחה רגועה וללא האשמה.",
      analysis_contract_version: 3,
      model_name: "synthetic-e2e",
      model_provider: "local-test",
      model_version: "1",
      prompt_version: "synthetic",
      analyzed_at: NOW,
      created_at: NOW,
    },
  ],
  v2_guardian_incident_states: [],
  v2_push_subscriptions: [],
  v2_alert_deliveries: [],
};

async function fulfillPostgrest(
  route: Route,
  rowSource: Record<string, object[]> = rowsByTable,
) {
  const request = route.request();
  const url = new URL(request.url());
  const table = decodeURIComponent(url.pathname.split("/").pop() ?? "");
  const rows = rowSource[table] ?? [];
  const headers = {
    ...corsHeaders,
    "content-profile": "public",
    "content-type": "application/json",
    "content-range": rows.length > 0 ? `0-${rows.length - 1}/${rows.length}` : "*/0",
  };

  if (request.method() === "OPTIONS") {
    await route.fulfill({ status: 204, headers });
    return;
  }

  if (request.method() === "HEAD") {
    await route.fulfill({ status: 200, headers });
    return;
  }

  if (table === "rpc") {
    await route.fulfill({ status: 200, headers, json: [] });
    return;
  }

  const wantsObject = (request.headers().accept ?? "").includes(
    "application/vnd.pgrst.object+json",
  );
  await route.fulfill({
    status: 200,
    headers,
    json: wantsObject ? (rows[0] ?? null) : rows,
  });
}

async function installSyntheticV2Session(page: Page) {
  await page.route("**/auth/v1/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: {
        ...corsHeaders,
        "content-type": "application/json",
      },
      json: pathname.endsWith("/user") ? user : session,
    });
  });
  await page.route("**/rest/v1/**", (route) => fulfillPostgrest(route));
  await page.route("**/functions/v1/**", (route) =>
    route.fulfill({
      status: route.request().method() === "OPTIONS" ? 204 : 200,
      headers: {
        ...corsHeaders,
        "content-type": "application/json",
      },
      ...(route.request().method() === "OPTIONS" ? {} : { json: {} }),
    }),
  );
}

async function installSyntheticNewGuardianSession(page: Page) {
  let guardianCreated = false;
  let childCreated = false;
  const bootstrapBodies: Record<string, unknown>[] = [];
  const childBodies: Record<string, unknown>[] = [];
  const installBodies: Record<string, unknown>[] = [];

  await page.route("**/auth/v1/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" },
      json: pathname.endsWith("/user") ? user : session,
    });
  });

  await page.route("**/rest/v1/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    if (pathname.endsWith("/rpc/v2_bootstrap_guardian")) {
      const body = request.postDataJSON() as Record<string, unknown>;
      bootstrapBodies.push(body);
      guardianCreated = true;
      await route.fulfill({
        status: 200,
        headers: { ...corsHeaders, "content-type": "application/json" },
        json: [{ family_id: FAMILY_ID, created: true }],
      });
      return;
    }

    if (pathname.endsWith("/rpc/v2_create_guardian_child")) {
      const body = request.postDataJSON() as Record<string, unknown>;
      childBodies.push(body);
      childCreated = true;
      await route.fulfill({
        status: 200,
        headers: { ...corsHeaders, "content-type": "application/json" },
        json: [{ child_id: CHILD_ID, created: true }],
      });
      return;
    }

    const dynamicRows: Record<string, object[]> = {
      ...rowsByTable,
      v2_guardian_memberships: guardianCreated
        ? rowsByTable.v2_guardian_memberships
        : [],
      v2_guardian_profiles: guardianCreated
        ? rowsByTable.v2_guardian_profiles
        : [],
      v2_children: childCreated ? [child] : [],
      v2_protected_devices: [],
      v2_device_health_events: [],
      v2_device_monitoring_state: [],
      v2_safety_incidents: [],
      v2_incident_analysis: [],
    };
    await fulfillPostgrest(route, dynamicRows);
  });

  await page.route("**/functions/v1/**", async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith("/v2-create-child-install")) {
      installBodies.push(request.postDataJSON() as Record<string, unknown>);
      await route.fulfill({
        status: 200,
        headers: { ...corsHeaders, "content-type": "application/json" },
        json: {
          install_session_id: "77000000-0000-4000-8000-000000000002",
          expires_at: new Date(NOW_MS + 20 * 60_000).toISOString(),
          activation_url: "https://example.invalid/install/first-child",
          qr_payload: "https://example.invalid/install/first-child",
        },
      });
      return;
    }

    await route.fulfill({
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" },
      json: {},
    });
  });

  return { bootstrapBodies, childBodies, installBodies };
}

async function installSyntheticIncompleteGuardianSession(page: Page) {
  let profileCreated = false;
  const bootstrapBodies: Record<string, unknown>[] = [];
  const bootstrapResults: Array<{ family_id: string; created: boolean }> = [];
  const childBodies: Record<string, unknown>[] = [];

  await page.route("**/auth/v1/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" },
      json: pathname.endsWith("/user") ? user : session,
    });
  });

  await page.route("**/rest/v1/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    if (pathname.endsWith("/rpc/v2_bootstrap_guardian")) {
      bootstrapBodies.push(request.postDataJSON() as Record<string, unknown>);
      profileCreated = true;
      const result = { family_id: FAMILY_ID, created: false };
      bootstrapResults.push(result);
      await route.fulfill({
        status: 200,
        headers: { ...corsHeaders, "content-type": "application/json" },
        json: [result],
      });
      return;
    }

    if (pathname.endsWith("/rpc/v2_create_guardian_child")) {
      childBodies.push(request.postDataJSON() as Record<string, unknown>);
      await route.fulfill({
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
        json: { message: "existing_family_must_not_create_child" },
      });
      return;
    }

    await fulfillPostgrest(route, {
      ...rowsByTable,
      v2_guardian_profiles: profileCreated
        ? rowsByTable.v2_guardian_profiles
        : [],
    });
  });

  await page.route("**/functions/v1/**", async (route) => {
    await route.fulfill({
      status: route.request().method() === "OPTIONS" ? 204 : 200,
      headers: { ...corsHeaders, "content-type": "application/json" },
      ...(route.request().method() === "OPTIONS" ? {} : { json: {} }),
    });
  });

  return { bootstrapBodies, bootstrapResults, childBodies };
}

async function authenticateSyntheticParent(page: Page) {
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.getByLabel("אימייל").fill(user.email);
  await page.getByLabel("סיסמה").fill("Synthetic123!");
  await page.getByRole("button", { name: "התחבר", exact: true }).click();
  await expect(page).toHaveURL(/\/home-v2$/);
  await expect(page.getByText("ילד בדיקה", { exact: true }).first()).toBeVisible();
  await page.waitForLoadState("networkidle");
}

async function navigateWithinParentApp(page: Page, path: string) {
  if (new URL(page.url()).pathname === path) return;
  await page.evaluate((nextPath) => {
    window.history.pushState({}, "", nextPath);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
  await expect(page).toHaveURL(new RegExp(`${path.replaceAll("/", "\\/")}$`));
}

const privateRoutes = [
  {
    path: "/home-v2",
    visible: (page: Page) => page.getByText("ילד בדיקה", { exact: true }).first(),
  },
  {
    path: `/child-v2/${CHILD_ID}`,
    visible: (page: Page) =>
      page.getByRole("heading", { level: 1, name: "ילד בדיקה" }),
  },
  {
    path: "/alerts-v2",
    visible: (page: Page) =>
      page.getByRole("heading", { level: 1, name: "התראות בטיחות" }),
  },
  {
    path: "/family-v2",
    visible: (page: Page) =>
      page.getByText(child.display_name, { exact: true }).first(),
  },
  {
    path: "/settings-v2",
    visible: (page: Page) =>
      page.getByRole("heading", { level: 1, name: "הגדרות" }),
  },
];

test.describe("V2 private parent routes", () => {
  test.beforeEach(async ({ page }) => {
    await installSyntheticV2Session(page);
    await authenticateSyntheticParent(page);
  });

  test("render in Hebrew RTL with isolated synthetic data", async ({ page }, testInfo) => {
    const runtimeErrors: string[] = [];
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        !message.text().includes("ERR_BLOCKED_BY_CLIENT")
      ) {
        runtimeErrors.push(message.text());
      }
    });

    for (const route of privateRoutes) {
      await test.step(route.path, async () => {
        await navigateWithinParentApp(page, route.path);
        await expect(page).toHaveURL(new RegExp(`${route.path.replaceAll("/", "\\/")}$`));
        await expect(page.locator('[dir="rtl"]').first()).toBeVisible();
        await expect(route.visible(page)).toBeVisible();
        await page.waitForLoadState("networkidle");
        expect(
          await page.evaluate(
            () =>
              document.documentElement.scrollWidth <=
              document.documentElement.clientWidth + 1,
          ),
        ).toBe(true);
      });
    }

    expect(runtimeErrors).toEqual([]);
    await testInfo.attach("v2-parent-settings-desktop-rtl", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
  });

  test("does not present a heartbeat_late device as connected", async ({ page }, testInfo) => {
    const monitoringState = rowsByTable.v2_device_monitoring_state[0] as {
      monitoring_state: string;
    };
    const originalState = monitoringState.monitoring_state;
    monitoringState.monitoring_state = "heartbeat_late";

    try {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(
        page.getByText("המכשיר לא מחובר — ייתכן שהשליטה אינה פעילה", {
          exact: true,
        }),
      ).toBeVisible();
      const screenshot = await page.screenshot({
        fullPage: true,
        path: testInfo.outputPath("home-heartbeat-late.png"),
      });
      await testInfo.attach("home-heartbeat-late-desktop-rtl", {
        body: screenshot,
        contentType: "image/png",
      });
    } finally {
      monitoringState.monitoring_state = originalState;
    }
  });

  test("keeps a freshly reporting degraded device connected", async ({ page }) => {
    const monitoringState = rowsByTable.v2_device_monitoring_state[0] as {
      monitoring_state: string;
    };
    const health = rowsByTable.v2_device_health_events[0] as {
      product_ready: boolean;
      degraded_reasons: string[];
    };
    const originalState = monitoringState.monitoring_state;
    const originalProductReady = health.product_ready;
    const originalReasons = health.degraded_reasons;
    monitoringState.monitoring_state = "degraded";
    health.product_ready = false;
    health.degraded_reasons = ["app_notifications_allowed"];

    try {
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(
        page.getByText("המכשיר לא מחובר — ייתכן שהשליטה אינה פעילה", {
          exact: true,
        }),
      ).toHaveCount(0);
      await expect(
        page.getByText(
          "ניטור WhatsApp פעיל — יכולת נוספת במכשיר דורשת בדיקה",
          { exact: true },
        ),
      ).toBeVisible();
      await expect(page.getByText("1/1", { exact: true }).first()).toBeVisible();
    } finally {
      monitoringState.monitoring_state = originalState;
      health.product_ready = originalProductReady;
      health.degraded_reasons = originalReasons;
    }
  });

  test("never renders fake family counts after a settings query failure", async ({
    page,
  }) => {
    let failChildrenCount = true;
    await page.route("**/rest/v1/v2_children*", async (route) => {
      if (route.request().method() === "HEAD" && failChildrenCount) {
        await route.fulfill({
          status: 500,
          headers: { ...corsHeaders, "content-type": "application/json" },
        });
        return;
      }
      await fulfillPostgrest(route);
    });

    await navigateWithinParentApp(page, "/settings-v2");

    await expect(
      page.getByRole("heading", {
        name: "לא ניתן לטעון את הגדרות החשבון",
      }),
    ).toBeVisible();
    await expect(
      page.getByText("0 ילדים · 0 הורים", { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText("הורה שותף", { exact: true })).toHaveCount(0);

    failChildrenCount = false;
    await page.getByRole("button", { name: "נסה שוב", exact: true }).click();

    await expect(
      page.getByText("1 ילדים · 1 הורים", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("הורה ראשי", { exact: true })).toBeVisible();
  });

  test("keeps a reconnect QR open until its exact install session is consumed", async ({ page }) => {
    const installSessionId = "77000000-0000-4000-8000-000000000001";
    const expiresAt = "2030-07-31T13:00:00.000Z";
    const requestedSessionIds: string[] = [];
    let installStatus = "created";
    let protectedDeviceReads = 0;

    page.on("request", (request) => {
      const pathname = new URL(request.url()).pathname;
      if (
        request.method() === "GET" &&
        pathname.endsWith("/rest/v1/v2_protected_devices")
      ) {
        protectedDeviceReads += 1;
      }
    });

    await page.route("**/functions/v1/v2-create-child-install", async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }
      await route.fulfill({
        status: 200,
        headers: { ...corsHeaders, "content-type": "application/json" },
        json: {
          install_session_id: installSessionId,
          expires_at: expiresAt,
          activation_url: "https://example.invalid/install/synthetic",
          qr_payload: "https://example.invalid/install/synthetic",
        },
      });
    });
    await page.route(
      "**/rest/v1/rpc/v2_get_child_install_session_status",
      async (route) => {
        if (route.request().method() === "OPTIONS") {
          await route.fulfill({ status: 204, headers: corsHeaders });
          return;
        }
        const body = route.request().postDataJSON() as {
          target_session_id?: string;
        };
        requestedSessionIds.push(body.target_session_id ?? "");
        await route.fulfill({
          status: 200,
          headers: { ...corsHeaders, "content-type": "application/json" },
          json: [{ status: installStatus, expires_at: expiresAt }],
        });
      },
    );

    await navigateWithinParentApp(page, `/child-v2/${CHILD_ID}`);
    await page.getByTitle("צור קישור חיבור חדש").click();

    const modalHeading = page.getByRole("heading", { name: /חיבור מכשיר/ });
    await expect(modalHeading).toBeVisible();
    await expect
      .poll(() => requestedSessionIds.length, { timeout: 7_000 })
      .toBeGreaterThanOrEqual(2);
    await expect(modalHeading).toBeVisible();
    expect(new Set(requestedSessionIds)).toEqual(new Set([installSessionId]));

    const readsBeforeConsume = protectedDeviceReads;
    installStatus = "consumed";
    await expect(modalHeading).toBeHidden({ timeout: 7_000 });
    await expect
      .poll(() => protectedDeviceReads, { timeout: 7_000 })
      .toBeGreaterThan(readsBeforeConsume);
  });
});

test.describe("V2 incomplete guardian repair", () => {
  test("repairs a missing profile inside the existing family", async ({
    page,
  }) => {
    const calls = await installSyntheticIncompleteGuardianSession(page);

    await page.goto("/auth", { waitUntil: "domcontentloaded" });
    await page.getByLabel("אימייל").fill(user.email);
    await page.getByLabel("סיסמה").fill("Synthetic123!");
    await page.getByRole("button", { name: "התחבר", exact: true }).click();

    await expect(page).toHaveURL(/\/onboarding$/);
    await page.getByLabel("שם מלא *").fill("הורה בדיקה");
    await page
      .getByRole("button", { name: "המשך למרכז הבטיחות", exact: true })
      .click();

    await expect(page).toHaveURL(/\/home-v2$/);
    await expect(page.getByText("ילד בדיקה", { exact: true }).first()).toBeVisible();
    expect(calls.bootstrapBodies).toHaveLength(1);
    expect(calls.bootstrapBodies[0].target_family_id).not.toBe(FAMILY_ID);
    expect(calls.bootstrapResults).toEqual([
      { family_id: FAMILY_ID, created: false },
    ]);
    expect(calls.childBodies).toEqual([]);
  });
});

test.describe("V2 first-time guardian flow", () => {
  test("creates a guardian profile and first-child QR with minimum data", async ({
    page,
  }, testInfo) => {
    const calls = await installSyntheticNewGuardianSession(page);
    const birthYear = String(new Date().getFullYear() - 12);

    await page.goto("/auth", { waitUntil: "domcontentloaded" });
    await page.getByLabel("אימייל").fill(user.email);
    await page.getByLabel("סיסמה").fill("Synthetic123!");
    await page.getByRole("button", { name: "התחבר", exact: true }).click();

    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByLabel("מספר טלפון (אופציונלי)")).toBeVisible();
    await page.getByLabel("שם מלא *").fill("הורה בדיקה");
    await page
      .getByRole("button", { name: "המשך למרכז הבטיחות", exact: true })
      .click();

    await expect(page).toHaveURL(/\/home-v2$/);
    await expect(
      page.getByRole("heading", { name: "עדיין אין מכשיר מנוטר" }),
    ).toBeVisible();
    expect(calls.bootstrapBodies).toHaveLength(1);
    expect(calls.bootstrapBodies[0]).toMatchObject({ target_phone: "" });

    await page
      .getByRole("button", { name: "הוספת ילד ראשון", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "הוספת ילד חדש" }),
    ).toBeVisible();
    await dialog.getByLabel("שם הילד/ה *").fill("ילד בדיקה");

    await dialog.getByRole("combobox", { name: "שנת לידה" }).click();
    await page.getByRole("option", { name: birthYear, exact: true }).click();
    await dialog.getByRole("combobox", { name: "מין" }).click();
    await page.getByRole("option", { name: "בן", exact: true }).click();
    await dialog
      .getByRole("button", { name: "המשך לחיבור מכשיר", exact: true })
      .click();

    await expect(
      dialog.getByRole("heading", { name: "חיבור מכשיר" }),
    ).toBeVisible();
    await expect(
      dialog.getByText("סרקו את הקוד ממכשיר הילד/ה", { exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "העתק קישור התקנה" }),
    ).toBeVisible();

    expect(calls.childBodies).toHaveLength(1);
    expect(calls.childBodies[0]).toMatchObject({
      target_birth_year: Number(birthYear),
      target_gender: "male",
    });
    expect(calls.childBodies[0]).not.toHaveProperty("target_day");
    expect(calls.childBodies[0]).not.toHaveProperty("target_month");
    expect(calls.installBodies).toEqual([{ child_id: CHILD_ID }]);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth + 1,
      ),
    ).toBe(true);

    await testInfo.attach("v2-first-child-qr-desktop-rtl", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
  });
});

test.describe("V2 private parent routes on mobile", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });

  test.beforeEach(async ({ page }) => {
    await installSyntheticV2Session(page);
    await authenticateSyntheticParent(page);
  });

  test("remain usable without horizontal overflow", async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "reduce" });

    for (const route of privateRoutes) {
      await test.step(route.path, async () => {
        await navigateWithinParentApp(page, route.path);
        await expect(route.visible(page)).toBeVisible();
        await page.waitForLoadState("networkidle");
        expect(
          await page.evaluate(
            () =>
              document.documentElement.scrollWidth <=
              document.documentElement.clientWidth + 1,
          ),
        ).toBe(true);
      });
    }

    await testInfo.attach("v2-parent-settings-mobile-rtl-reduced-motion", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
  });
});
