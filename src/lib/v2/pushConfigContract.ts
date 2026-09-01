export interface V2PushRuntimeConfig {
  contract_version: 1;
  application_server_key: string;
  delivery_enabled: boolean;
}

const VAPID_PUBLIC_KEY = /^[A-Za-z0-9_-]{80,120}$/;

export function normalizeV2PushRuntimeConfig(
  value: unknown,
): V2PushRuntimeConfig {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("invalid_v2_push_runtime_config");
  }
  const config = value as Record<string, unknown>;
  if (
    config.contract_version !== 1 ||
    typeof config.application_server_key !== "string" ||
    !VAPID_PUBLIC_KEY.test(config.application_server_key) ||
    typeof config.delivery_enabled !== "boolean"
  ) {
    throw new Error("invalid_v2_push_runtime_config");
  }
  decodeVapidApplicationServerKey(config.application_server_key);
  return {
    contract_version: 1,
    application_server_key: config.application_server_key,
    delivery_enabled: config.delivery_enabled,
  };
}

export function decodeVapidApplicationServerKey(value: string): Uint8Array {
  if (!VAPID_PUBLIC_KEY.test(value)) {
    throw new Error("invalid_v2_push_runtime_config");
  }
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const decoded = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = Uint8Array.from(
    decoded,
    (character) => character.charCodeAt(0),
  );
  if (bytes.length !== 65 || bytes[0] !== 4) {
    throw new Error("invalid_v2_push_runtime_config");
  }
  return bytes;
}

export function applicationServerKeysMatch(
  current: ArrayBuffer | null,
  configured: Uint8Array,
): boolean {
  if (current === null) return false;
  const currentBytes = new Uint8Array(current);
  if (currentBytes.length !== configured.length) return false;
  let difference = 0;
  for (let index = 0; index < currentBytes.length; index += 1) {
    difference |= currentBytes[index] ^ configured[index];
  }
  return difference === 0;
}
