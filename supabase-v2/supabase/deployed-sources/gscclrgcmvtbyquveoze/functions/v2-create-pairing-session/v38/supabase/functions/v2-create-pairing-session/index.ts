import {
  isUuid,
  requireGuardian,
  serviceClient,
} from "../_shared/auth.ts";
import {
  handleError,
  HttpError,
  jsonResponse,
  readJsonObject,
} from "../_shared/http.ts";
import {
  pairingCodeHash,
  randomPairingCode,
} from "../_shared/pairing.ts";

Deno.serve(async (request) => {
  try {
    const body = await readJsonObject(request, 1_024);
    if (!isUuid(body.child_id)) {
      throw new HttpError(400, "invalid_child_id");
    }

    const client = serviceClient();
    const guardian = await requireGuardian(request, client);
    const pairingId = crypto.randomUUID();
    const code = randomPairingCode();
    const codeHash = await pairingCodeHash(pairingId, code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1_000);

    const { data, error } = await client.rpc(
      "v2_create_pairing_session_service",
      {
        actor_user_id: guardian.id,
        target_pairing_id: pairingId,
        target_child_id: body.child_id,
        new_code_hash: codeHash,
        target_expires_at: expiresAt.toISOString(),
      },
    );
    if (error) {
      if (error.code === "42501") {
        throw new HttpError(403, "guardian_not_authorized");
      }
      throw error;
    }

    const result = data?.[0];
    if (!result) throw new Error("missing_pairing_result");
    return jsonResponse(201, {
      pairing_id: result.pairing_id,
      pairing_code: code,
      expires_at: result.expires_at,
      qr_payload: `kippy-v2://pair/${result.pairing_id}/${code}`,
    });
  } catch (error) {
    return handleError(error);
  }
});
