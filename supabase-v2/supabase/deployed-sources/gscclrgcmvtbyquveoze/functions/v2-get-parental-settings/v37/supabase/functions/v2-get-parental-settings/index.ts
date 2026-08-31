import { requireDevice, serviceClient } from "../_shared/device_auth.ts";
import { handleError, jsonResponse, readJsonObject } from "../_shared/http.ts";
import { settingsRevision, withP0PrivateTextActivation } from "./contract.ts";

Deno.serve(async (request) => {
  try {
    await readJsonObject(request, 256);
    const client = serviceClient();
    const device = await requireDevice(request, client);
    const { data, error } = await client.rpc(
      "v2_parental_settings_snapshot_service",
      { target_device_id: device.deviceId },
    );
    if (error) throw error;

    let activation: unknown = null;
    const revision = settingsRevision(data);
    if (revision !== null) {
      const activationResult = await client.rpc(
        "v2_p0_private_text_activation_snapshot_service",
        {
          target_device_id: device.deviceId,
          target_settings_revision: revision,
        },
      );
      if (activationResult.error) {
        console.warn("p0_private_text_activation_unavailable");
      } else {
        activation = activationResult.data;
      }
    }

    return jsonResponse(200, {
      settings: withP0PrivateTextActivation(data, activation),
    });
  } catch (error) {
    return handleError(error);
  }
});
