import {
  isUuid,
  requireDevice,
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
    const body = await readJsonObject(request, 2_048);
    if (
      !isUuid(body.command_id) ||
      (body.status !== "completed" && body.status !== "failed")
    ) {
      throw new HttpError(400, "invalid_command_result");
    }

    const failureCode = typeof body.failure_code === "string"
      ? body.failure_code.slice(0, 80)
      : null;
    const client = serviceClient();
    const device = await requireDevice(request, client);
    const { data, error } = await client.rpc(
      "v2_finish_device_command_service",
      {
        target_device_id: device.deviceId,
        target_command_id: body.command_id,
        target_status: body.status,
        target_failure_code: failureCode,
      },
    );
    if (error) throw error;
    if (data !== true) {
      throw new HttpError(409, "command_not_claimed");
    }

    return jsonResponse(200, { updated: true });
  } catch (error) {
    return handleError(error);
  }
});
