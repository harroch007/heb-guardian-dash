import { createClient } from "npm:@supabase/supabase-js@2.49.8";
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

Deno.serve(async (request) => {
  try {
    const body = await readJsonObject(request, 4_096);
    const email = normalizeEmail(
      requiredString(body.email, "invalid_email", 254),
    );
    const otp = requiredString(body.otp, "invalid_otp", 8);
    if (!/^\d{6,8}$/.test(otp) || !isUuid(body.installation_id)) {
      throw new HttpError(400, "invalid_child_install_request");
    }

    const appVersion = requiredString(
      body.app_version,
      "invalid_app_version",
      80,
    );
    const contractVersion = Number(body.capture_contract_version);
    if (
      !Number.isInteger(contractVersion) ||
      contractVersion < 2 ||
      contractVersion > 32
    ) {
      throw new HttpError(400, "invalid_capture_contract_version");
    }

    const guardianUserId = await verifyGuardianOtp(email, otp);
    const client = serviceClient();
    const privacyProfile = await loadChildPrivacyProfile(
      client,
      guardianUserId,
    );
    const credential = randomDeviceCredential();
    const credentialHash = await hashDeviceCredential(credential);
    const credentialExpiresAt = new Date(
      Date.now() + 90 * 24 * 60 * 60 * 1_000,
    );

    const { data, error } = await client.rpc(
      "v2_complete_child_install_service",
      {
        actor_user_id: guardianUserId,
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
        credential_expires_at: credentialExpiresAt.toISOString(),
      },
    );
    if (error) {
      if (error.code === "23505") {
        throw new HttpError(409, "installation_already_assigned");
      }
      throw error;
    }

    const result = data?.[0];
    if (!result) {
      throw new HttpError(401, "install_session_expired_or_missing");
    }

    return jsonResponse(201, {
      device_id: result.device_id,
      child_id: result.child_id,
      device_credential: credential,
      credential_key_version: result.credential_key_version,
      credential_expires_at: new Date(result.credential_expiry).toISOString(),
      privacy_profile: {
        identity_version: privacyProfile.identityVersion,
        child_aliases: [privacyProfile.displayName],
        child_phone_numbers: [],
        child_email_addresses: [],
        expires_at: new Date(result.credential_expiry).toISOString(),
      },
    });
  } catch (error) {
    return handleError(error);
  }
});

async function loadChildPrivacyProfile(
  client: ReturnType<typeof serviceClient>,
  guardianUserId: string,
): Promise<{ displayName: string; identityVersion: number }> {
  const nowIso = new Date().toISOString();
  const { data: installSession, error: installError } = await client
    .from("v2_child_install_sessions")
    .select("child_id")
    .eq("created_by", guardianUserId)
    .eq("status", "activated")
    .gt("expires_at", nowIso)
    .order("activated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (installError) {
    throw installError;
  }
  if (!installSession?.child_id) {
    throw new HttpError(401, "install_session_expired_or_missing");
  }

  const { data: child, error: childError } = await client
    .from("v2_children")
    .select("display_name, updated_at")
    .eq("id", installSession.child_id)
    .eq("status", "active")
    .maybeSingle();
  if (childError) {
    throw childError;
  }

  const displayName = typeof child?.display_name === "string"
    ? child.display_name.trim()
    : "";
  const identityVersion = Date.parse(
    typeof child?.updated_at === "string" ? child.updated_at : "",
  );
  if (
    displayName.length === 0 ||
    displayName.length > 120 ||
    !Number.isSafeInteger(identityVersion) ||
    identityVersion <= 0
  ) {
    throw new Error("invalid_child_privacy_profile");
  }
  return { displayName, identityVersion };
}

async function verifyGuardianOtp(
  email: string,
  otp: string,
): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!supabaseUrl || !publishableKey) {
    throw new Error("missing_auth_configuration");
  }

  const authClient = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await authClient.auth.verifyOtp({
    email,
    token: otp,
    type: "email",
  });
  if (error || !data.user) {
    throw new HttpError(401, "invalid_or_expired_otp");
  }
  return data.user.id;
}

function normalizeEmail(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (
    normalized.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  ) {
    throw new HttpError(400, "invalid_email");
  }
  return normalized;
}
