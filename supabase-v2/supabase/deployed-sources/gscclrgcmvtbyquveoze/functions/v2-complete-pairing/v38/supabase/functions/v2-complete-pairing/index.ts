import {
  hashDeviceCredential,
  isUuid,
  randomDeviceCredential,
  requiredString,
  serviceClient,
} from "../_shared/auth.ts";
import {
  handleError,
  HttpError,
  jsonResponse,
  readJsonObject,
} from "../_shared/http.ts";
import { pairingCodeHash } from "../_shared/pairing.ts";

Deno.serve(async (request) => {
  try {
    const body = await readJsonObject(request, 4_096);
    if (!isUuid(body.pairing_id) || !isUuid(body.installation_id)) {
      throw new HttpError(400, "invalid_pairing_request");
    }
    const code = requiredString(body.pairing_code, "invalid_pairing_code", 8);
    const appVersion = requiredString(body.app_version, "invalid_app_version", 80);
    const contractVersion = Number(body.capture_contract_version);
    if (!Number.isInteger(contractVersion) || contractVersion < 2 || contractVersion > 32) {
      throw new HttpError(400, "invalid_capture_contract_version");
    }

    const credential = randomDeviceCredential();
    const credentialHash = await hashDeviceCredential(credential);
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1_000);
    const codeHash = await pairingCodeHash(body.pairing_id, code);
    const client = serviceClient();
    const { data, error } = await client.rpc("v2_complete_pairing_service", {
      target_pairing_id: body.pairing_id,
      supplied_code_hash: codeHash,
      target_installation_id: body.installation_id,
      target_app_version: appVersion,
      target_capture_contract_version: contractVersion,
      target_manufacturer: typeof body.manufacturer === "string"
        ? body.manufacturer.slice(0, 120)
        : "",
      target_model: typeof body.model === "string"
        ? body.model.slice(0, 120)
        : "",
      new_credential_hash: credentialHash,
      credential_expires_at: expiresAt.toISOString(),
    });
    if (error) throw error;

    const result = data?.[0];
    if (!result) {
      throw new HttpError(401, "invalid_or_expired_pairing");
    }
    return jsonResponse(201, {
      device_id: result.device_id,
      child_id: result.child_id,
      device_credential: credential,
      credential_key_version: result.credential_key_version,
      credential_expires_at: result.credential_expiry,
    });
  } catch (error) {
    return handleError(error);
  }
});
