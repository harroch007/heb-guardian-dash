import {
  hashDeviceCredential,
  isUuid,
  randomDeviceCredential,
  requireGuardian,
  requiredString,
  serviceClient,
} from "../_shared/auth.ts";
import {
  handleError,
  HttpError,
  jsonResponse,
  readJsonObject,
} from "../_shared/http.ts";

Deno.serve(async (request) => {
  try {
    const body = await readJsonObject(request, 4_096);
    if (!isUuid(body.child_id) || !isUuid(body.installation_id)) {
      throw new HttpError(400, "invalid_device_registration");
    }

    const appVersion = requiredString(body.app_version, "invalid_app_version", 80);
    const contractVersion = Number(body.capture_contract_version);
    if (!Number.isInteger(contractVersion) || contractVersion < 2 || contractVersion > 32) {
      throw new HttpError(400, "invalid_capture_contract_version");
    }

    const manufacturer = typeof body.manufacturer === "string"
      ? body.manufacturer.slice(0, 120)
      : "";
    const model = typeof body.model === "string" ? body.model.slice(0, 120) : "";

    const client = serviceClient();
    const guardian = await requireGuardian(request, client);
    const credential = randomDeviceCredential();
    const credentialHash = await hashDeviceCredential(credential);
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1_000);

    const { data, error } = await client.rpc("v2_register_device_service", {
      actor_user_id: guardian.id,
      target_child_id: body.child_id,
      target_installation_id: body.installation_id,
      target_app_version: appVersion,
      target_capture_contract_version: contractVersion,
      target_manufacturer: manufacturer,
      target_model: model,
      new_credential_hash: credentialHash,
      credential_expires_at: expiresAt.toISOString(),
    });

    if (error) {
      if (error.code === "42501") {
        throw new HttpError(403, "guardian_not_authorized");
      }
      if (error.code === "23505") {
        throw new HttpError(409, "installation_already_assigned");
      }
      throw error;
    }

    const registration = data?.[0];
    if (!registration) {
      throw new Error("missing_registration_result");
    }

    return jsonResponse(201, {
      device_id: registration.device_id,
      device_credential: credential,
      credential_key_version: registration.credential_key_version,
      credential_expires_at: registration.credential_expiry,
    });
  } catch (error) {
    return handleError(error);
  }
});
