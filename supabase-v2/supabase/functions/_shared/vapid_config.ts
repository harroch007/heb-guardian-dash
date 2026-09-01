import * as webpush from "jsr:@negrel/webpush@0.5.0";

export interface ValidatedVapidRuntimeConfiguration {
  rawKeysJwk: string;
  publicKey: string;
  contactInformation: string;
}

export interface ImportedVapidRuntimeConfiguration
  extends ValidatedVapidRuntimeConfiguration {
  vapidKeys: CryptoKeyPair;
}

const VAPID_PUBLIC_KEY = /^[A-Za-z0-9_-]{80,120}$/;

export function validateVapidRuntimeConfiguration(
  rawKeysJwk: string,
  publicKey: string,
  contactInformation: string,
): ValidatedVapidRuntimeConfiguration {
  if (
    rawKeysJwk.length < 80 ||
    rawKeysJwk.length > 8192 ||
    !VAPID_PUBLIC_KEY.test(publicKey) ||
    !validPushContact(contactInformation)
  ) {
    throw new Error("invalid_vapid_configuration");
  }

  return { rawKeysJwk, publicKey, contactInformation };
}

export function assertVapidPublicKeyMatches(
  configuredPublicKey: string,
  exportedPublicKey: string,
): void {
  if (
    !VAPID_PUBLIC_KEY.test(exportedPublicKey) ||
    !constantTimeEqual(configuredPublicKey, exportedPublicKey)
  ) {
    throw new Error("vapid_public_key_mismatch");
  }
}

export async function importVerifiedVapidRuntimeConfiguration(
  rawKeysJwk: string,
  publicKey: string,
  contactInformation: string,
): Promise<ImportedVapidRuntimeConfiguration> {
  const configuration = validateVapidRuntimeConfiguration(
    rawKeysJwk,
    publicKey,
    contactInformation,
  );
  const vapidKeys = await webpush.importVapidKeys(
    JSON.parse(configuration.rawKeysJwk),
  );
  const exportedPublicKey = await webpush.exportApplicationServerKey(vapidKeys);
  assertVapidPublicKeyMatches(configuration.publicKey, exportedPublicKey);
  return { ...configuration, vapidKeys };
}

export function constantTimeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  leftBytes.fill(0);
  rightBytes.fill(0);
  return difference === 0;
}

export function validPushContact(value: string): boolean {
  if (value.length < 8 || value.length > 320) return false;
  if (value.startsWith("mailto:")) {
    return /^[^\s@]+@[^\s@]+[.][^\s@]+$/.test(value.slice(7));
  }
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
