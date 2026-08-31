import * as webpush from "jsr:@negrel/webpush@0.5.0";
import { serviceClient } from "../_shared/auth.ts";
import { jsonResponse } from "../_shared/http.ts";
import {
  buildGuardianPushPayload,
  classifyPushHttpStatus,
  normalizePushClaim,
  type PushTarget,
  type PushTargetResult,
} from "../_shared/push_delivery.ts";

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "method_not_allowed" });
  }
  if (Deno.env.get("KIPPY_PUSH_DELIVERY_ENABLED") !== "true") {
    return jsonResponse(503, { error: "push_delivery_disabled" });
  }

  const triggerToken = request.headers.get("x-kippy-push-token") ?? "";
  const configuredTriggerToken =
    Deno.env.get("KIPPY_PUSH_WORKER_TRIGGER_TOKEN") ?? "";
  if (
    triggerToken.length < 32 ||
    triggerToken.length > 256 ||
    configuredTriggerToken.length < 32 ||
    !constantTimeEqual(triggerToken, configuredTriggerToken)
  ) {
    return jsonResponse(401, { error: "invalid_push_trigger" });
  }

  const databaseCapabilityToken =
    Deno.env.get("KIPPY_PUSH_DB_CAPABILITY_TOKEN") ?? "";
  if (
    databaseCapabilityToken.length < 32 ||
    databaseCapabilityToken.length > 256
  ) {
    return jsonResponse(503, {
      error: "push_configuration_incomplete",
    });
  }

  let applicationServer: webpush.ApplicationServer;
  try {
    applicationServer = await readApplicationServer();
  } catch {
    return jsonResponse(503, {
      error: "push_configuration_incomplete",
    });
  }

  const client = serviceClient();
  const workerId = crypto.randomUUID();
  const { data, error } = await client.rpc(
    "v2_claim_push_delivery_service",
    {
      target_capability_token: databaseCapabilityToken,
      target_worker_id: workerId,
      target_lease_seconds: 120,
    },
  );
  if (error) {
    console.error("push_claim_failed", { code: "database_error" });
    return jsonResponse(503, {
      error: "push_claim_failed",
      retryable: true,
    });
  }
  if (!Array.isArray(data) || data.length === 0) {
    return jsonResponse(200, {
      processed: false,
      reason: "no_work",
    });
  }

  let claim: ReturnType<typeof normalizePushClaim>;
  try {
    claim = normalizePushClaim(data[0]);
  } catch {
    console.error("push_claim_failed", {
      code: "claim_contract_mismatch",
    });
    return jsonResponse(503, {
      error: "push_claim_contract_mismatch",
      retryable: true,
    });
  }

  const payload = JSON.stringify(
    buildGuardianPushPayload(claim.incident_id),
  );
  const results = await Promise.all(
    claim.targets.map((target) =>
      deliverToTarget(applicationServer, target, payload)
    ),
  );

  const { data: completed, error: completionError } = await client.rpc(
    "v2_complete_push_delivery_service",
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
    completed.length !== 1
  ) {
    console.error("push_completion_failed", {
      code: completionError
        ? "database_error"
        : "completion_contract_mismatch",
    });
    return jsonResponse(503, {
      error: "push_completion_failed",
      retryable: true,
    });
  }

  return jsonResponse(200, {
    processed: true,
    status: completed[0].delivery_status,
    sent_target_count: Number(
      completed[0].sent_target_count ?? 0,
    ),
    invalid_target_count: Number(
      completed[0].invalid_target_count ?? 0,
    ),
    retry_scheduled:
      completed[0].retry_scheduled === true,
  });
});

async function readApplicationServer(): Promise<webpush.ApplicationServer> {
  const rawKeys = Deno.env.get("KIPPY_WEB_PUSH_VAPID_KEYS_JWK") ?? "";
  const configuredPublicKey =
    Deno.env.get("KIPPY_WEB_PUSH_PUBLIC_KEY") ?? "";
  const contactInformation =
    Deno.env.get("KIPPY_WEB_PUSH_CONTACT") ?? "";
  if (
    rawKeys.length < 80 ||
    rawKeys.length > 8192 ||
    !/^[A-Za-z0-9_-]{80,120}$/.test(configuredPublicKey) ||
    !validContact(contactInformation)
  ) {
    throw new Error("invalid_push_configuration");
  }

  const exportedKeys = JSON.parse(rawKeys);
  const vapidKeys = await webpush.importVapidKeys(exportedKeys);
  const actualPublicKey = await webpush.exportApplicationServerKey(
    vapidKeys,
  );
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
): Promise<PushTargetResult> {
  try {
    const subscriber = applicationServer.subscribe({
      endpoint: target.endpoint,
      keys: {
        p256dh: target.p256dh,
        auth: target.auth,
      },
    });
    await subscriber.pushTextMessage(payload, {
      ttl: 86400,
    });
    return classifyPushHttpStatus(target.endpoint_id, 201);
  } catch (error) {
    const status = error instanceof webpush.PushMessageError
      ? error.response.status
      : null;
    return classifyPushHttpStatus(target.endpoint_id, status);
  }
}

function validContact(value: string): boolean {
  if (value.length < 8 || value.length > 320) return false;
  if (value.startsWith("mailto:")) {
    return /^[^\s@]+@[^\s@]+[.][^\s@]+$/.test(value.slice(7));
  }
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function constantTimeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  leftBytes.fill(0);
  rightBytes.fill(0);
  return difference === 0;
}
