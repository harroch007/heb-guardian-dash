import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// RFC 8291 Web Push Encryption Implementation
// ============================================================================

// Helper to get ArrayBuffer from Uint8Array (handles Deno's strict typing)
function toArrayBuffer(arr: Uint8Array): ArrayBuffer {
  return arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength) as ArrayBuffer;
}

// Base64URL decode helper
function base64UrlDecode(str: string): Uint8Array {
  const padded = str + "=".repeat((4 - (str.length % 4)) % 4);
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Base64URL encode helper
function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Concatenate Uint8Arrays
function concat(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// HKDF using Web Crypto
async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(ikm),
    { name: "HKDF" },
    false,
    ["deriveBits"]
  );
  
  const bits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: toArrayBuffer(salt),
      info: toArrayBuffer(info),
    },
    key,
    length * 8
  );
  
  return new Uint8Array(bits);
}

// Create info for HKDF as per RFC 8291
function createInfo(
  type: "aesgcm" | "nonce",
  context: Uint8Array
): Uint8Array {
  const encoder = new TextEncoder();
  const contentEncoding = encoder.encode("Content-Encoding: ");
  const typeBytes = encoder.encode(type);
  const nullByte = new Uint8Array([0]);
  
  return concat(contentEncoding, typeBytes, nullByte, context);
}

// Create context for key derivation as per RFC 8291
function createContext(
  clientPublicKey: Uint8Array,
  serverPublicKey: Uint8Array
): Uint8Array {
  const encoder = new TextEncoder();
  const label = encoder.encode("P-256");
  const nullByte = new Uint8Array([0]);
  
  const clientKeyLen = new Uint8Array([0, clientPublicKey.length]);
  const serverKeyLen = new Uint8Array([0, serverPublicKey.length]);
  
  return concat(
    label,
    nullByte,
    clientKeyLen,
    clientPublicKey,
    serverKeyLen,
    serverPublicKey
  );
}

// Encrypt payload using aes128gcm as per RFC 8291
async function encryptPayload(
  payload: string,
  p256dh: string,
  auth: string
): Promise<{ encrypted: Uint8Array; serverPublicKey: Uint8Array }> {
  const encoder = new TextEncoder();
  
  // Decode subscription keys
  const clientPublicKey = base64UrlDecode(p256dh);
  const authSecret = base64UrlDecode(auth);
  
  // Generate ephemeral server key pair
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );
  
  // Export server public key in uncompressed format
  const serverPublicKeyRaw = await crypto.subtle.exportKey(
    "raw",
    serverKeyPair.publicKey
  );
  const serverPublicKey = new Uint8Array(serverPublicKeyRaw);
  
  // Import client public key for ECDH
  const clientKey = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(clientPublicKey),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  
  // Perform ECDH to get shared secret
  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: clientKey },
    serverKeyPair.privateKey,
    256
  );
  const sharedSecret = new Uint8Array(sharedSecretBits);
  
  // Build auth_info for first HKDF (RFC 8291 Section 3.3)
  const authInfo = encoder.encode("WebPush: info\0");
  const authInfoFull = concat(authInfo, clientPublicKey, serverPublicKey);
  
  // First HKDF: IKM = shared_secret, salt = auth_secret -> PRK
  const prk = await hkdf(authSecret, sharedSecret, authInfoFull, 32);
  
  // Generate 16-byte random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  // Create context for content encryption
  const context = createContext(clientPublicKey, serverPublicKey);
  
  // Derive content encryption key (CEK) - 16 bytes for AES-128
  const cekInfo = createInfo("aesgcm", context);
  const cek = await hkdf(salt, prk, cekInfo, 16);
  
  // Derive nonce - 12 bytes
  const nonceInfo = createInfo("nonce", context);
  const nonce = await hkdf(salt, prk, nonceInfo, 12);
  
  // Pad the payload (RFC 8291 Section 4)
  const payloadBytes = encoder.encode(payload);
  const paddingLength = 0;
  const paddingLengthBytes = new Uint8Array([
    (paddingLength >> 8) & 0xff,
    paddingLength & 0xff,
  ]);
  const padding = new Uint8Array(paddingLength);
  const record = concat(paddingLengthBytes, padding, payloadBytes);
  
  // Import CEK for AES-GCM
  const aesKey = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(cek),
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  
  // Encrypt with AES-128-GCM
  const encryptedData = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(nonce) },
    aesKey,
    toArrayBuffer(record)
  );
  
  // Build the final encrypted content (RFC 8188)
  const recordSize = new Uint8Array([0, 0, 16, 0]); // 4096 bytes, big-endian
  const keyIdLen = new Uint8Array([serverPublicKey.length]);
  
  const encrypted = concat(
    salt,
    recordSize,
    keyIdLen,
    serverPublicKey,
    new Uint8Array(encryptedData)
  );
  
  return { encrypted, serverPublicKey };
}

// ============================================================================
// VAPID JWT Generation (RFC 8292)
// ============================================================================

async function generateVapidAuth(
  endpoint: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  subject: string
): Promise<{ authorization: string; publicKey: string }> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60,
    sub: subject,
  };
  
  const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;
  
  const privateKeyBytes = base64UrlDecode(vapidPrivateKey);
  const publicKeyBytes = base64UrlDecode(vapidPublicKey);
  
  const x = publicKeyBytes.slice(1, 33);
  const y = publicKeyBytes.slice(33, 65);
  
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    x: base64UrlEncode(x),
    y: base64UrlEncode(y),
    d: base64UrlEncode(privateKeyBytes),
  };
  
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  
  const signatureBuffer = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(unsignedToken)
  );
  
  const signatureArray = new Uint8Array(signatureBuffer);
  const signatureB64 = base64UrlEncode(signatureArray);
  
  const jwt = `${unsignedToken}.${signatureB64}`;
  
  return {
    authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
    publicKey: vapidPublicKey,
  };
}

// ============================================================================
// Send Push to Endpoint
// ============================================================================

async function sendPushToEndpoint(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: object,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  subject: string
): Promise<{ success: boolean; status?: number; expired?: boolean }> {
  try {
    const payloadStr = JSON.stringify(payload);
    
    // Encrypt payload using RFC 8291
    const { encrypted } = await encryptPayload(
      payloadStr,
      subscription.p256dh,
      subscription.auth
    );
    
    // Generate VAPID authorization header
    const { authorization } = await generateVapidAuth(
      subscription.endpoint,
      vapidPublicKey,
      vapidPrivateKey,
      subject
    );
    
    // Send encrypted push message
    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        "Authorization": authorization,
        "TTL": "86400",
        "Urgency": "high",
      },
      body: toArrayBuffer(encrypted),
    });
    
    if (response.status === 201 || response.status === 200) {
      return { success: true, status: response.status };
    }
    
    if (response.status === 404 || response.status === 410) {
      console.log(`Subscription expired: ${subscription.endpoint}`);
      return { success: false, status: response.status, expired: true };
    }
    
    console.error(`Push failed with status ${response.status}: ${await response.text()}`);
    return { success: false, status: response.status };
  } catch (error) {
    console.error("Push send error:", error);
    return { success: false };
  }
}

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { parent_id, title, body, url, alert_id, child_name } = await req.json();

    if (!parent_id) {
      return new Response(
        JSON.stringify({ error: "parent_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Sending push notification to parent ${parent_id}: ${title}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase credentials not configured");
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.warn("VAPID keys not configured, skipping push notification");
      return new Response(
        JSON.stringify({ success: false, reason: "VAPID keys not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: subscriptions, error: fetchError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("parent_id", parent_id);

    if (fetchError) {
      console.error("Error fetching subscriptions:", fetchError);
      throw new Error(`Failed to fetch subscriptions: ${fetchError.message}`);
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`No push subscriptions found for parent ${parent_id}`);
      return new Response(
        JSON.stringify({ success: true, sent: 0, reason: "No subscriptions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${subscriptions.length} subscriptions for parent ${parent_id}`);

    const payload = {
      title: title || "התראה חדשה מ-Kippy",
      body: body || "נמצא תוכן שדורש את תשומת לבך",
      icon: "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      dir: "rtl",
      lang: "he",
      tag: alert_id ? `alert-${alert_id}` : "kippy-notification",
      url: url || "/alerts",
      child_name: child_name,
    };

    const results = await Promise.all(
      subscriptions.map(async (sub) => {
        const result = await sendPushToEndpoint(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          payload,
          vapidPublicKey,
          vapidPrivateKey,
          "mailto:support@kippyai.com"
        );
        return { ...result, id: sub.id };
      })
    );

    const expiredIds = results.filter((r) => r.expired).map((r) => r.id);

    if (expiredIds.length > 0) {
      console.log(`Cleaning up ${expiredIds.length} expired subscriptions`);
      await supabase.from("push_subscriptions").delete().in("id", expiredIds);
    }

    const successCount = results.filter((r) => r.success).length;
    console.log(`Push notification sent: ${successCount}/${subscriptions.length} successful`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        total: subscriptions.length,
        expired_cleaned: expiredIds.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Send push notification error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
