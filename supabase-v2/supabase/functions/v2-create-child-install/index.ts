import {
  hashDeviceCredential,
  isUuid,
  randomDeviceCredential,
  requireGuardian,
  serviceClient,
} from "../_shared/auth.ts";
import {
  handleError,
  HttpError,
  jsonResponse,
  readJsonObject,
} from "../_shared/http.ts";
import { webCorsPreflight, withWebCors } from "../_shared/web_cors.ts";
import { childInstallActivationUrl } from "../_shared/child_install_links.ts";

Deno.serve(async (request) => {
  const preflight = webCorsPreflight(request);
  if (preflight) return preflight;

  try {
    const body = await readJsonObject(request, 1_024);
    if (!isUuid(body.child_id)) {
      throw new HttpError(400, "invalid_child_id");
    }

    const client = serviceClient();
    const guardian = await requireGuardian(request, client);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
      ?.replace(/\/+$/, "");
    if (!supabaseUrl?.startsWith("https://")) {
      throw new Error("missing_supabase_url");
    }

    const sessionId = crypto.randomUUID();
    const activationToken = randomDeviceCredential();
    const activationTokenHash = await hashDeviceCredential(activationToken);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1_000);

    const { data, error } = await client.rpc(
      "v2_create_child_install_session_service",
      {
        actor_user_id: guardian.id,
        target_session_id: sessionId,
        target_child_id: body.child_id,
        new_activation_token_hash: activationTokenHash,
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
    if (!result) throw new Error("missing_child_install_session");

    const activationUrl = childInstallActivationUrl(
      supabaseUrl,
      activationToken,
    );

    return withWebCors(
      request,
      jsonResponse(201, {
        install_session_id: result.install_session_id,
        expires_at: result.expires_at,
        activation_url: activationUrl,
        qr_payload: activationUrl,
      }),
    );
  } catch (error) {
    return withWebCors(request, handleError(error));
  }
});
