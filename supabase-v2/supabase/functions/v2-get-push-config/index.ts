import { requireGuardian, serviceClient } from "../_shared/auth.ts";
import { handleError, HttpError, jsonResponse } from "../_shared/http.ts";
import { importVerifiedVapidRuntimeConfiguration } from "../_shared/vapid_config.ts";
import { webCorsPreflight, withWebCors } from "../_shared/web_cors.ts";

Deno.serve(async (request) => {
  const preflight = webCorsPreflight(request);
  if (preflight) return preflight;

  try {
    if (request.method !== "POST") {
      throw new HttpError(405, "method_not_allowed");
    }
    const client = serviceClient();
    await requireGuardian(request, client);

    let applicationServerKey: string;
    try {
      const configuration = await importVerifiedVapidRuntimeConfiguration(
        Deno.env.get("KIPPY_WEB_PUSH_VAPID_KEYS_JWK") ?? "",
        Deno.env.get("KIPPY_WEB_PUSH_PUBLIC_KEY") ?? "",
        Deno.env.get("KIPPY_WEB_PUSH_CONTACT") ?? "",
      );
      applicationServerKey = configuration.publicKey;
    } catch {
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
