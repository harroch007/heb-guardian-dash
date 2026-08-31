import { requireDevice, serviceClient } from "../_shared/auth.ts";
import { handleError, jsonResponse, readJsonObject } from "../_shared/http.ts";

Deno.serve(async (request) => {
  try {
    const client = serviceClient();
    await requireDevice(request, client);
    await readJsonObject(request, 64);
    const { data, error } = await client.rpc(
      "v2_get_active_incident_encryption_key_service",
    );
    if (error) throw error;
    const key = data?.[0];
    if (!key) throw new Error("missing_active_encryption_key");
    const acceptsUntil = new Date(key.accepts_until);
    if (!Number.isFinite(acceptsUntil.getTime())) {
      throw new Error("invalid_encryption_key_acceptance_deadline");
    }

    return jsonResponse(200, {
      ...key,
      accepts_until: acceptsUntil.toISOString(),
    });
  } catch (error) {
    return handleError(error);
  }
});
