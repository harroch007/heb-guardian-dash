import { requireDevice, serviceClient } from "../_shared/auth.ts";
import {
  handleError,
  HttpError,
  jsonResponse,
  readJsonObject,
} from "../_shared/http.ts";

Deno.serve(async (request) => {
  try {
    const body = await readJsonObject(request, 1_024);
    const limit = body.limit === undefined ? 10 : Number(body.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
      throw new HttpError(400, "invalid_command_limit");
    }

    const client = serviceClient();
    const device = await requireDevice(request, client);
    const { data, error } = await client.rpc(
      "v2_claim_device_commands_service",
      {
        target_device_id: device.deviceId,
        requested_limit: limit,
      },
    );
    if (error) throw error;

    return jsonResponse(200, { commands: data ?? [] });
  } catch (error) {
    return handleError(error);
  }
});
