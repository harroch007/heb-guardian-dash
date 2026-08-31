import { isUuid, requireDevice, serviceClient } from "../_shared/auth.ts";
import {
  handleError,
  HttpError,
  jsonResponse,
  readJsonObject,
} from "../_shared/http.ts";

const oemStates = new Set([
  "not_applicable",
  "confirmed",
  "review_required",
]);
const reportReasons = new Set([
  "runtime_started",
  "periodic",
  "capability_changed",
  "boot",
  "guardian_requested",
]);
const capabilityStates = new Set([
  "satisfied",
  "missing",
  "user_review_required",
  "not_applicable",
]);

Deno.serve(async (request) => {
  try {
    const body = await readJsonObject(request, 24_576);
    validateHealthReport(body);

    const client = serviceClient();
    const device = await requireDevice(request, client);
    const observedAt = new Date(String(body.observed_at));

    const { data, error } = await client.rpc(
      "v2_report_device_health_v2_service",
      {
        target_device_id: device.deviceId,
        target_event_key: body.event_key,
        target_contract_version: body.contract_version,
        target_boot_session_id: body.boot_session_id,
        target_sequence_no: body.sequence_no,
        target_report_reason: body.report_reason,
        target_expected_interval_seconds: body.expected_interval_seconds,
        target_capture_ready: body.capture_ready,
        target_product_ready: body.product_ready,
        target_accessibility_enabled: body.accessibility_enabled,
        target_notification_listener_enabled:
          body.notification_listener_enabled,
        target_battery_optimization_exempt:
          body.battery_optimization_exempt,
        target_oem_autostart_state: body.oem_autostart_state,
        target_degraded_reasons: body.degraded_reasons,
        target_observed_at: observedAt.toISOString(),
        target_app_version: body.app_version,
        target_battery_level_percent: body.battery_level_percent,
        target_capabilities: body.capabilities,
      },
    );
    if (error) {
      if (error.code === "23505") {
        throw new HttpError(409, "heartbeat_idempotency_conflict");
      }
      throw error;
    }

    const result = data?.[0];
    if (!result) throw new Error("missing_health_result");
    return jsonResponse(200, {
      accepted: result.accepted,
      duplicate: result.duplicate,
      affects_current_state: result.affects_current_state,
      monitoring_state: result.monitoring_state,
      state_version: result.state_version,
    });
  } catch (error) {
    return handleError(error);
  }
});

function validateHealthReport(body: Record<string, unknown>): void {
  if (
    !isUuid(body.event_key) ||
    Number(body.contract_version) !== 2 ||
    !isUuid(body.boot_session_id) ||
    !Number.isSafeInteger(body.sequence_no) ||
    Number(body.sequence_no) < 1 ||
    typeof body.report_reason !== "string" ||
    !reportReasons.has(body.report_reason) ||
    !Number.isInteger(body.expected_interval_seconds) ||
    Number(body.expected_interval_seconds) < 60 ||
    Number(body.expected_interval_seconds) > 3600 ||
    typeof body.capture_ready !== "boolean" ||
    typeof body.product_ready !== "boolean" ||
    typeof body.accessibility_enabled !== "boolean" ||
    typeof body.notification_listener_enabled !== "boolean" ||
    typeof body.battery_optimization_exempt !== "boolean" ||
    typeof body.oem_autostart_state !== "string" ||
    !oemStates.has(body.oem_autostart_state) ||
    typeof body.app_version !== "string" ||
    body.app_version.length < 1 ||
    body.app_version.length > 80 ||
    (
      body.battery_level_percent !== undefined &&
      (
        !Number.isInteger(body.battery_level_percent) ||
        Number(body.battery_level_percent) < 0 ||
        Number(body.battery_level_percent) > 100
      )
    ) ||
    !Array.isArray(body.degraded_reasons) ||
    body.degraded_reasons.length > 16 ||
    body.degraded_reasons.some((reason) =>
      typeof reason !== "string" || reason.length > 80
    ) ||
    !isCapabilityObject(body.capabilities)
  ) {
    throw new HttpError(400, "invalid_health_report");
  }

  const observedAt = new Date(String(body.observed_at));
  if (Number.isNaN(observedAt.getTime())) {
    throw new HttpError(400, "invalid_observed_at");
  }
}

function isCapabilityObject(value: unknown): boolean {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return false;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0 || entries.length > 20) return false;

  return entries.every(([key, raw]) => {
    if (
      key.length < 1 ||
      key.length > 80 ||
      raw === null ||
      typeof raw !== "object" ||
      Array.isArray(raw)
    ) {
      return false;
    }
    const capability = raw as Record<string, unknown>;
    return typeof capability.state === "string" &&
      capabilityStates.has(capability.state) &&
      typeof capability.required_for_capture === "boolean" &&
      typeof capability.required_for_product === "boolean";
  });
}
