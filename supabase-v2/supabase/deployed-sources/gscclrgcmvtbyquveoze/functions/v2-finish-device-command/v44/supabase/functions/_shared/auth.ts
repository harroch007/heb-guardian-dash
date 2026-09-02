import { createClient, SupabaseClient, User } from "npm:@supabase/supabase-js@2.49.8";
import { HttpError } from "./http.ts";

export interface DeviceIdentity {
  deviceId: string;
  childId: string;
}

export function serviceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    throw new Error("missing_server_configuration");
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function requireGuardian(
  request: Request,
  client: SupabaseClient,
): Promise<User> {
  const token = bearerToken(request);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    throw new HttpError(401, "invalid_guardian_token");
  }
  return data.user;
}

export async function requireDevice(
  request: Request,
  client: SupabaseClient,
): Promise<DeviceIdentity> {
  const deviceId = request.headers.get("x-kippy-device-id");
  if (!isUuid(deviceId)) {
    throw new HttpError(401, "invalid_device_identity");
  }

  const token = bearerToken(request);
  if (token.length < 32 || token.length > 256) {
    throw new HttpError(401, "invalid_device_identity");
  }
  const credentialHash = await sha256Hex(token);

  const now = new Date().toISOString();
  const { data: credential, error: credentialError } = await client
    .from("v2_device_credentials")
    .select("device_id")
    .eq("device_id", deviceId)
    .eq("credential_hash", credentialHash)
    .is("revoked_at", null)
    .lte("valid_from", now)
    .gt("expires_at", now)
    .maybeSingle();

  if (credentialError || !credential) {
    throw new HttpError(401, "invalid_device_identity");
  }

  const { data: device, error: deviceError } = await client
    .from("v2_protected_devices")
    .select("id, child_id, status")
    .eq("id", deviceId)
    .in("status", ["active", "degraded"])
    .maybeSingle();

  if (deviceError || !device) {
    throw new HttpError(401, "invalid_device_identity");
  }

  return { deviceId: device.id, childId: device.child_id };
}

function bearerToken(request: Request): string {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer ([^\s]+)$/i.exec(authorization);
  if (!match) {
    throw new HttpError(401, "missing_bearer_token");
  }
  return match[1];
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(value);
}

export function requiredString(
  value: unknown,
  code: string,
  maxLength: number,
): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maxLength
  ) {
    throw new HttpError(400, code);
  }
  return value;
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function randomDeviceCredential(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export async function hashDeviceCredential(value: string): Promise<string> {
  return await sha256Hex(value);
}
