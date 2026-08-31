import * as webpush from "jsr:@negrel/webpush@0.5.0";
import { serviceClient } from "../_shared/auth.ts";
import { jsonResponse } from "../_shared/http.ts";
import {
  classifyPushHttpStatus,
  type PushTarget,
  type PushTargetResult,
} from "../_shared/push_delivery.ts";
import {
  buildMonitoringPushPayload,
  calculateMonitoringProviderTtl,
  callProviderIfMonitoringDeliveryAlive,
  constantTimeEqual,
  monitoringPushDeliveryEnabled,
  normalizeMonitoringPushClaim,
  validPushContact,
} from "./contract.ts";

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "method_not_allowed" });
  }
  if (
    !monitoringPushDeliveryEnabled(
      Deno.env.get("KIPPY_MONITORING_PUSH_DELIVERY_ENABLED"),
    )
  ) {
    return jsonResponse(503, { error: "monitoring_push_delivery_disabled" });
  }

  const triggerToken = request.headers.get("x-kippy-monitoring-push-token") ??
    "";
  const configuredTriggerToken =
    Deno.env.get("KIPPY_MONITORING_PUSH_WORKER_TRIGGER_TOKEN") ?? "";
  if (
    triggerToken.length < 32 ||
    triggerToken.length > 256 ||
    configuredTriggerToken.length < 32 ||
    configuredTriggerToken.length > 256 ||
    !constantTimeEqual(triggerToken, configuredTriggerToken)
  ) {
    return jsonResponse(401, { error: "invalid_monitoring_push_trigger" });
  }

  const databaseCapabilityToken =
    Deno.env.get("KIPPY_MONITORING_PUSH_DB_CAPABILITY_TOKEN") ?? "";
  if (
    databaseCapabilityToken.length < 32 ||
    databaseCapabilityToken.length > 256
  ) {
    return jsonResponse(503, {
      error: "monitoring_push_configuration_incomplete",
    });
  }

  let applicationServer: webpush.ApplicationServer;
  try {
    applicationServer = await readApplicationServer();
  } catch {
    return jsonResponse(503, {
      error: "monitoring_push_configuration_incomplete",
    });
  }

  const client = serviceClient();
  const workerId = crypto.randomUUID();
  const { data, error } = await client.rpc(
    "v2_claim_monitoring_delivery_service",
    {
      target_capability_token: databaseCapabilityToken,
      target_worker_id: workerId,
      target_lease_seconds: 120,
    },
  );
  if (error) {
    console.error("monitoring_push_claim_failed", {
      code: "database_error",
    });
    return jsonResponse(503, {
      error: "monitoring_push_claim_failed",
      retryable: true,
    });
  }
  if (!Array.isArray(data) || data.length === 0) {
    return jsonResponse(200, {
      processed: false,
      reason: "no_work",
    });
  }

  let claim: ReturnType<typeof normalizeMonitoringPushClaim>;
  try {
    claim = normalizeMonitoringPushClaim(data[0]);
  } catch {
    console.error("monitoring_push_claim_failed", {
      code: "claim_contract_mismatch",
    });
    return jsonResponse(503, {
      error: "monitoring_push_claim_contract_mismatch",
      retryable: true,
    });
  }

  const payload = JSON.stringify(buildMonitoringPushPayload(claim));
  const preflightTtl = calculateMonitoringProviderTtl(claim.expires_at);
  const results: PushTargetResult[] = preflightTtl === null
    ? claim.targets.map(expiredTargetResult)
    : await Promise.all(
      claim.targets.map((target) =>
        deliverToTarget(
          applicationServer,
          target,
          payload,
          claim.expires_at,
        )
      ),
    );

  const { data: completed, error: completionError } = await client.rpc(
    "v2_complete_monitoring_delivery_service",
    {
      target_capability_token: databaseCapabilityToken,
      target_worker_id: workerId,
      target_lease_token: claim.lease_token,
      target_delivery_id: claim.delivery_id,
      target_results: results,
    },
  );
  if (
    completionError ||
    !Array.isArray(completed) ||
    completed.length !== 1 ||
    !validCompletionRow(completed[0])
  ) {
    console.error("monitoring_push_completion_failed", {
      code: completionError ? "database_error" : "completion_contract_mismatch",
    });
    return jsonResponse(503, {
      error: "monitoring_push_completion_failed",
      retryable: true,
    });
  }

  return jsonResponse(200, {
    processed: true,
    status: completed[0].delivery_status,
    provider_accepted_count: Number(
      completed[0].provider_accepted_count,
    ),
    invalid_target_count: Number(completed[0].invalid_target_count),
    retry_scheduled: completed[0].retry_scheduled,
    suppression_reason: completed[0].suppression_reason,
  });
});

async function readApplicationServer(): Promise<webpush.ApplicationServer> {
  const rawKeys = Deno.env.get("KIPPY_WEB_PUSH_VAPID_KEYS_JWK") ?? "";
  const configuredPublicKey = Deno.env.get("KIPPY_WEB_PUSH_PUBLIC_KEY") ?? "";
  const contactInformation = Deno.env.get("KIPPY_WEB_PUSH_CONTACT") ?? "";
  if (
    rawKeys.length < 80 ||
    rawKeys.length > 8192 ||
    !/^[A-Za-z0-9_-]{80,120}$/.test(configuredPublicKey) ||
    !validPushContact(contactInformation)
  ) {
    throw new Error("invalid_push_configuration");
  }

  const exportedKeys = JSON.parse(rawKeys);
  const vapidKeys = await webpush.importVapidKeys(exportedKeys);
  const actualPublicKey = await webpush.exportApplicationServerKey(vapidKeys);
  if (!constantTimeEqual(configuredPublicKey, actualPublicKey)) {
    throw new Error("vapid_public_key_mismatch");
  }
  return await webpush.ApplicationServer.new({
    contactInformation,
    vapidKeys,
  });
}

async function deliverToTarget(
  applicationServer: webpush.ApplicationServer,
  target: PushTarget,
  payload: string,
  expiresAt: string,
): Promise<PushTargetResult> {
  try {
    const providerCall = await callProviderIfMonitoringDeliveryAlive(
      expiresAt,
      async (ttl) => {
        const subscriber = applicationServer.subscribe({
          endpoint: target.endpoint,
          keys: {
            p256dh: target.p256dh,
            auth: target.auth,
          },
        });
        await subscriber.pushTextMessage(payload, { ttl });
        return 201;
      },
    );
    if (!providerCall.called) return expiredTargetResult(target);
    return classifyPushHttpStatus(target.endpoint_id, providerCall.result);
  } catch (error) {
    const status = error instanceof webpush.PushMessageError
      ? error.response.status
      : null;
    return classifyPushHttpStatus(target.endpoint_id, status);
  }
}

function expiredTargetResult(target: PushTarget): PushTargetResult {
  return {
    endpoint_id: target.endpoint_id,
    outcome: "failed",
    error_code: "delivery_expired",
  };
}

function validCompletionRow(value: unknown): value is {
  delivery_status: string;
  provider_accepted_count: number;
  invalid_target_count: number;
  retry_scheduled: boolean;
  suppression_reason: string | null;
} {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const row = value as Record<string, unknown>;
  return typeof row.delivery_status === "string" &&
    Number.isInteger(Number(row.provider_accepted_count)) &&
    Number(row.provider_accepted_count) >= 0 &&
    Number.isInteger(Number(row.invalid_target_count)) &&
    Number(row.invalid_target_count) >= 0 &&
    typeof row.retry_scheduled === "boolean" &&
    (row.suppression_reason === null ||
      typeof row.suppression_reason === "string");
}
