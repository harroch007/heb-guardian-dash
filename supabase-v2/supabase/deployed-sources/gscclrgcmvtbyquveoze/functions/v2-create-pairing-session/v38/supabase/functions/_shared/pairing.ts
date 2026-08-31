import { HttpError } from "./http.ts";

export async function pairingCodeHash(
  pairingId: string,
  code: string,
): Promise<string> {
  if (!/^\d{8}$/.test(code)) {
    throw new HttpError(400, "invalid_pairing_code");
  }
  const pepper = Deno.env.get("KIPPY_V2_PAIRING_PEPPER");
  if (!pepper || pepper.length < 32) {
    throw new Error("missing_pairing_pepper");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${pairingId}:${code}`),
  );
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function randomPairingCode(): string {
  const range = 100_000_000;
  const acceptedMaximum = Math.floor(0x1_0000_0000 / range) * range;
  const value = new Uint32Array(1);
  do {
    crypto.getRandomValues(value);
  } while (value[0] >= acceptedMaximum);
  return (value[0] % range).toString().padStart(8, "0");
}
