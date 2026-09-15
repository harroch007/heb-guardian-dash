import { requireDevice, serviceClient } from "../_shared/device_auth.ts";
import {
  handleError,
  HttpError,
  jsonResponse,
  readJsonObject,
} from "../_shared/http.ts";
import {
  parseModeration,
  providerDenial,
  providerText,
  readConfig,
  record,
  validateBatch,
} from "./contract.ts";

Deno.serve(async (request: Request) => {
  const started = performance.now();
  let client: ReturnType<typeof serviceClient> | undefined;
  let lease: string | undefined;
  let deviceId: string | undefined;
  let requestId: string | undefined;
  try {
    client = serviceClient();
    if (Deno.env.get("KIPPY_MODERATION_ENABLED") === "false") {
      throw new HttpError(503, "moderation_disabled");
    }
    if (
      Deno.env.get("KIPPY_OPENAI_ZDR_APPROVED") !== "true" &&
      Deno.env.get("KIPPY_OPENAI_STANDARD_RETENTION_ACKNOWLEDGED") !== "true"
    ) {
      throw new HttpError(
        503,
        "openai_data_retention_acknowledgement_required",
      );
    }
    const device = await requireDevice(request, client);
    deviceId = device.deviceId;
    const config = readConfig((key) => Deno.env.get(key));
    const batch = validateBatch(
      await readJsonObject(request, config.maxBytes),
      config,
    );
    requestId = batch.request_id;
    const key = Deno.env.get("OPEN_AI_KEY");
    const hashKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!key || !hashKey) {
      throw new HttpError(503, "moderation_configuration_incomplete");
    }
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(hashKey),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const digest = new Uint8Array(
      await crypto.subtle.sign(
        "HMAC",
        cryptoKey,
        new TextEncoder().encode(JSON.stringify(batch)),
      ),
    );
    const requestHash = Array.from(
      digest,
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join("");
    const { data, error } = await client.rpc(
      "v2_begin_moderation_batch_service",
      {
        target_device_id: deviceId,
        target_request_id: requestId,
        target_request_hash: requestHash,
        target_conversation_ref: batch.conversation_ref,
        target_source_revision: batch.source_revision,
      },
    );
    if (error?.code === "23505") {
      throw new HttpError(409, "moderation_idempotency_conflict");
    }
    if (error) throw new HttpError(503, "moderation_receipt_unavailable");
    const receipt = data?.[0];
    if (receipt?.receipt_state === "completed" && record(receipt.response)) {
      return jsonResponse(200, { ...receipt.response, cached: true });
    }
    if (receipt?.receipt_state === "busy") {
      throw new HttpError(425, "moderation_in_progress");
    }
    if (
      receipt?.receipt_state !== "leased" ||
      typeof receipt.lease_token !== "string"
    ) throw new HttpError(503, "moderation_receipt_invalid");
    lease = receipt.lease_token;
    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/moderations", {
        method: "POST",
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: config.model,
          input: providerText(batch),
        }),
        signal: AbortSignal.timeout(config.timeoutMs),
      });
    } catch {
      throw new HttpError(503, "moderation_provider_unavailable");
    }
    if (!response.ok) {
      // Prose is consumed only by a fixed-enum classifier in memory; never
      // reaches persistence, logs, or the device.
      let denialBody: unknown;
      try {
        denialBody = await response.json();
      } catch {
        denialBody = undefined;
      }
      const denial = providerDenial(
        response.status,
        denialBody,
        Deno.env.get("KIPPY_MODERATION_EXPECTED_PROJECT_ID") ??
          "proj_tCm9vjogHHQt5VkVe3F7x2YL",
      );
      console.warn("moderation_provider_denial", {
        status: response.status,
        code: denial.code,
        type: denial.type,
        classification: denial.classification,
        project: denial.project,
        shape: denial.shape,
        vocabulary: denial.vocabulary,
      });
      throw new HttpError(
        response.status === 429 ? 429 : 502,
        denial.applicationCode,
      );
    }
    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch {
      throw new HttpError(502, "invalid_moderation_response");
    }
    const analysis = parseModeration(parsed, config);
    const result = {
      request_id: batch.request_id,
      source_revision: batch.source_revision,
      ...analysis,
      policy_version: config.policyVersion,
      elapsed_ms: Math.max(0, Math.round(performance.now() - started)),
      cached: false,
    };
    const finalized = await client.rpc("v2_complete_moderation_batch_service", {
      target_device_id: deviceId,
      target_request_id: requestId,
      target_lease_token: lease,
      target_response: result,
    });
    if (finalized.error || finalized.data !== true) {
      throw new HttpError(503, "moderation_receipt_finalize_failed");
    }
    lease = undefined;
    return jsonResponse(200, result);
  } catch (error) {
    // Only opaque error codes are returned/logged. Text, credentials and provider bodies never cross this path.
    const errorCode = error instanceof HttpError
      ? error.code
      : "internal_error";
    console.warn("moderation_failure", { code: errorCode });
    if (client && lease && deviceId && requestId) {
      try {
        await client.rpc("v2_release_moderation_batch_service", {
          target_device_id: deviceId,
          target_request_id: requestId,
          target_lease_token: lease,
          target_error_code: errorCode,
        });
      } catch { /* lease expires independently */ }
    }
    return handleError(error);
  }
});
