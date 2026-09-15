import { readFileSync } from "node:fs";
import type { Page, Route } from "@playwright/test";
import { expect, test } from "../playwright-fixture";

// Browser contract fixtures only. No real accounts, provider calls or backend
// writes: the shared fixture blocks non-loopback traffic, and every API below
// is fulfilled locally. SQL authorization is a separate disposable test gate.
type Row = Record<string, unknown>;
type Outcome = "confirmed" | "dismissed" | "inconclusive";
type ParentState = "new" | "saved" | "acknowledged";
type Assessment = {
  id: string;
  seq: number;
  outcome: Outcome;
  category: string | null;
  severity: string | null;
  childRole: string;
  completedAt: string;
  summary: string;
  reason: string;
  action: string;
};
type ParentCase = {
  id: string;
  childId: string;
  occurredAt: string;
  state: ParentState;
  stateVersion: number;
  attentionSeq: number;
  acknowledgedSeq: number | null;
  acknowledgedAt: string | null;
  assessments: Assessment[];
};
type MockReply = { status?: number; json: unknown };
type FixtureState = {
  cases: Map<string, ParentCase>;
  calls: Array<{ rpc: string; body: Row }>;
  reads: Array<{ table: string; url: URL; returnedIds: string[] }>;
  unexpected: string[];
  failures: Map<string, { code: string; remaining: number }>;
  gates: Map<string, Promise<void>>;
  rpcHandlers: Map<string, (body: Row) => MockReply | Promise<MockReply>>;
  afterHistoryPage: (() => void) | null;
  guardianStateOverrides: Map<string, Row>;
};

const USER_ID = "91000000-0000-4000-8000-000000000001";
const FAMILY_ID = "92000000-0000-4000-8000-000000000001";
const CHILD_ID = "93000000-0000-4000-8000-000000000001";
const SECOND_CHILD_ID = "93000000-0000-4000-8000-000000000002";
const OTHER_CHILD_ID = "93000000-0000-4000-8000-000000000099";
const INCIDENT_ID = "95000000-0000-4000-8000-000000000001";
const OTHER_INCIDENT_ID = "95000000-0000-4000-8000-000000000099";
const NOW = "2026-09-08T09:30:00.000Z";
const INITIAL_AT = "2026-09-08T09:00:00.000Z";
const CHILD_NAME = "ילד סינתטי עם שם ארוך לבדיקת פרטי אירוע";
const OTHER_CHILD_NAME = "מידע של משפחה סינתטית אחרת";
const envURL = readFileSync(".env", "utf8")
  .match(/^\s*VITE_SUPABASE_URL\s*=\s*["']?([^\s"']+)/m)?.[1];
if (!envURL) throw new Error("VITE_SUPABASE_URL is required for isolated E2E routing");
const supabaseOrigin = new URL(envURL).origin;
const user = {
  id: USER_ID, aud: "authenticated", role: "authenticated",
  email: "parent-case.synthetic@example.invalid", email_confirmed_at: NOW,
  phone: "", confirmed_at: NOW, last_sign_in_at: NOW,
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { full_name: "הורה סינתטי" }, identities: [],
  created_at: NOW, updated_at: NOW, is_anonymous: false,
};
const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
const session = {
  access_token: [encode({ alg: "HS256", typ: "JWT" }), encode({
    aud: "authenticated", exp: 4_102_444_800, iat: 1_775_000_000,
    iss: `${supabaseOrigin}/auth/v1`, role: "authenticated", sub: USER_ID, email: user.email,
  }), "synthetic-signature"].join("."),
  token_type: "bearer", expires_in: 2_147_483_647, expires_at: 4_102_444_800,
  refresh_token: "synthetic-refresh", user,
};
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, prefer, range, x-client-info",
  "access-control-allow-methods": "GET, POST, OPTIONS, HEAD",
  "access-control-expose-headers": "content-range",
  "content-type": "application/json",
};

function makeCase(id = INCIDENT_ID, childId = CHILD_ID): ParentCase {
  return {
    id, childId, occurredAt: INITIAL_AT, state: "new", stateVersion: 0,
    attentionSeq: 1, acknowledgedSeq: null, acknowledgedAt: null,
    assessments: [
      {
        id: "96000000-0000-4000-8000-000000000001", seq: 1, outcome: "confirmed",
        category: "violence", severity: "critical", childRole: "target",
        completedAt: "2026-09-08T09:01:00.000Z",
        summary: "סיכום סינתטי של הבדיקה הראשונה.",
        reason: "נימוק היסטורי סינתטי.", action: "המלצה היסטורית סינתטית.",
      },
      {
        id: "96000000-0000-4000-8000-000000000002", seq: 2, outcome: "confirmed",
        category: "bullying", severity: "medium", childRole: "participant",
        completedAt: NOW, summary: "סיכום סינתטי עדכני של האירוע.",
        reason: "נימוק סינתטי מהבדיקה העדכנית.", action: "המלצה עדכנית לשיחה רגועה.",
      },
    ],
  };
}

function latest(item: ParentCase): Assessment {
  return item.assessments[item.assessments.length - 1];
}

function isOwnCase(item: ParentCase): boolean {
  return item.childId === CHILD_ID || item.childId === SECOND_CHILD_ID;
}

function rowsFor(state: FixtureState, table: string): Row[] | undefined {
  const cases = [...state.cases.values()].filter(isOwnCase);
  switch (table) {
    case "v2_guardian_memberships": return [{ guardian_user_id: USER_ID, family_id: FAMILY_ID, role: "owner", status: "active", created_at: NOW }];
    case "v2_guardian_profiles": return [{ user_id: USER_ID, display_name: "הורה סינתטי", phone: null }];
    case "v2_children": return [
      { id: CHILD_ID, family_id: FAMILY_ID, display_name: CHILD_NAME, status: "active", created_at: INITIAL_AT },
      { id: SECOND_CHILD_ID, family_id: FAMILY_ID, display_name: "ילדה סינתטית", status: "active", created_at: NOW },
    ];
    case "v2_safety_incidents": return cases.map((item) => ({
      id: item.id, child_id: item.childId, category: item.assessments[0].category, severity: item.assessments[0].severity,
      child_role: item.assessments[0].childRole, confidence: 0.96, source_platform: "whatsapp",
      status: "confirmed", occurred_at: item.occurredAt, updated_at: latest(item).completedAt,
    }));
    case "v2_incident_analysis": return cases.map((item) => ({
      incident_id: item.id, outcome: "confirmed", safe_summary: item.assessments[0].summary,
      safe_reason: item.assessments[0].reason, recommended_action: item.assessments[0].action,
      analyzed_at: item.assessments[0].completedAt,
    }));
    case "v2_incident_analysis_details": return cases.map((item) => ({
      incident_id: item.id, expert_category: item.assessments[0].category, expert_severity: item.assessments[0].severity,
      expert_child_role: item.assessments[0].childRole, expert_confidence: 0.96,
    }));
    case "v2_guardian_incident_states": return cases.map((item) => ({
      incident_id: item.id, guardian_user_id: USER_ID, state: item.state,
      created_at: INITIAL_AT, updated_at: NOW,
      ...state.guardianStateOverrides.get(item.id),
    }));
    // Explicitly model the home reads observed during login fallback. Normal
    // parent-case login returns directly to alerts; unknown tables still fail.
    case "v2_guardian_incident_feedback":
    case "v2_protected_devices":
    case "v2_parental_settings":
    case "v2_parental_app_policies":
    case "v2_parental_geofences":
    case "v2_parental_bonus_grants":
    case "v2_parental_schedules":
    case "v2_parental_device_state":
    case "v2_device_health_events":
    case "v2_device_monitoring_state":
    case "v2_alert_deliveries": return [];
    default: return undefined;
  }
}

// Deliberately enforce PostgREST predicates and pagination: returning the full
// fixture regardless of query would make exact-ID/beyond-250 tests meaningless.
function selectRows(rows: Row[], url: URL, rangeHeader?: string): Row[] {
  let selected = [...rows];
  for (const [field, expression] of url.searchParams) {
    if (["select", "order", "limit", "offset"].includes(field)) continue;
    if (expression.startsWith("eq.")) {
      selected = selected.filter((row) => String(row[field]) === expression.slice(3));
    } else if (expression.startsWith("neq.")) {
      selected = selected.filter((row) => String(row[field]) !== expression.slice(4));
    } else if (expression.startsWith("in.(") && expression.endsWith(")")) {
      const allowed = expression.slice(4, -1).split(",").map((value) => value.replace(/^"|"$/g, ""));
      selected = selected.filter((row) => allowed.includes(String(row[field])));
    } else if (expression === "is.null") {
      selected = selected.filter((row) => row[field] == null);
    } else {
      throw new Error(`Unsupported fixture predicate ${field}=${expression}`);
    }
  }
  const order = url.searchParams.get("order");
  if (order) {
    const terms = order.split(",").map((term) => term.split("."));
    selected.sort((left, right) => {
      for (const [field, direction] of terms) {
        const value = String(left[field] ?? "").localeCompare(String(right[field] ?? ""));
        if (value) return direction === "desc" ? -value : value;
      }
      return 0;
    });
  }
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const limit = url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : undefined;
  selected = selected.slice(offset, limit == null ? undefined : offset + limit);
  if (rangeHeader) {
    const match = /^(\d+)-(\d+)$/.exec(rangeHeader);
    if (!match) throw new Error(`Unsupported fixture range ${rangeHeader}`);
    selected = selected.slice(Number(match[1]), Number(match[2]) + 1);
  }
  return selected;
}

async function reply(route: Route, value: MockReply): Promise<void> {
  await route.fulfill({ status: value.status ?? 200, headers: cors, json: value.json });
}

async function installFixture(page: Page, items = [makeCase()]): Promise<FixtureState> {
  const state: FixtureState = {
    cases: new Map(items.map((item) => [item.id, item])), calls: [], reads: [], unexpected: [],
    failures: new Map(), gates: new Map(), rpcHandlers: new Map(), afterHistoryPage: null,
    guardianStateOverrides: new Map(),
  };
  state.rpcHandlers.set("is_email_allowed", () => ({ json: true }));
  installCaseRpcHandlers(state);
  // Rejected login redirects fall back to the home map. Keep that unrelated
  // rendering boundary local as in monitoring-feedback; no Maps SDK request.
  await page.addInitScript(() => {
    class SyntheticMap {
      setCenter() {}
      setZoom() {}
      fitBounds() {}
    }
    class SyntheticInfoWindow {
      setContent() {}
      open() {}
      close() {}
    }
    Object.defineProperty(window, "google", { value: { maps: {
      version: "synthetic-offline", Map: SyntheticMap, InfoWindow: SyntheticInfoWindow,
      LatLngBounds: class { extend() {} }, event: { clearListeners() {} },
    } } });
  });
  await page.routeWebSocket("**/*", (socket) => socket.close());
  await page.route("**/auth/v1/**", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }
    const path = new URL(route.request().url()).pathname;
    if (!path.endsWith("/token") && !path.endsWith("/user")) {
      state.unexpected.push(path);
      await reply(route, { status: 500, json: { code: "unexpected_fixture_auth" } });
      return;
    }
    await reply(route, { json: path.endsWith("/user") ? user : session });
  });
  await page.route("**/functions/v1/**", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }
    state.unexpected.push(new URL(route.request().url()).pathname);
    await reply(route, { status: 500, json: { code: "unexpected_fixture_function" } });
  });
  await page.route("**/rest/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const table = decodeURIComponent(url.pathname.split("/").pop() ?? "");
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }
    const body = url.pathname.includes("/rpc/") ? request.postDataJSON() as Row : null;
    if (body) state.calls.push({ rpc: table, body });
    const key = table === "v2_safety_incidents" && url.searchParams.has("id") ? `${table}:exact` : table;
    const gate = state.gates.get(key);
    if (gate) await gate;
    const failure = state.failures.get(key);
    if (failure && failure.remaining > 0) {
      failure.remaining -= 1;
      await reply(route, { status: 503, json: { code: failure.code, message: "Synthetic unavailable operation" } });
      return;
    }
    if (url.pathname.includes("/rpc/")) {
      const handler = state.rpcHandlers.get(table);
      if (!handler) {
        state.unexpected.push(`rpc:${table}`);
        await reply(route, { status: 500, json: { code: "unexpected_fixture_rpc" } });
        return;
      }
      await reply(route, await handler(body!));
      return;
    }
    const source = rowsFor(state, table);
    if (!source || !["GET", "HEAD"].includes(request.method())) {
      state.unexpected.push(`${request.method()}:${table}`);
      await reply(route, { status: 500, json: { code: "unexpected_fixture_table" } });
      return;
    }
    let selected: Row[];
    try {
      selected = selectRows(source, url, request.headers().range);
    } catch (error) {
      state.unexpected.push(String(error));
      await reply(route, { status: 500, json: { code: "unexpected_fixture_query" } });
      return;
    }
    state.reads.push({ table, url, returnedIds: selected.map((row) => String(row.id ?? row.incident_id ?? "")) });
    const headers = { ...cors, "content-range": selected.length ? `0-${selected.length - 1}/${selected.length}` : "*/0" };
    const wantsObject = (request.headers().accept ?? "").includes("application/vnd.pgrst.object+json");
    await route.fulfill({
      status: 200, headers,
      ...(request.method() === "HEAD" ? {} : { json: wantsObject ? selected[0] ?? null : selected }),
    });
  });
  return state;
}

async function authenticate(page: Page): Promise<void> {
  await page.goto(`/auth?redirect=${encodeURIComponent("/alerts-v2")}`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("אימייל").fill(user.email);
  await page.getByLabel("סיסמה").fill("Synthetic123!");
  await page.getByRole("button", { name: "התחבר", exact: true }).click();
  await expect(page).toHaveURL(/\/alerts-v2$/);
  await page.waitForLoadState("networkidle");
}

async function openDetails(page: Page, id = INCIDENT_ID): Promise<void> {
  await page.goto(`/alerts-v2?incident=${id}`);
  await expect(page.getByTestId("guardian-case-details")).toBeVisible();
  await expect(page.getByTestId("case-current-assessment")).toBeVisible();
}

function assessmentRow(item: Assessment): Row {
  return {
    assessment_seq: item.seq, assessment_state: "completed", completed_at: item.completedAt, expert_outcome: item.outcome,
    expert_category: item.category, expert_severity: item.severity, expert_child_role: item.childRole,
    expert_confidence: 0.8, safe_summary: item.summary, safe_reason: item.reason,
    recommended_action: item.action,
  };
}

function summaryRow(item: ParentCase): Row {
  return {
    ...assessmentRow(latest(item)), incident_id: item.id, latest_assessment_at: latest(item).completedAt,
    history_assessment_count: item.assessments.filter((assessment) => assessment.seq <= latest(item).seq).length,
    recommended_action: latest(item).outcome === "confirmed" ? latest(item).action : item.assessments[0].action,
    attention_assessment_seq: item.attentionSeq, acknowledged_assessment_seq: item.acknowledgedSeq,
    acknowledged_at: item.acknowledgedAt, guardian_state: item.state,
    guardian_state_version: item.stateVersion, guardian_state_updated_at: item.stateVersion ? NOW : null,
    case_details_available: true, conversation_label: null, conversation_type: null,
  };
}

function installCaseRpcHandlers(state: FixtureState): void {
  const requestedCases = (body: Row) => {
    expect(Object.keys(body)).toEqual(["target_incident_ids"]);
    const ids = body.target_incident_ids as string[];
    expect(Array.isArray(ids)).toBe(true);
    expect(ids.length).toBeLessThanOrEqual(250);
    return ids.flatMap((id) => {
      const item = state.cases.get(id);
      return item && isOwnCase(item) ? [item] : [];
    });
  };
  state.rpcHandlers.set("v2_get_guardian_case_summaries", (body) => ({ json: requestedCases(body).map(summaryRow) }));
  state.rpcHandlers.set("v2_get_guardian_three_gate_projections", (body) => ({
    json: requestedCases(body).map((item) => ({ ...assessmentRow(latest(item)), incident_id: item.id })),
  }));
  state.rpcHandlers.set("v2_get_guardian_case_history", (body) => {
    expect(Object.keys(body).sort()).toEqual(["target_after_seq", "target_expected_count", "target_incident_id", "target_limit", "target_through_seq"]);
    const item = state.cases.get(String(body.target_incident_id));
    if (!item || !isOwnCase(item)) return { status: 403, json: { code: "42501", message: "guardian_incident_access_denied" } };
    const through = Number(body.target_through_seq);
    const after = Number(body.target_after_seq);
    const limit = Number(body.target_limit);
    expect(limit).toBe(100);
    expect(Number.isSafeInteger(body.target_expected_count)).toBe(true);
    // Count the complete captured range before applying the cursor. A lower
    // sequence that finishes late must not disappear behind an earlier page.
    const snapshot = item.assessments.filter((assessment) => assessment.seq <= through);
    if (snapshot.length !== body.target_expected_count) {
      return { status: 409, json: { code: "23505", message: "guardian_history_snapshot_conflict" } };
    }
    const eligible = snapshot.filter((assessment) => assessment.seq > after);
    const selected = eligible.slice(0, limit);
    const hasMore = eligible.length > selected.length;
    const response = {
      incident_id: item.id, through_seq: through,
      assessments: selected.map((assessment) => ({
        ...assessmentRow(assessment),
        recommended_action: assessment.outcome === "confirmed" ? assessment.action : item.assessments[0].action,
        recommendation_is_historical: assessment.seq !== through || assessment.outcome !== "confirmed",
        is_attention_update: assessment.seq === item.attentionSeq,
        is_current: assessment.seq === through, is_first_confirmation: assessment.seq === 1,
      })),
      next_after_seq: hasMore ? selected[selected.length - 1].seq : null, has_more: hasMore,
    };
    state.afterHistoryPage?.();
    return { json: [response] };
  });
  state.rpcHandlers.set("v2_set_guardian_case_state", (body) => {
    expect(Object.keys(body).sort()).toEqual([
      "target_expected_assessment_seq", "target_expected_state_version", "target_incident_id", "target_request_key", "target_state",
    ]);
    expect(body.target_request_key).toEqual(expect.stringMatching(/^guardian-incident:[0-9a-f-]{36}$/));
    const item = state.cases.get(String(body.target_incident_id));
    if (!item || !isOwnCase(item)) return { status: 403, json: { code: "42501", message: "guardian_incident_access_denied" } };
    if (body.target_expected_assessment_seq !== latest(item).seq) {
      return { status: 409, json: { code: "23505", message: "guardian_assessment_version_conflict" } };
    }
    if (body.target_expected_state_version !== item.stateVersion) {
      return { status: 409, json: { code: "23505", message: "guardian_state_version_conflict" } };
    }
    item.state = body.target_state as ParentState;
    item.stateVersion += 1;
    if (item.state === "acknowledged") {
      item.acknowledgedSeq = latest(item).seq;
      item.acknowledgedAt = NOW;
    }
    return { json: [{
      incident_id: item.id, state: item.state, state_version: item.stateVersion,
      assessment_seq: latest(item).seq, attention_assessment_seq: item.attentionSeq,
      saved_at: item.state === "saved" ? NOW : null, updated_at: NOW, replayed: false,
      acknowledged_assessment_seq: item.acknowledgedSeq, acknowledged_at: item.acknowledgedAt,
    }] };
  });
}

const details = (page: Page) => page.getByTestId("guardian-case-details");
const current = (page: Page) => page.getByTestId("case-current-assessment");
const ackButton = (page: Page) => details(page).getByRole("button", { name: "סמן כטופל", exact: true });
const stateCalls = (state: FixtureState) => state.calls.filter((call) => call.rpc.startsWith("v2_set_guardian_"));
const historyCalls = (state: FixtureState) => state.calls.filter((call) => call.rpc === "v2_get_guardian_case_history");

function addEscalation(item: ParentCase): void {
  const next = latest(item).seq + 1;
  item.assessments.push({
    ...latest(item), id: `96000000-0000-4000-8000-${String(next).padStart(12, "0")}`,
    seq: next, severity: "critical", completedAt: "2026-09-08T10:00:00.000Z",
    summary: "סיכום סינתטי חדש בעקבות החמרה.", action: "המלצה סינתטית בעקבות מידע חדש.",
  });
  item.attentionSeq = next;
  item.state = "new";
  item.stateVersion += 1;
}

async function assertFixtureClean(state: FixtureState): Promise<void> {
  expect(state.unexpected, `Unexpected isolated fixture requests: ${JSON.stringify(state.unexpected)}`).toEqual([]);
  expect(state.calls.filter((call) => call.rpc === "v2_set_guardian_incident_state")).toEqual([]);
}

for (const viewport of [{ width: 360, height: 800 }, { width: 1280, height: 900 }]) {
  test(`parent case list and detail are readable by keyboard in RTL at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const state = await installFixture(page);
    const runtimeErrors: string[] = [];
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    await authenticate(page);
    await page.goto("/alerts-v2");
    const card = page.getByTestId(`incident-${INCIDENT_ID}`);
    await expect(card).toBeVisible();
    await expect(card.getByText("המלצה עדכנית לשיחה רגועה.", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("form", { name: "משוב על ההתראה", exact: true })).toHaveCount(0);
    const open = page.getByTestId(`open-incident-${INCIDENT_ID}`);
    await open.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`incident=${INCIDENT_ID}`));
    await expect(page.getByTestId("case-detail-heading")).toBeFocused();
    await expect(current(page)).toContainText("חומרה בינונית");
    await expect(current(page)).not.toContainText("חומרה קריטית");
    await expect(page.getByTestId("case-recommendation")).toContainText("המלצה עדכנית לשיחה רגועה.");
    await expect(page.getByTestId("case-latest-assessment-at")).toHaveAttribute("datetime", NOW);
    await expect(page.getByTestId("case-assessment-1")).toContainText("המלצה היסטורית סינתטית.");
    await expect(page.getByTestId("case-assessment-2")).toContainText("המלצה עדכנית לשיחה רגועה.");
    await expect(details(page)).toContainText(/שם השיחה.*(אינו זמין|לא זמין|לא נמסר)/);
    expect(await page.locator("main").evaluate((element) => getComputedStyle(element).direction)).toBe("rtl");
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    await testInfo.attach(`parent-case-${viewport.width}-rtl`, {
      body: await page.screenshot({ path: testInfo.outputPath(`parent-case-${viewport.width}-rtl.png`), fullPage: true }), contentType: "image/png",
    });
    await page.evaluate(() => { document.documentElement.style.fontSize = "20px"; });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    await testInfo.attach(`parent-case-${viewport.width}-large-text`, {
      body: await page.screenshot({ path: testInfo.outputPath(`parent-case-${viewport.width}-large-text.png`), fullPage: true }), contentType: "image/png",
    });
    await details(page).getByRole("button", { name: "חזרה להתראות", exact: true }).click();
    await expect(open).toBeFocused();
    expect(runtimeErrors).toEqual([]);
    await assertFixtureClean(state);
  });
}

test("acknowledged deep link beyond the 250-item list is fetched by authorized exact ID and survives reload", async ({ page }) => {
  const target = makeCase();
  target.state = "acknowledged";
  target.stateVersion = 1;
  target.acknowledgedSeq = 2;
  target.acknowledgedAt = NOW;
  const newer = Array.from({ length: 251 }, (_, index) => {
    const item = makeCase(`95100000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, SECOND_CHILD_ID);
    item.occurredAt = "2026-09-08T10:00:00.000Z";
    return item;
  });
  const state = await installFixture(page, [target, ...newer]);
  await authenticate(page);
  await page.goto("/alerts-v2");
  await expect(page.getByTestId(`incident-${newer[0].id}`)).toBeVisible();
  await expect(page.getByTestId(`incident-${INCIDENT_ID}`)).toHaveCount(0);
  await openDetails(page);
  await expect(details(page)).toContainText(CHILD_NAME);
  await expect(page.getByTestId("case-recommendation")).toContainText(target.assessments[1].action);
  await page.reload();
  await expect(details(page)).toContainText(CHILD_NAME);
  const exactReads = state.reads.filter((read) => read.table === "v2_safety_incidents" && read.url.searchParams.get("id") === `eq.${INCIDENT_ID}`);
  expect(exactReads.length).toBeGreaterThanOrEqual(2);
  for (const read of exactReads) {
    expect(read.url.searchParams.get("child_id")).toContain(CHILD_ID);
    expect(read.url.searchParams.has("limit")).toBe(false);
    expect(read.returnedIds).toEqual([INCIDENT_ID]);
  }
  const listReads = state.reads.filter((read) => read.table === "v2_safety_incidents" && read.url.searchParams.get("limit") === "250");
  expect(listReads.length).toBeGreaterThan(0);
  expect(listReads.every((read) => read.returnedIds.length <= 250 && !read.returnedIds.includes(INCIDENT_ID))).toBe(true);
  await assertFixtureClean(state);
});

for (const outcome of ["dismissed", "inconclusive"] as const) {
  test(`latest ${outcome} remains distinct from the historical critical confirmation and recommendation`, async ({ page }) => {
    const item = makeCase();
    Object.assign(latest(item), {
      outcome, category: outcome === "inconclusive" ? "violence" : null,
      severity: outcome === "inconclusive" ? "critical" : null,
      summary: "סיכום עדכני שלא מאשר מסקנה חדשה.", action: "המלצה עדכנית זהירה ללא הבטחת בטיחות.",
    });
    const state = await installFixture(page, [item]);
    await authenticate(page);
    await openDetails(page);
    await expect(page.getByTestId("case-current-outcome")).toContainText(outcome === "dismissed" ? "לא אושר חשש" : "לא הכריעה");
    await expect(current(page)).not.toContainText(/חומרה קריטית|חומרה בינונית|הילד\/ה יעד לפגיעה/);
    await expect(page.getByTestId("case-historical-first-confirmation")).toContainText("חומרה קריטית");
    await expect(current(page)).toContainText(latest(item).summary);
    await expect(current(page)).not.toContainText(item.assessments[0].summary);
    await expect(page.getByTestId("case-recommendation")).toContainText(item.assessments[0].action);
    await expect(page.getByTestId("case-recommendation")).toContainText("לא המלצה חדשה");
    await expect(page.getByTestId("case-recommendation")).not.toContainText(latest(item).action);
    await expect(details(page).getByText(/הכול בטוח|הכל בטוח|הסיכון חלף|אין סיכון/)).toHaveCount(0);
    await assertFixtureClean(state);
  });
}

test("a stale assessment acknowledgment refetches the new update and never acknowledges it silently", async ({ page }) => {
  const item = makeCase();
  const state = await installFixture(page, [item]);
  await authenticate(page);
  await openDetails(page);
  addEscalation(item);
  await ackButton(page).click();
  await expect(page.getByTestId("case-action-error")).toBeVisible();
  await expect(page.getByTestId("case-recommendation")).toContainText(latest(item).action);
  expect(item.state).toBe("new");
  expect(item.acknowledgedSeq).toBeNull();
  expect(stateCalls(state)[0].body.target_expected_assessment_seq).toBe(2);
  await ackButton(page).click();
  await expect.poll(() => item.acknowledgedSeq).toBe(3);
  expect(stateCalls(state)[1].body.target_expected_assessment_seq).toBe(3);
  expect(stateCalls(state)[1].body.target_expected_state_version).toBe(1);
  await assertFixtureClean(state);
});

test("a concurrent guardian action conflicts by state version even when the assessment did not change", async ({ page }) => {
  const item = makeCase();
  const state = await installFixture(page, [item]);
  await authenticate(page);
  await openDetails(page);
  item.state = "saved";
  item.stateVersion = 1;
  await ackButton(page).click();
  await expect(page.getByTestId("case-action-error")).toBeVisible();
  expect(item.state).toBe("saved");
  expect(item.acknowledgedSeq).toBeNull();
  expect(stateCalls(state)[0].body.target_expected_state_version).toBe(0);
  await ackButton(page).click();
  await expect.poll(() => item.state).toBe("acknowledged");
  expect(stateCalls(state)[1].body.target_expected_state_version).toBe(1);
  await assertFixtureClean(state);
});

test("a later severity escalation reopens the same parent event and keeps the earlier acknowledgment historical", async ({ page }) => {
  const item = makeCase();
  item.assessments[0].severity = "medium";
  latest(item).severity = "high";
  item.attentionSeq = 2;
  const state = await installFixture(page, [item]);
  await authenticate(page);
  await openDetails(page);
  await ackButton(page).click();
  await expect.poll(() => item.acknowledgedSeq).toBe(2);
  addEscalation(item);
  await page.goto("/alerts-v2");
  await expect(page.getByTestId(`incident-${INCIDENT_ID}`)).toHaveCount(1);
  await expect(page.getByTestId(`incident-${INCIDENT_ID}`)).toContainText("חומרה קריטית");
  await page.getByTestId(`open-incident-${INCIDENT_ID}`).click();
  await expect(page.getByTestId("case-assessment-3")).toBeVisible();
  await expect(ackButton(page)).toBeEnabled();
  expect(item.acknowledgedSeq).toBe(2);
  expect(item.acknowledgedAt).toBe(NOW);
  expect(stateCalls(state)).toHaveLength(1);
  await assertFixtureClean(state);
});

for (const inaccessibleId of ["95000000-0000-4000-8000-000000000088", OTHER_INCIDENT_ID]) {
  test(`unknown or forbidden incident link ${inaccessibleId.slice(-2)} exposes no unrelated child data`, async ({ page }) => {
    const other = makeCase(OTHER_INCIDENT_ID, OTHER_CHILD_ID);
    latest(other).summary = OTHER_CHILD_NAME;
    const state = await installFixture(page, [makeCase(), other]);
    await authenticate(page);
    await page.goto(`/alerts-v2?incident=${inaccessibleId}`);
    await expect(page.getByTestId("case-not-found")).toBeVisible();
    await expect(page.getByTestId("case-current-assessment")).toHaveCount(0);
    await expect(page.getByText(OTHER_CHILD_NAME, { exact: true })).toHaveCount(0);
    expect(stateCalls(state)).toEqual([]);
    expect(historyCalls(state).some((call) => call.body.target_incident_id === inaccessibleId)).toBe(false);
    await assertFixtureClean(state);
  });
}

test("a malformed link has an explicit invalid state and sends no malformed incident query", async ({ page }) => {
  const state = await installFixture(page);
  await authenticate(page);
  await page.goto("/alerts-v2?incident=not-an-incident");
  await expect(page.getByTestId("case-invalid-link")).toBeVisible();
  expect(state.reads.some((read) => read.url.searchParams.get("id") === "eq.not-an-incident")).toBe(false);
  expect(stateCalls(state)).toEqual([]);
  await assertFixtureClean(state);
});

test("missing new case capability retains the readable original alert and disables unsafe case actions", async ({ page }) => {
  const state = await installFixture(page);
  state.failures.set("v2_get_guardian_case_summaries", { code: "PGRST202", remaining: Infinity });
  await authenticate(page);
  await openDetails(page);
  await expect(page.getByTestId("case-recommendation")).toContainText("המלצה עדכנית לשיחה רגועה.");
  await expect(page.getByTestId("case-actions-unavailable")).toBeVisible();
  await expect(ackButton(page)).toBeDisabled();
  expect(state.calls.some((call) => call.rpc === "v2_get_guardian_three_gate_projections")).toBe(true);
  expect(stateCalls(state)).toEqual([]);
  await assertFixtureClean(state);
});

test("missing history capability preserves current assessment text and permits only the verified versioned action", async ({ page }) => {
  const state = await installFixture(page);
  state.failures.set("v2_get_guardian_case_history", { code: "PGRST202", remaining: Infinity });
  await authenticate(page);
  await openDetails(page);
  await expect(page.getByTestId("case-history-error")).toBeVisible();
  await expect(page.getByTestId("case-recommendation")).toContainText("המלצה עדכנית לשיחה רגועה.");
  await expect(ackButton(page)).toBeEnabled();
  await ackButton(page).click();
  await expect.poll(() => state.cases.get(INCIDENT_ID)?.acknowledgedSeq).toBe(2);
  expect(stateCalls(state)[0].body.target_expected_assessment_seq).toBe(2);
  expect(stateCalls(state)[0].body.target_expected_state_version).toBe(0);
  await assertFixtureClean(state);
});

test("paginated completed history stays at the captured assessment while a newer update arrives", async ({ page }) => {
  const item = makeCase();
  item.assessments = Array.from({ length: 101 }, (_, index) => ({
    ...item.assessments[1], id: `96100000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    seq: index + 1, summary: `סיכום בדיקה סינתטית מספר ${index + 1}.`,
  }));
  const state = await installFixture(page, [item]);
  state.afterHistoryPage = () => { state.afterHistoryPage = null; addEscalation(item); };
  await authenticate(page);
  await openDetails(page);
  await expect(page.getByTestId("case-assessment-101")).toBeVisible();
  await expect(page.getByTestId("case-assessment-102")).toHaveCount(0);
  expect(historyCalls(state).map((call) => call.body.target_after_seq)).toEqual([0, 100]);
  expect(historyCalls(state).every((call) => call.body.target_through_seq === 101)).toBe(true);
  expect(historyCalls(state).every((call) => call.body.target_expected_count === 101)).toBe(true);
  await expect(current(page)).toContainText("חומרה בינונית");
  await assertFixtureClean(state);
});

test("a lower sequence completed between history pages invalidates the partial snapshot without hiding the current alert", async ({ page }) => {
  const item = makeCase();
  const template = latest(item);
  // Sequence 50 is unfinished when the current sequence 102 is displayed.
  // The first page already passes its position: it ends at sequence 101.
  item.assessments = Array.from({ length: 102 }, (_, index) => ({
    ...template, id: `96200000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    seq: index + 1, summary: `סיכום בדיקה סינתטית מספר ${index + 1}.`,
  })).filter((assessment) => assessment.seq !== 50);
  const state = await installFixture(page, [item]);
  state.afterHistoryPage = () => {
    state.afterHistoryPage = null;
    item.assessments.push({
      ...template, id: "96200000-0000-4000-8000-000000000050", seq: 50,
      completedAt: "2026-09-08T10:00:00.000Z", summary: "הערכה קודמת שהושלמה באיחור.",
    });
    item.assessments.sort((left, right) => left.seq - right.seq);
  };
  await authenticate(page);
  await openDetails(page);
  await expect(current(page)).toContainText("סיכום בדיקה סינתטית מספר 102.");
  await expect(page.getByTestId("case-history-error")).toBeVisible();
  await expect(page.locator('[data-testid^="case-assessment-"]')).toHaveCount(0);
  await expect(details(page).getByText("אין בדיקות קודמות זמינות להצגה.", { exact: true })).toHaveCount(0);
  expect(historyCalls(state).map((call) => call.body.target_after_seq)).toEqual([0, 101]);
  expect(historyCalls(state).every((call) => call.body.target_through_seq === 102 && call.body.target_expected_count === 101)).toBe(true);
  expect(stateCalls(state)).toEqual([]);

  await details(page).getByRole("button", { name: "רענון האירוע", exact: true }).click();
  await expect(page.getByTestId("case-history-error")).toHaveCount(0);
  await expect(page.getByTestId("case-assessment-50")).toContainText("הערכה קודמת שהושלמה באיחור.");
  await expect(page.getByTestId("case-assessment-102")).toBeVisible();
  await expect(page.locator('[data-testid^="case-assessment-"]')).toHaveCount(102);
  expect(historyCalls(state).slice(2).every((call) => call.body.target_expected_count === 102 && call.body.target_through_seq === 102)).toBe(true);
  expect(historyCalls(state).slice(2).map((call) => call.body.target_after_seq)).toEqual([0, 100]);
  await assertFixtureClean(state);
});

test("list read failure is not an all-clear state and can be retried", async ({ page }) => {
  const state = await installFixture(page);
  await authenticate(page);
  state.failures.set("v2_safety_incidents", { code: "temporary_unavailable", remaining: Infinity });
  await page.goto("/alerts-v2");
  await expect(page.getByText("לא ניתן לטעון את ההתראות כרגע.", { exact: true })).toBeVisible();
  await expect(page.getByText("אין התראות חדשות", { exact: true })).toHaveCount(0);
  state.failures.delete("v2_safety_incidents");
  await page.getByRole("button", { name: "ניסיון נוסף", exact: true }).click();
  await expect(page.getByTestId(`incident-${INCIDENT_ID}`)).toBeVisible();
  await assertFixtureClean(state);
});

test("detail transport failure is distinct from not-found and retry preserves the exact linked incident", async ({ page }) => {
  const state = await installFixture(page);
  await authenticate(page);
  state.failures.set("v2_safety_incidents:exact", { code: "temporary_unavailable", remaining: Infinity });
  await page.goto(`/alerts-v2?incident=${INCIDENT_ID}`);
  await expect(page.getByTestId("case-load-error")).toBeVisible();
  await expect(page.getByTestId("case-not-found")).toHaveCount(0);
  state.failures.delete("v2_safety_incidents:exact");
  await page.getByRole("button", { name: "ניסיון נוסף לטעינת האירוע", exact: true }).click();
  await expect(page.getByTestId("case-recommendation")).toContainText("המלצה עדכנית לשיחה רגועה.");
  await expect(page).toHaveURL(new RegExp(`incident=${INCIDENT_ID}`));
  await assertFixtureClean(state);
});

test("acknowledgment transport error leaves the detail readable and does not claim the event was handled", async ({ page }) => {
  const item = makeCase();
  const state = await installFixture(page, [item]);
  await authenticate(page);
  await openDetails(page);
  state.failures.set("v2_set_guardian_case_state", { code: "temporary_unavailable", remaining: 1 });
  await ackButton(page).click();
  await expect(page.getByTestId("case-action-error")).toBeVisible();
  await expect(page.getByTestId("case-recommendation")).toContainText(latest(item).action);
  expect(item.acknowledgedSeq).toBeNull();
  await expect(ackButton(page)).toBeEnabled();
  await ackButton(page).click();
  await expect.poll(() => item.acknowledgedSeq).toBe(2);
  await assertFixtureClean(state);
});

test("a direct link remains independent of the child and handled filters already selected in the SPA", async ({ page }) => {
  const second = makeCase("95100000-0000-4000-8000-000000000001", SECOND_CHILD_ID);
  second.state = "acknowledged";
  const state = await installFixture(page, [makeCase(), second]);
  await authenticate(page);
  await page.goto("/alerts-v2");
  await page.getByLabel("סינון התראות לפי ילד/ה").selectOption(SECOND_CHILD_ID);
  await page.getByRole("button", { name: /טופלו/ }).click();
  await expect(page.getByTestId(`incident-${second.id}`)).toBeVisible();
  await expect(page.getByTestId(`incident-${INCIDENT_ID}`)).toHaveCount(0);
  // This intentionally preserves the mounted list's filter state, unlike the
  // separate full-page deep-link/reload test above.
  await page.evaluate((id) => {
    history.pushState({}, "", `/alerts-v2?incident=${id}`);
    dispatchEvent(new PopStateEvent("popstate"));
  }, INCIDENT_ID);
  await expect(current(page)).toContainText("סיכום סינתטי עדכני של האירוע.");
  await expect(details(page)).toContainText(CHILD_NAME);
  await details(page).getByRole("button", { name: "חזרה להתראות", exact: true }).click();
  await expect(page.getByLabel("סינון התראות לפי ילד/ה")).toHaveValue(SECOND_CHILD_ID);
  await expect(page.getByRole("button", { name: /טופלו/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId(`incident-${INCIDENT_ID}`)).toHaveCount(0);
  await assertFixtureClean(state);
});

test("a delayed exact detail read shows loading without a false missing or all-clear conclusion", async ({ page }) => {
  const state = await installFixture(page);
  await authenticate(page);
  let release = () => {};
  state.gates.set("v2_safety_incidents:exact", new Promise<void>((resolve) => { release = resolve; }));
  await page.goto(`/alerts-v2?incident=${INCIDENT_ID}`);
  await expect(details(page).getByText("טוען את האירוע…", { exact: true })).toBeVisible();
  await expect(page.getByTestId("case-not-found")).toHaveCount(0);
  await expect(page.getByText("אין התראות חדשות", { exact: true })).toHaveCount(0);
  await expect(ackButton(page)).toHaveCount(0);
  release();
  state.gates.delete("v2_safety_incidents:exact");
  await expect(current(page)).toBeVisible();
  await assertFixtureClean(state);
});

test("a current-summary transport error does not fall back to a stale initial classification", async ({ page }) => {
  const state = await installFixture(page);
  await authenticate(page);
  state.failures.set("v2_get_guardian_case_summaries", { code: "temporary_unavailable", remaining: Infinity });
  await page.goto(`/alerts-v2?incident=${INCIDENT_ID}`);
  await expect(page.getByTestId("case-load-error")).toBeVisible();
  await expect(current(page)).toHaveCount(0);
  expect(state.calls.some((call) => call.rpc === "v2_get_guardian_three_gate_projections")).toBe(false);
  state.failures.delete("v2_get_guardian_case_summaries");
  await page.getByRole("button", { name: "ניסיון נוסף לטעינת האירוע", exact: true }).click();
  await expect(current(page)).toContainText("חומרה בינונית");
  await assertFixtureClean(state);
});

test("an authoritative null acknowledgment is not replaced by a contradictory separately read guardian state", async ({ page }) => {
  const item = makeCase();
  const state = await installFixture(page, [item]);
  // These reads intentionally represent different snapshots. The current case
  // summary is authoritative; the independent legacy state row was read later.
  state.guardianStateOverrides.set(INCIDENT_ID, {
    state: "acknowledged", acknowledged_at: "2026-09-08T10:00:00.000Z",
    updated_at: "2026-09-08T10:00:00.000Z",
  });
  await authenticate(page);
  await page.goto("/alerts-v2");
  const card = page.getByTestId(`incident-${INCIDENT_ID}`);
  await expect(card).toBeVisible();
  await expect(card).not.toContainText("סימנת שטיפלת");
  await page.getByTestId(`open-incident-${INCIDENT_ID}`).click();
  await expect(current(page)).toBeVisible();
  await expect(details(page)).not.toContainText("סימנת שטיפלת");
  await expect(ackButton(page)).toBeEnabled();
  expect(item.acknowledgedAt).toBeNull();
  expect(state.reads.some((read) => read.table === "v2_guardian_incident_states" && read.returnedIds.includes(INCIDENT_ID))).toBe(true);
  expect(stateCalls(state)).toEqual([]);
  await assertFixtureClean(state);
});

test("an unauthenticated incident link survives the real login redirect and opens the same event", async ({ page }) => {
  const state = await installFixture(page);
  const destination = `/alerts-v2?incident=${INCIDENT_ID}`;
  await page.goto(destination);
  await expect(page).toHaveURL(/\/auth\?redirect=/);
  expect(new URL(page.url()).searchParams.get("redirect")).toBe(destination);
  expect(state.reads.some((read) => read.table === "v2_safety_incidents")).toBe(false);
  await page.getByLabel("אימייל").fill(user.email);
  await page.getByLabel("סיסמה").fill("Synthetic123!");
  await page.getByRole("button", { name: "התחבר", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/alerts-v2\\?incident=${INCIDENT_ID}$`));
  await expect(current(page)).toContainText("סיכום סינתטי עדכני של האירוע.");
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/alerts-v2\\?incident=${INCIDENT_ID}$`));
  await expect(details(page)).toContainText(CHILD_NAME);
  await assertFixtureClean(state);
});

for (const redirect of [
  { name: "protocol-relative", target: "//outside.example.invalid/collect" },
  { name: "normalized current-directory", target: "/.//outside.example.invalid" },
  { name: "normalized parent-directory", target: "/..//outside.example.invalid" },
]) {
  test(`a ${redirect.name} external login redirect is rejected and stays in the local guardian app`, async ({ page }) => {
    const state = await installFixture(page);
    const externalRequests: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).hostname === "outside.example.invalid") externalRequests.push(request.url());
    });
    await page.goto(`/auth?redirect=${encodeURIComponent(redirect.target)}`);
    const localOrigin = new URL(page.url()).origin;
    await page.getByLabel("אימייל").fill(user.email);
    await page.getByLabel("סיסמה").fill("Synthetic123!");
    await page.getByRole("button", { name: "התחבר", exact: true }).click();
    await expect(page).toHaveURL(`${localOrigin}/home-v2`);
    await page.waitForLoadState("networkidle");
    expect(new URL(page.url()).origin).toBe(localOrigin);
    expect(externalRequests).toEqual([]);
    await assertFixtureClean(state);
  });
}
