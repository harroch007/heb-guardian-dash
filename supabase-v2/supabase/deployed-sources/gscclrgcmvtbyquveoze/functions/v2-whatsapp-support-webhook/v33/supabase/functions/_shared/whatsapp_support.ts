const META_SIGNATURE_PREFIX = "sha256=";
const META_SIGNATURE_PATTERN = /^sha256=([0-9a-f]{64})$/;
const DIGITS_PATTERN = /^[0-9]{5,32}$/;
const PROVIDER_ID_PATTERN = /^[A-Za-z0-9._~+/=-]{1,512}$/;
const MAX_ENTRIES = 50;
const MAX_CHANGES = 100;
const MAX_ITEMS_PER_COLLECTION = 200;
const MAX_NORMALIZED_ITEMS = 1_000;
const MAX_TOTAL_CHANGES = 200;
const MAX_JSON_DEPTH = 12;
const MAX_JSON_KEYS = 2_000;
export const MAX_CANONICAL_PLAINTEXT_BYTES = 65_536;
export const MAX_CIPHERTEXT_BYTES = MAX_CANONICAL_PLAINTEXT_BYTES + 16;
const AAD_MANIFEST_VERSION = 2;

export type WhatsAppSupportMode =
  | "disabled"
  | "verify_only"
  | "ingest_only"
  | "shadow"
  | "live";

export interface WhatsAppSupportConfig {
  mode: "ingest_only" | "shadow" | "live";
  environment: "staging" | "production";
  verifyToken: string;
  appSecret: string;
  wabaId: string;
  phoneNumberId: string;
  maxWebhookBytes: number;
  rpcTimeoutMs: number;
  contentEncryptionKeyId: number;
  contentEncryptionKey: Uint8Array;
  contactLookupKeyId: number;
  contactLookupKey: Uint8Array;
  providerIdKeyId: number;
  providerIdKey: Uint8Array;
  contentDigestKeyId: number;
  contentDigestKey: Uint8Array;
}

export interface WhatsAppCryptoKeyIdsV2 {
  content_encryption: number;
  contact_lookup_hmac: number;
  provider_id_hmac: number;
  content_digest_hmac: number;
}

export interface EncryptedServiceContentV2 {
  algorithm: "AES-256-GCM";
  aad_manifest_version: 2;
  nonce_base64: string;
  aad_sha256: string;
  ciphertext_base64: string;
}

export interface NormalizedWhatsAppItemV2 {
  schema_version: 2;
  provider: "whatsapp_cloud";
  kind: "message" | "status" | "provider_error";
  idempotency_hmac: string;
  waba_lookup_hmac: string;
  phone_number_lookup_hmac: string;
  provider_message_id_hmac?: string;
  provider_timestamp: string;
  received_at: string;
  message_type?: string;
  sender_lookup_hmac?: string;
  recipient_lookup_hmac?: string;
  reply_to_provider_message_id_hmac?: string;
  status?: "sent" | "delivered" | "read" | "failed" | "deleted" | "unknown";
  error_code?: string;
  error_fingerprint_hmac?: string;
  content_digest_hmac: string;
  crypto_key_ids: WhatsAppCryptoKeyIdsV2;
  content_envelope: EncryptedServiceContentV2;
  media?: {
    provider_media_id_hmac: string;
    mime_type?: string;
    provider_sha256?: string;
    scan_state: "quarantined";
  };
}

export interface WhatsAppIngestRpcArguments {
  target_environment: "staging" | "production";
  target_channel_mode: "ingest_only" | "shadow" | "live";
  target_envelope_sha256: string;
  target_received_at: string;
  target_items: NormalizedWhatsAppItemV2[];
}

export interface WhatsAppIngestRpcResult {
  schema_version: 1;
  duplicate_envelope: boolean;
  accepted_items: number;
  duplicate_items: number;
  rejected_items: number;
  conversation_ids: string[];
  case_ids: string[];
  shadow_job_ids: string[];
}

export interface WhatsAppSupportDependencies {
  getEnv(name: string): string | undefined;
  ingest(
    arguments_: WhatsAppIngestRpcArguments,
    signal: AbortSignal,
  ): Promise<{ data: unknown; error: unknown | null }>;
  now?: () => Date;
  randomBytes?: (length: number) => Uint8Array;
}

export class WhatsAppSupportError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

/**
 * Meta verifies callback URLs with hub.* query parameters and signs POST
 * bodies in X-Hub-Signature-256 with the app secret. Signature verification
 * must use the original bytes, never parsed or re-serialized JSON.
 * https://www.postman.com/meta/messenger-platform-api/folder/22794852-b5d97624-14d8-4e67-a2e4-529add49ca58
 */
export async function handleWhatsAppSupportWebhook(
  request: Request,
  dependencies: WhatsAppSupportDependencies,
): Promise<Response> {
  let mode: WhatsAppSupportMode;
  try {
    mode = readMode(dependencies.getEnv);
  } catch {
    return errorResponse(503, "whatsapp_configuration_incomplete");
  }

  if (mode === "disabled") {
    return errorResponse(503, "whatsapp_support_disabled");
  }
  if (request.method === "GET") {
    return await handleVerification(request, mode, dependencies);
  }
  if (request.method !== "POST") {
    return errorResponse(405, "method_not_allowed", {
      allow: "GET, POST",
    });
  }
  if (mode === "verify_only") {
    return errorResponse(503, "whatsapp_ingest_disabled");
  }

  let config: WhatsAppSupportConfig | undefined;
  let rawBody: Uint8Array | undefined;
  try {
    config = readWhatsAppSupportConfig(dependencies.getEnv, mode);
    assertJsonContentType(request.headers.get("content-type"));
    assertDeclaredLength(
      request.headers.get("content-length"),
      config.maxWebhookBytes,
    );
    const signature = requireMetaSignatureHeader(
      request.headers.get("x-hub-signature-256"),
    );

    rawBody = await readBodyWithLimit(request, config.maxWebhookBytes);
    if (!await verifyMetaSignature(rawBody, signature, config.appSecret)) {
      throw new WhatsAppSupportError(401, "invalid_webhook_signature");
    }

    const envelopeSha256 = await sha256Hex(rawBody);
    const payload = parseJsonObject(rawBody);
    const receivedAt = (dependencies.now?.() ?? new Date()).toISOString();
    const items = await normalizeWhatsAppWebhook(
      payload,
      envelopeSha256,
      config,
      receivedAt,
      dependencies.randomBytes,
    );

    let rpcResponse: { data: unknown; error: unknown | null };
    try {
      rpcResponse = await ingestWithTimeout(
        dependencies,
        {
          target_environment: config.environment,
          target_channel_mode: config.mode,
          target_envelope_sha256: envelopeSha256,
          target_received_at: receivedAt,
          target_items: items,
        },
        config.rpcTimeoutMs,
      );
    } catch {
      throw new WhatsAppSupportError(503, "whatsapp_ingest_unavailable");
    }
    if (rpcResponse.error !== null) {
      throw new WhatsAppSupportError(503, "whatsapp_ingest_unavailable");
    }
    validateIngestRpcResult(rpcResponse.data, items.length, config.mode);

    return new Response("EVENT_RECEIVED", {
      status: 200,
      headers: textHeaders,
    });
  } catch (error) {
    if (error instanceof WhatsAppSupportError) {
      return errorResponse(error.status, error.code);
    }
    return errorResponse(503, "whatsapp_ingest_unavailable");
  } finally {
    rawBody?.fill(0);
    if (config) zeroizeWhatsAppSupportConfig(config);
  }
}

async function ingestWithTimeout(
  dependencies: WhatsAppSupportDependencies,
  arguments_: WhatsAppIngestRpcArguments,
  timeoutMs: number,
): Promise<{ data: unknown; error: unknown | null }> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort(new DOMException("rpc_timeout", "TimeoutError"));
      reject(new WhatsAppSupportError(503, "whatsapp_ingest_timeout"));
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      Promise.resolve().then(() =>
        dependencies.ingest(arguments_, controller.signal)
      ),
      timeout,
    ]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

async function handleVerification(
  request: Request,
  mode: Exclude<WhatsAppSupportMode, "disabled">,
  dependencies: WhatsAppSupportDependencies,
): Promise<Response> {
  let config: WhatsAppSupportConfig | undefined;
  try {
    const verifyToken = mode === "verify_only"
      ? readVerificationToken(dependencies.getEnv)
      : (config = readWhatsAppSupportConfig(
        dependencies.getEnv,
        mode,
      )).verifyToken;
    const url = new URL(request.url);
    const hubMode = url.searchParams.get("hub.mode");
    const suppliedToken = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (
      hubMode === null || suppliedToken === null || challenge === null ||
      !/^[0-9]{1,20}$/.test(challenge)
    ) {
      throw new WhatsAppSupportError(400, "invalid_verification_request");
    }
    if (
      hubMode !== "subscribe" ||
      !constantTimeEqual(
        new TextEncoder().encode(suppliedToken),
        new TextEncoder().encode(verifyToken),
      )
    ) {
      throw new WhatsAppSupportError(403, "verification_rejected");
    }
    return new Response(challenge, { status: 200, headers: textHeaders });
  } catch (error) {
    if (error instanceof WhatsAppSupportError) {
      return errorResponse(error.status, error.code);
    }
    return errorResponse(503, "whatsapp_configuration_incomplete");
  } finally {
    if (config) zeroizeWhatsAppSupportConfig(config);
  }
}

export function readMode(
  getEnv: (name: string) => string | undefined,
): WhatsAppSupportMode {
  const value = getEnv("WHATSAPP_CHANNEL_MODE") ?? "";
  if (
    value !== "disabled" && value !== "verify_only" &&
    value !== "ingest_only" && value !== "shadow" && value !== "live"
  ) {
    throw new Error("invalid_whatsapp_channel_mode");
  }
  return value;
}

export function readWhatsAppSupportConfig(
  getEnv: (name: string) => string | undefined,
  mode?: WhatsAppSupportMode,
): WhatsAppSupportConfig {
  const resolvedMode = mode ?? readMode(getEnv);
  if (
    resolvedMode !== "ingest_only" && resolvedMode !== "shadow" &&
    resolvedMode !== "live"
  ) {
    throw new Error("whatsapp_ingest_not_configured");
  }
  const environment = getEnv("WHATSAPP_ENVIRONMENT") ?? "";
  const appSecret = getEnv("WHATSAPP_META_APP_SECRET") ?? "";
  const wabaId = getEnv("WHATSAPP_WABA_ID") ?? "";
  const phoneNumberId = getEnv("WHATSAPP_PHONE_NUMBER_ID") ?? "";
  const rawMaxBytes = getEnv("WHATSAPP_WEBHOOK_MAX_BYTES") ?? "";
  const rawRpcTimeoutMs = getEnv("WHATSAPP_RPC_TIMEOUT_MS") ?? "";
  const rawContentEncryptionKeyId = getEnv(
    "WHATSAPP_CONTENT_ENCRYPTION_KEY_ID",
  ) ?? "";
  const rawContactLookupKeyId = getEnv(
    "WHATSAPP_CONTACT_LOOKUP_HMAC_KEY_ID",
  ) ?? "";
  const rawProviderIdKeyId = getEnv("WHATSAPP_PROVIDER_ID_HMAC_KEY_ID") ?? "";
  const rawContentDigestKeyId = getEnv(
    "WHATSAPP_CONTENT_DIGEST_HMAC_KEY_ID",
  ) ?? "";
  const rawKeyIds = [
    rawContentEncryptionKeyId,
    rawContactLookupKeyId,
    rawProviderIdKeyId,
    rawContentDigestKeyId,
  ];
  if (
    (environment !== "staging" && environment !== "production") ||
    appSecret.length < 16 || appSecret.length > 256 ||
    !DIGITS_PATTERN.test(wabaId) || !DIGITS_PATTERN.test(phoneNumberId) ||
    rawKeyIds.some((value) => !/^[1-9][0-9]{0,2}$/.test(value)) ||
    !/^[1-9][0-9]{1,4}$/.test(rawRpcTimeoutMs) ||
    !/^[1-9][0-9]{3,6}$/.test(rawMaxBytes)
  ) {
    throw new Error("invalid_whatsapp_configuration");
  }
  const maxWebhookBytes = Number(rawMaxBytes);
  const rpcTimeoutMs = Number(rawRpcTimeoutMs);
  if (
    maxWebhookBytes < 4_096 || maxWebhookBytes > 2_097_152 ||
    rpcTimeoutMs < 100 || rpcTimeoutMs > 10_000
  ) {
    throw new Error("invalid_whatsapp_configuration");
  }
  const verifyToken = readVerificationToken(getEnv);
  const contentEncryptionKeyId = Number(rawContentEncryptionKeyId);
  const contactLookupKeyId = Number(rawContactLookupKeyId);
  const providerIdKeyId = Number(rawProviderIdKeyId);
  const contentDigestKeyId = Number(rawContentDigestKeyId);
  const decodedKeys: Uint8Array[] = [];
  try {
    const contentEncryptionKey = decodeKey(
      getEnv(
        `WHATSAPP_CONTENT_ENCRYPTION_KEY_V${contentEncryptionKeyId}`,
      ) ?? "",
    );
    decodedKeys.push(contentEncryptionKey);
    const contactLookupKey = decodeKey(
      getEnv(`WHATSAPP_CONTACT_LOOKUP_HMAC_KEY_V${contactLookupKeyId}`) ?? "",
    );
    decodedKeys.push(contactLookupKey);
    const providerIdKey = decodeKey(
      getEnv(`WHATSAPP_PROVIDER_ID_HMAC_KEY_V${providerIdKeyId}`) ?? "",
    );
    decodedKeys.push(providerIdKey);
    const contentDigestKey = decodeKey(
      getEnv(`WHATSAPP_CONTENT_DIGEST_HMAC_KEY_V${contentDigestKeyId}`) ?? "",
    );
    decodedKeys.push(contentDigestKey);

    for (let left = 0; left < decodedKeys.length; left++) {
      for (let right = left + 1; right < decodedKeys.length; right++) {
        if (constantTimeEqual(decodedKeys[left], decodedKeys[right])) {
          throw new Error("whatsapp_key_separation_required");
        }
      }
    }
    return {
      mode: resolvedMode,
      environment,
      verifyToken,
      appSecret,
      wabaId,
      phoneNumberId,
      maxWebhookBytes,
      rpcTimeoutMs,
      contentEncryptionKeyId,
      contentEncryptionKey,
      contactLookupKeyId,
      contactLookupKey,
      providerIdKeyId,
      providerIdKey,
      contentDigestKeyId,
      contentDigestKey,
    };
  } catch (error) {
    for (const key of decodedKeys) key.fill(0);
    throw error;
  }
}

function readVerificationToken(
  getEnv: (name: string) => string | undefined,
): string {
  const value = getEnv("WHATSAPP_WEBHOOK_VERIFY_TOKEN") ?? "";
  if (
    value.length < 32 || value.length > 256 ||
    /[\u0000-\u0020\u007f]/.test(value)
  ) {
    throw new Error("invalid_whatsapp_verify_token");
  }
  return value;
}

export function zeroizeWhatsAppSupportConfig(
  config: WhatsAppSupportConfig,
): void {
  config.contentEncryptionKey.fill(0);
  config.contactLookupKey.fill(0);
  config.providerIdKey.fill(0);
  config.contentDigestKey.fill(0);
}

export async function verifyMetaSignature(
  rawBody: Uint8Array,
  signatureHeader: string | null,
  appSecret: string,
): Promise<boolean> {
  if (appSecret.length < 16 || appSecret.length > 256) return false;
  const match = signatureHeader === null
    ? null
    : META_SIGNATURE_PATTERN.exec(signatureHeader);
  if (!match) return false;
  const supplied = decodeHex(match[1]);
  const expected = await hmacSha256(
    new TextEncoder().encode(appSecret),
    rawBody,
  );
  try {
    return constantTimeEqual(supplied, expected);
  } finally {
    supplied.fill(0);
    expected.fill(0);
  }
}

function requireMetaSignatureHeader(value: string | null): string {
  if (value === null || !META_SIGNATURE_PATTERN.test(value)) {
    throw new WhatsAppSupportError(401, "invalid_webhook_signature");
  }
  return value;
}

export async function createMetaSignatureHeader(
  rawBody: Uint8Array,
  appSecret: string,
): Promise<string> {
  const signature = await hmacSha256(
    new TextEncoder().encode(appSecret),
    rawBody,
  );
  try {
    return `${META_SIGNATURE_PREFIX}${hex(signature)}`;
  } finally {
    signature.fill(0);
  }
}

export function constantTimeEqual(
  left: Uint8Array,
  right: Uint8Array,
): boolean {
  const length = Math.max(left.byteLength, right.byteLength);
  let difference = left.byteLength ^ right.byteLength;
  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

/**
 * The outer array structure and message/status shapes follow Meta's official
 * WhatsApp webhook payload reference:
 * https://www.postman.com/meta/whatsapp-business-platform/folder/tduohwq/webhook-payload-reference
 */
export async function normalizeWhatsAppWebhook(
  payload: Record<string, unknown>,
  envelopeSha256: string,
  config: WhatsAppSupportConfig,
  receivedAt: string,
  randomBytes: (length: number) => Uint8Array = secureRandomBytes,
): Promise<NormalizedWhatsAppItemV2[]> {
  if (
    payload.object !== "whatsapp_business_account" ||
    !/^[0-9a-f]{64}$/.test(envelopeSha256) ||
    !isCanonicalTimestamp(receivedAt) ||
    !Array.isArray(payload.entry) || payload.entry.length === 0 ||
    payload.entry.length > MAX_ENTRIES
  ) {
    throw new WhatsAppSupportError(422, "invalid_webhook_payload");
  }
  assertBoundedJson(payload);

  const changes: PreflightChange[] = [];
  let totalChanges = 0;
  let totalItems = 0;
  for (let entryIndex = 0; entryIndex < payload.entry.length; entryIndex++) {
    const entry = requireRecord(payload.entry[entryIndex]);
    if (
      entry.id !== config.wabaId || !Array.isArray(entry.changes) ||
      entry.changes.length === 0 || entry.changes.length > MAX_CHANGES
    ) {
      throw new WhatsAppSupportError(403, "webhook_account_rejected");
    }
    for (
      let changeIndex = 0;
      changeIndex < entry.changes.length;
      changeIndex++
    ) {
      const change = requireRecord(entry.changes[changeIndex]);
      const value = requireRecord(change.value);
      const metadata = requireRecord(value.metadata);
      if (
        change.field !== "messages" ||
        value.messaging_product !== "whatsapp" ||
        metadata.phone_number_id !== config.phoneNumberId
      ) {
        throw new WhatsAppSupportError(403, "webhook_account_rejected");
      }

      const messages = value.messages === undefined
        ? []
        : requireBoundedArray(value.messages);
      const statuses = value.statuses === undefined
        ? []
        : requireBoundedArray(value.statuses);
      const errors = value.errors === undefined
        ? []
        : requireBoundedArray(value.errors);
      const changeItemCount = messages.length + statuses.length + errors.length;
      totalChanges++;
      totalItems += changeItemCount === 0 ? 1 : changeItemCount;
      if (
        totalChanges > MAX_TOTAL_CHANGES || totalItems > MAX_NORMALIZED_ITEMS
      ) {
        throw new WhatsAppSupportError(422, "too_many_webhook_items");
      }
      changes.push({
        entryIndex,
        changeIndex,
        value,
        messages,
        statuses,
        errors,
      });
    }
  }

  // Every item, including its canonical plaintext size, is validated before
  // any lookup HMAC or AES operation starts.
  const prepared: PreparedWhatsAppItem[] = [];
  for (const change of changes) {
    const contactNames = normalizeContactNames(change.value.contacts);
    for (const message of change.messages) {
      prepared.push(
        prepareMessage(requireRecord(message), contactNames, config),
      );
    }
    for (const status of change.statuses) {
      prepared.push(prepareStatus(requireRecord(status), config));
    }
    for (let errorIndex = 0; errorIndex < change.errors.length; errorIndex++) {
      prepared.push(
        prepareProviderError(
          requireRecord(change.errors[errorIndex]),
          envelopeSha256,
          `${change.entryIndex}.${change.changeIndex}.${errorIndex}`,
          config,
          receivedAt,
        ),
      );
    }
    if (
      change.messages.length + change.statuses.length + change.errors.length ===
        0
    ) {
      prepared.push(
        prepareProviderError(
          { type: "unsupported_change", value: change.value },
          envelopeSha256,
          `${change.entryIndex}.${change.changeIndex}.unsupported`,
          config,
          receivedAt,
        ),
      );
    }
  }
  if (prepared.length !== totalItems) {
    throw new WhatsAppSupportError(422, "invalid_webhook_item_count");
  }

  const wabaLookupHmac = await providerIdentifierHmac(
    "waba",
    config.wabaId,
    config,
  );
  const phoneNumberLookupHmac = await providerIdentifierHmac(
    "phone_number",
    config.phoneNumberId,
    config,
  );
  const items: NormalizedWhatsAppItemV2[] = [];
  for (const item of prepared) {
    items.push(
      await materializePreparedItem(
        item,
        envelopeSha256,
        receivedAt,
        wabaLookupHmac,
        phoneNumberLookupHmac,
        config,
        randomBytes,
      ),
    );
  }
  return items;
}

interface PreflightChange {
  entryIndex: number;
  changeIndex: number;
  value: Record<string, unknown>;
  messages: unknown[];
  statuses: unknown[];
  errors: unknown[];
}

interface PreparedWhatsAppItem {
  kind: NormalizedWhatsAppItemV2["kind"];
  canonicalPlaintext: string;
  idempotencyTuple: string[];
  providerTimestamp: string;
  providerMessageId?: string;
  messageType?: string;
  senderWaId?: string;
  recipientWaId?: string;
  replyToProviderMessageId?: string;
  status?: NormalizedWhatsAppItemV2["status"];
  errorCode?: string;
  needsErrorFingerprint?: boolean;
  media?: {
    providerMediaId: string;
    mimeType?: string;
    providerSha256?: string;
  };
}

function prepareMessage(
  message: Record<string, unknown>,
  contactNames: Map<string, string>,
  config: WhatsAppSupportConfig,
): PreparedWhatsAppItem {
  const providerMessageId = providerId(message.id);
  const senderWaId = whatsappId(message.from);
  const messageTimestamp = providerTimestamp(message.timestamp);
  const rawType = providerToken(message.type, 64);
  const canonicalType = canonicalMessageType(rawType);
  const context = message.context === undefined
    ? undefined
    : requireRecord(message.context);
  const replyTo = context?.id === undefined
    ? undefined
    : providerId(context.id);
  const profileName = contactNames.get(senderWaId);
  const content: Record<string, unknown> = {
    schema_version: 2,
    scope: {
      waba_id: config.wabaId,
      phone_number_id: config.phoneNumberId,
    },
    message,
  };
  if (profileName !== undefined) content.profile_name = profileName;
  let mediaDetails: PreparedWhatsAppItem["media"];
  if (["image", "video", "audio", "document", "sticker"].includes(rawType)) {
    const media = requireRecord(message[rawType]);
    const providerMediaId = providerId(media.id);
    const mimeType = media.mime_type === undefined
      ? undefined
      : mimeTypeValue(media.mime_type);
    const providerSha256 = media.sha256 === undefined
      ? undefined
      : providerDigestValue(media.sha256);
    mediaDetails = { providerMediaId };
    if (mimeType !== undefined) mediaDetails.mimeType = mimeType;
    if (providerSha256 !== undefined) {
      mediaDetails.providerSha256 = providerSha256;
    }
  }
  return {
    kind: "message",
    canonicalPlaintext: boundedCanonicalPlaintext(content),
    idempotencyTuple: [
      "message",
      config.wabaId,
      config.phoneNumberId,
      providerMessageId,
    ],
    providerTimestamp: messageTimestamp,
    providerMessageId,
    messageType: canonicalType,
    senderWaId,
    replyToProviderMessageId: replyTo,
    media: mediaDetails,
  };
}

function prepareStatus(
  statusObject: Record<string, unknown>,
  config: WhatsAppSupportConfig,
): PreparedWhatsAppItem {
  const providerMessageId = providerId(statusObject.id);
  const recipientWaId = whatsappId(statusObject.recipient_id);
  const providerTimestampValue = providerTimestamp(statusObject.timestamp);
  const rawStatus = providerToken(statusObject.status, 64).toLowerCase();
  const status = canonicalStatus(rawStatus);
  const content: Record<string, unknown> = {
    schema_version: 2,
    scope: {
      waba_id: config.wabaId,
      phone_number_id: config.phoneNumberId,
    },
    status: statusObject,
  };
  const canonicalPlaintext = boundedCanonicalPlaintext(content);
  const firstError = Array.isArray(statusObject.errors) &&
      statusObject.errors.length > 0 && isRecord(statusObject.errors[0])
    ? statusObject.errors[0]
    : undefined;
  const errorCode = firstError?.code === undefined
    ? undefined
    : safeErrorCode(firstError.code);
  return {
    kind: "status",
    canonicalPlaintext,
    idempotencyTuple: [
      "status",
      config.wabaId,
      config.phoneNumberId,
      providerMessageId,
      rawStatus,
      String(statusObject.timestamp),
      canonicalPlaintext,
    ],
    providerTimestamp: providerTimestampValue,
    providerMessageId,
    recipientWaId,
    status,
    errorCode,
    needsErrorFingerprint: true,
  };
}

function prepareProviderError(
  errorObject: Record<string, unknown>,
  envelopeSha256: string,
  pointer: string,
  config: WhatsAppSupportConfig,
  receivedAt: string,
): PreparedWhatsAppItem {
  const content = {
    schema_version: 2,
    scope: {
      waba_id: config.wabaId,
      phone_number_id: config.phoneNumberId,
    },
    provider_error: errorObject,
  };
  const errorCode = errorObject.code === undefined
    ? undefined
    : safeErrorCode(errorObject.code);
  return {
    kind: "provider_error",
    canonicalPlaintext: boundedCanonicalPlaintext(content),
    idempotencyTuple: [
      "provider_error",
      config.wabaId,
      config.phoneNumberId,
      envelopeSha256,
      pointer,
    ],
    providerTimestamp: receivedAt,
    errorCode,
    needsErrorFingerprint: true,
  };
}

type NormalizedWhatsAppOuterV2 = Omit<
  NormalizedWhatsAppItemV2,
  "content_envelope"
>;

async function materializePreparedItem(
  prepared: PreparedWhatsAppItem,
  envelopeSha256: string,
  receivedAt: string,
  wabaLookupHmac: string,
  phoneNumberLookupHmac: string,
  config: WhatsAppSupportConfig,
  randomBytes: (length: number) => Uint8Array,
): Promise<NormalizedWhatsAppItemV2> {
  const plaintext = new TextEncoder().encode(prepared.canonicalPlaintext);
  if (plaintext.byteLength > MAX_CANONICAL_PLAINTEXT_BYTES) {
    plaintext.fill(0);
    throw new WhatsAppSupportError(422, "item_plaintext_too_large");
  }
  try {
    const idempotencyHmac = await tupleHmacHex(
      config.providerIdKey,
      "idempotency",
      prepared.idempotencyTuple,
    );
    const contentDigestHmac = await keyedDigestHex(
      config.contentDigestKey,
      plaintext,
    );
    const outer: NormalizedWhatsAppOuterV2 = {
      schema_version: 2,
      provider: "whatsapp_cloud",
      kind: prepared.kind,
      idempotency_hmac: idempotencyHmac,
      waba_lookup_hmac: wabaLookupHmac,
      phone_number_lookup_hmac: phoneNumberLookupHmac,
      provider_timestamp: prepared.providerTimestamp,
      received_at: receivedAt,
      content_digest_hmac: contentDigestHmac,
      crypto_key_ids: cryptoKeyIds(config),
    };
    if (prepared.providerMessageId !== undefined) {
      outer.provider_message_id_hmac = await providerIdentifierHmac(
        "message",
        prepared.providerMessageId,
        config,
      );
    }
    if (prepared.messageType !== undefined) {
      outer.message_type = prepared.messageType;
    }
    if (prepared.senderWaId !== undefined) {
      outer.sender_lookup_hmac = await contactLookupHmac(
        prepared.senderWaId,
        config,
      );
    }
    if (prepared.recipientWaId !== undefined) {
      outer.recipient_lookup_hmac = await contactLookupHmac(
        prepared.recipientWaId,
        config,
      );
    }
    if (prepared.replyToProviderMessageId !== undefined) {
      outer.reply_to_provider_message_id_hmac = await providerIdentifierHmac(
        "reply_message",
        prepared.replyToProviderMessageId,
        config,
      );
    }
    if (prepared.status !== undefined) outer.status = prepared.status;
    if (prepared.errorCode !== undefined) outer.error_code = prepared.errorCode;
    if (prepared.needsErrorFingerprint === true) {
      outer.error_fingerprint_hmac = await tupleHmacHex(
        config.providerIdKey,
        "event_fingerprint",
        [prepared.kind, prepared.canonicalPlaintext],
      );
    }
    if (prepared.media !== undefined) {
      const media: NonNullable<NormalizedWhatsAppItemV2["media"]> = {
        provider_media_id_hmac: await providerIdentifierHmac(
          "media",
          prepared.media.providerMediaId,
          config,
        ),
        scan_state: "quarantined",
      };
      if (prepared.media.mimeType !== undefined) {
        media.mime_type = prepared.media.mimeType;
      }
      if (prepared.media.providerSha256 !== undefined) {
        media.provider_sha256 = prepared.media.providerSha256;
      }
      outer.media = media;
    }

    const manifest = aadManifestCanonical(
      outer,
      envelopeSha256,
      config.environment,
      config.mode,
    );
    const manifestBytes = new TextEncoder().encode(manifest);
    const aadDigest = await sha256Bytes(manifestBytes);
    manifestBytes.fill(0);
    try {
      const contentEnvelope = await encryptCanonicalPlaintext(
        plaintext,
        aadDigest,
        hex(aadDigest),
        config,
        randomBytes,
      );
      return { ...outer, content_envelope: contentEnvelope };
    } finally {
      aadDigest.fill(0);
    }
  } finally {
    plaintext.fill(0);
  }
}

function cryptoKeyIds(config: WhatsAppSupportConfig): WhatsAppCryptoKeyIdsV2 {
  return {
    content_encryption: config.contentEncryptionKeyId,
    contact_lookup_hmac: config.contactLookupKeyId,
    provider_id_hmac: config.providerIdKeyId,
    content_digest_hmac: config.contentDigestKeyId,
  };
}

function aadManifestCanonical(
  outer: NormalizedWhatsAppOuterV2,
  envelopeSha256: string,
  environment: WhatsAppSupportConfig["environment"],
  channelMode: WhatsAppSupportConfig["mode"],
): string {
  return canonicalJson({
    manifest_version: AAD_MANIFEST_VERSION,
    content_encryption_algorithm: "AES-256-GCM",
    environment,
    channel_mode: channelMode,
    envelope_sha256: envelopeSha256,
    item: outer,
  });
}

export function canonicalWhatsAppAadManifest(
  item: NormalizedWhatsAppItemV2,
  envelopeSha256: string,
  environment: WhatsAppSupportConfig["environment"],
  channelMode: WhatsAppSupportConfig["mode"],
): string {
  const { content_envelope: _contentEnvelope, ...outer } = item;
  return aadManifestCanonical(
    outer,
    envelopeSha256,
    environment,
    channelMode,
  );
}

async function encryptCanonicalPlaintext(
  plaintext: Uint8Array,
  aadDigest: Uint8Array,
  aadSha256: string,
  config: WhatsAppSupportConfig,
  randomBytes: (length: number) => Uint8Array,
): Promise<EncryptedServiceContentV2> {
  const nonce = randomBytes(12);
  if (nonce.byteLength !== 12) {
    nonce.fill(0);
    throw new Error("invalid_random_source");
  }
  const rawKey = arrayBufferBytes(config.contentEncryptionKey);
  let encryptionKey: CryptoKey;
  try {
    encryptionKey = await crypto.subtle.importKey(
      "raw",
      rawKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"],
    );
  } finally {
    rawKey.fill(0);
  }
  const nonceCopy = arrayBufferBytes(nonce);
  const aadCopy = arrayBufferBytes(aadDigest);
  const plaintextCopy = arrayBufferBytes(plaintext);
  try {
    const ciphertext = new Uint8Array(
      await crypto.subtle.encrypt(
        {
          name: "AES-GCM",
          iv: nonceCopy,
          additionalData: aadCopy,
          tagLength: 128,
        },
        encryptionKey,
        plaintextCopy,
      ),
    );
    try {
      if (
        ciphertext.byteLength !== plaintext.byteLength + 16 ||
        ciphertext.byteLength > MAX_CIPHERTEXT_BYTES
      ) {
        throw new WhatsAppSupportError(422, "item_ciphertext_too_large");
      }
      return {
        algorithm: "AES-256-GCM",
        aad_manifest_version: AAD_MANIFEST_VERSION,
        nonce_base64: encodeBase64(nonce),
        aad_sha256: aadSha256,
        ciphertext_base64: encodeBase64(ciphertext),
      };
    } finally {
      ciphertext.fill(0);
    }
  } finally {
    nonce.fill(0);
    nonceCopy.fill(0);
    aadCopy.fill(0);
    plaintextCopy.fill(0);
  }
}

async function contactLookupHmac(
  waId: string,
  config: WhatsAppSupportConfig,
): Promise<string> {
  return await tupleHmacHex(config.contactLookupKey, "contact_lookup", [
    config.wabaId,
    config.phoneNumberId,
    waId,
  ]);
}

async function providerIdentifierHmac(
  identifierKind: string,
  value: string,
  config: WhatsAppSupportConfig,
): Promise<string> {
  return await tupleHmacHex(config.providerIdKey, "provider_identifier", [
    identifierKind,
    value,
  ]);
}

async function tupleHmacHex(
  key: Uint8Array,
  domain: string,
  fields: string[],
): Promise<string> {
  const tuple = encodeLengthDelimitedTuple(domain, fields);
  try {
    return await keyedDigestHex(key, tuple);
  } finally {
    tuple.fill(0);
  }
}

function encodeLengthDelimitedTuple(
  domain: string,
  fields: string[],
): Uint8Array {
  const encoder = new TextEncoder();
  const encoded = [
    encoder.encode(`kippy/whatsapp-support/${domain}/v2`),
    ...fields.map((field) => encoder.encode(field)),
  ];
  const totalBytes = 4 + encoded.reduce(
    (total, field) => total + 4 + field.byteLength,
    0,
  );
  const tuple = new Uint8Array(totalBytes);
  const view = new DataView(tuple.buffer);
  view.setUint32(0, encoded.length, false);
  let offset = 4;
  for (const field of encoded) {
    view.setUint32(offset, field.byteLength, false);
    offset += 4;
    tuple.set(field, offset);
    offset += field.byteLength;
    field.fill(0);
  }
  return tuple;
}

export function validateIngestRpcResult(
  value: unknown,
  expectedItems: number,
  mode: "ingest_only" | "shadow" | "live",
): WhatsAppIngestRpcResult {
  if (
    !Number.isSafeInteger(expectedItems) || expectedItems <= 0 ||
    expectedItems > MAX_NORMALIZED_ITEMS || !isRecord(value)
  ) {
    throw new WhatsAppSupportError(503, "whatsapp_ingest_contract_mismatch");
  }
  const expectedKeys = new Set([
    "schema_version",
    "duplicate_envelope",
    "accepted_items",
    "duplicate_items",
    "rejected_items",
    "conversation_ids",
    "case_ids",
    "shadow_job_ids",
  ]);
  if (
    Object.keys(value).length !== expectedKeys.size ||
    Object.keys(value).some((key) => !expectedKeys.has(key))
  ) {
    throw new WhatsAppSupportError(503, "whatsapp_ingest_contract_mismatch");
  }
  const counts = [
    value.accepted_items,
    value.duplicate_items,
    value.rejected_items,
  ];
  let countTotal = -1;
  if (
    counts.every((count): count is number =>
      typeof count === "number" && Number.isSafeInteger(count) && count >= 0 &&
      count <= expectedItems
    )
  ) {
    countTotal = counts.reduce((sum, count) => sum + count, 0);
  }
  if (
    value.schema_version !== 1 ||
    typeof value.duplicate_envelope !== "boolean" ||
    countTotal !== expectedItems ||
    value.rejected_items !== 0 ||
    !isUuidArray(value.conversation_ids) ||
    !isUuidArray(value.case_ids) ||
    !isUuidArray(value.shadow_job_ids)
  ) {
    throw new WhatsAppSupportError(503, "whatsapp_ingest_contract_mismatch");
  }
  const acceptedItems = value.accepted_items as number;
  const duplicateItems = value.duplicate_items as number;
  const duplicateEnvelope = value.duplicate_envelope;
  if (
    (duplicateEnvelope &&
      (acceptedItems !== 0 || duplicateItems !== expectedItems ||
        value.conversation_ids.length !== 0 || value.case_ids.length !== 0 ||
        value.shadow_job_ids.length !== 0)) ||
    (!duplicateEnvelope && acceptedItems + duplicateItems !== expectedItems) ||
    (mode === "shadow"
      ? value.shadow_job_ids.length !== acceptedItems
      : value.shadow_job_ids.length !== 0)
  ) {
    throw new WhatsAppSupportError(503, "whatsapp_ingest_contract_mismatch");
  }
  return value as unknown as WhatsAppIngestRpcResult;
}

function canonicalMessageType(rawType: string): string {
  const supported = new Set([
    "text",
    "image",
    "video",
    "audio",
    "document",
    "sticker",
    "interactive",
    "button",
    "contacts",
    "location",
    "reaction",
    "order",
    "system",
  ]);
  return supported.has(rawType) ? rawType : "unsupported";
}

function canonicalStatus(
  value: string,
): "sent" | "delivered" | "read" | "failed" | "deleted" | "unknown" {
  return value === "sent" || value === "delivered" || value === "read" ||
      value === "failed" || value === "deleted"
    ? value
    : "unknown";
}

function messageContent(
  message: Record<string, unknown>,
): Record<string, unknown> {
  return objectWithout(message, ["id", "from", "timestamp", "type"]);
}

function contentOnlyValue(
  value: Record<string, unknown>,
): Record<string, unknown> {
  return objectWithout(value, ["messaging_product", "metadata"]);
}

function objectWithout(
  value: Record<string, unknown>,
  excluded: string[],
): Record<string, unknown> {
  const result: Record<string, unknown> = Object.create(null);
  const blocked = new Set(excluded);
  for (const key of Object.keys(value)) {
    if (!blocked.has(key)) result[key] = value[key];
  }
  return result;
}

function normalizeContactNames(value: unknown): Map<string, string> {
  const result = new Map<string, string>();
  if (value === undefined) return result;
  const contacts = requireBoundedArray(value);
  for (const rawContact of contacts) {
    const contact = requireRecord(rawContact);
    const waId = whatsappId(contact.wa_id);
    if (contact.profile === undefined) continue;
    const profile = requireRecord(contact.profile);
    if (profile.name !== undefined) {
      result.set(waId, boundedString(profile.name, 512));
    }
  }
  return result;
}

function providerTimestamp(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9]{9,11}$/.test(value)) {
    throw new WhatsAppSupportError(422, "invalid_provider_timestamp");
  }
  const milliseconds = Number(value) * 1_000;
  const date = new Date(milliseconds);
  if (
    !Number.isFinite(milliseconds) || date.getUTCFullYear() < 2000 ||
    date.getUTCFullYear() > 2100
  ) {
    throw new WhatsAppSupportError(422, "invalid_provider_timestamp");
  }
  return date.toISOString();
}

function providerId(value: unknown): string {
  if (typeof value !== "string" || !PROVIDER_ID_PATTERN.test(value)) {
    throw new WhatsAppSupportError(422, "invalid_provider_identifier");
  }
  return value;
}

function whatsappId(value: unknown): string {
  if (typeof value !== "string" || !DIGITS_PATTERN.test(value)) {
    throw new WhatsAppSupportError(422, "invalid_whatsapp_identifier");
  }
  return value;
}

function boundedString(value: unknown, maxLength: number): string {
  if (
    typeof value !== "string" || value.length === 0 ||
    value.length > maxLength || /[\u0000]/.test(value)
  ) {
    throw new WhatsAppSupportError(422, "invalid_webhook_field");
  }
  return value;
}

function providerToken(value: unknown, maxLength: number): string {
  const token = boundedString(value, maxLength);
  if (!/^[a-z][a-z0-9_]{0,63}$/.test(token)) {
    throw new WhatsAppSupportError(422, "invalid_provider_token");
  }
  return token;
}

function mimeTypeValue(value: unknown): string {
  const mimeType = boundedString(value, 255);
  if (
    !/^[A-Za-z0-9!#$&^_.+-]{1,127}\/[A-Za-z0-9!#$&^_.+-]{1,127}$/.test(
      mimeType,
    )
  ) {
    throw new WhatsAppSupportError(422, "invalid_media_mime_type");
  }
  return mimeType.toLowerCase();
}

function providerDigestValue(value: unknown): string {
  const digest = boundedString(value, 128);
  if (!/^[A-Za-z0-9+/_=-]{32,128}$/.test(digest)) {
    throw new WhatsAppSupportError(422, "invalid_provider_digest");
  }
  return digest;
}

function boundedCanonicalPlaintext(value: unknown): string {
  const canonical = canonicalJson(value);
  const bytes = new TextEncoder().encode(canonical);
  try {
    if (bytes.byteLength > MAX_CANONICAL_PLAINTEXT_BYTES) {
      throw new WhatsAppSupportError(422, "item_plaintext_too_large");
    }
    return canonical;
  } finally {
    bytes.fill(0);
  }
}

function safeErrorCode(value: unknown): string {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    !/^[A-Za-z0-9_.:-]{1,64}$/.test(String(value))
  ) {
    throw new WhatsAppSupportError(422, "invalid_provider_error");
  }
  return String(value);
}

function requireBoundedArray(value: unknown): unknown[] {
  if (!Array.isArray(value) || value.length > MAX_ITEMS_PER_COLLECTION) {
    throw new WhatsAppSupportError(422, "invalid_webhook_collection");
  }
  return value;
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new WhatsAppSupportError(422, "invalid_webhook_object");
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertBoundedJson(value: unknown): void {
  let keys = 0;
  const visit = (current: unknown, depth: number): void => {
    if (depth > MAX_JSON_DEPTH) {
      throw new WhatsAppSupportError(422, "webhook_payload_too_deep");
    }
    if (
      current === null || typeof current === "string" ||
      typeof current === "boolean"
    ) return;
    if (typeof current === "number") {
      if (!Number.isFinite(current)) {
        throw new WhatsAppSupportError(422, "invalid_webhook_number");
      }
      return;
    }
    if (Array.isArray(current)) {
      for (const item of current) visit(item, depth + 1);
      return;
    }
    if (!isRecord(current)) {
      throw new WhatsAppSupportError(422, "invalid_webhook_value");
    }
    for (const [key, item] of Object.entries(current)) {
      keys++;
      if (keys > MAX_JSON_KEYS || key.length === 0 || key.length > 256) {
        throw new WhatsAppSupportError(422, "webhook_payload_too_complex");
      }
      visit(item, depth + 1);
    }
  };
  visit(value, 0);
}

export function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${
      Object.keys(value).sort().map((key) =>
        `${JSON.stringify(key)}:${canonicalJson(value[key])}`
      ).join(",")
    }}`;
  }
  throw new Error("non_json_value");
}

function parseJsonObject(rawBody: Uint8Array): Record<string, unknown> {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(rawBody);
  } catch {
    throw new WhatsAppSupportError(400, "invalid_json_encoding");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new WhatsAppSupportError(400, "invalid_json");
  }
  if (!isRecord(parsed)) {
    throw new WhatsAppSupportError(400, "invalid_json_object");
  }
  return parsed;
}

function assertJsonContentType(value: string | null): void {
  if (value === null || !/^application\/json(?:\s*;|$)/i.test(value)) {
    throw new WhatsAppSupportError(415, "unsupported_content_type");
  }
}

function assertDeclaredLength(value: string | null, maxBytes: number): void {
  if (value === null) return;
  if (!/^[0-9]{1,10}$/.test(value)) {
    throw new WhatsAppSupportError(400, "invalid_content_length");
  }
  if (Number(value) > maxBytes) {
    throw new WhatsAppSupportError(413, "payload_too_large");
  }
}

async function readBodyWithLimit(
  request: Request,
  maxBytes: number,
): Promise<Uint8Array> {
  if (request.body === null) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      let result: ReadableStreamReadResult<Uint8Array>;
      try {
        result = await reader.read();
      } catch {
        throw new WhatsAppSupportError(400, "invalid_request_body");
      }
      if (result.done) break;
      totalBytes += result.value.byteLength;
      if (totalBytes > maxBytes) {
        result.value.fill(0);
        try {
          await reader.cancel("payload_too_large");
        } catch {
          // The 413 response remains authoritative even if cancellation fails.
        }
        throw new WhatsAppSupportError(413, "payload_too_large");
      }
      chunks.push(result.value);
    }

    const body = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
      chunk.fill(0);
    }
    return body;
  } finally {
    reader.releaseLock();
    for (const chunk of chunks) chunk.fill(0);
  }
}

function isCanonicalTimestamp(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    new Date(value).toISOString() === value;
}

function isUuidArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 1_000 &&
    value.every((item) =>
      typeof item === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
        .test(item)
    );
}

function secureRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

async function keyedDigestHex(
  keyBytes: Uint8Array,
  value: Uint8Array,
): Promise<string> {
  const signature = await hmacSha256(keyBytes, value);
  try {
    return hex(signature);
  } finally {
    signature.fill(0);
  }
}

async function hmacSha256(
  keyBytes: Uint8Array,
  value: Uint8Array,
): Promise<Uint8Array> {
  const keyCopy = arrayBufferBytes(keyBytes);
  const valueCopy = arrayBufferBytes(value);
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      keyCopy,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    return new Uint8Array(
      await crypto.subtle.sign("HMAC", key, valueCopy),
    );
  } finally {
    keyCopy.fill(0);
    valueCopy.fill(0);
  }
}

async function sha256Bytes(value: Uint8Array): Promise<Uint8Array> {
  const valueCopy = arrayBufferBytes(value);
  try {
    return new Uint8Array(
      await crypto.subtle.digest("SHA-256", valueCopy),
    );
  } finally {
    valueCopy.fill(0);
  }
}

async function sha256Hex(value: Uint8Array): Promise<string> {
  const digest = await sha256Bytes(value);
  try {
    return hex(digest);
  } finally {
    digest.fill(0);
  }
}

function decodeKey(value: string): Uint8Array {
  if (
    value.length < 43 || value.length > 48 ||
    !/^[A-Za-z0-9+/_-]+={0,2}$/.test(value)
  ) {
    throw new Error("invalid_whatsapp_key");
  }
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/")
    .replace(/=+$/u, "");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    throw new Error("invalid_whatsapp_key");
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  if (bytes.byteLength !== 32) {
    bytes.fill(0);
    throw new Error("invalid_whatsapp_key");
  }
  return bytes;
}

function decodeHex(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index++) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function hex(value: Uint8Array): string {
  let result = "";
  for (const byte of value) result += byte.toString(16).padStart(2, "0");
  return result;
}

function encodeBase64(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function arrayBufferBytes(value: Uint8Array): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(value);
}

const textHeaders = {
  "content-type": "text/plain; charset=utf-8",
  "cache-control": "no-store",
};

function errorResponse(
  status: number,
  code: string,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}
