import {
  requireGuardian,
  serviceClient,
} from "../_shared/auth.ts";
import {
  handleError,
  HttpError,
  jsonResponse,
} from "../_shared/http.ts";
import {
  webCorsPreflight,
  withWebCors,
} from "../_shared/web_cors.ts";

Deno.serve(async (request) => {
  const preflight = webCorsPreflight(request);
  if (preflight) return preflight;

  try {
    if (request.method !== "POST") {
      throw new HttpError(405, "method_not_allowed");
    }
    const client = serviceClient();
    await requireGuardian(request, client);

    const applicationServerKey =
      Deno.env.get("KIPPY_WEB_PUSH_PUBLIC_KEY") ?? "";
    if (!/^[A-Za-z0-9_-]{80,120}$/.test(applicationServerKey)) {
      throw new HttpError(503, "push_configuration_incomplete");
    }

    return withWebCors(
      request,
      jsonResponse(200, {
        contract_version: 1,
        application_server_key: applicationServerKey,
        delivery_enabled:
          Deno.env.get("KIPPY_PUSH_DELIVERY_ENABLED") === "true",
      }),
    );
  } catch (error) {
    return withWebCors(request, handleError(error));
  }
});
