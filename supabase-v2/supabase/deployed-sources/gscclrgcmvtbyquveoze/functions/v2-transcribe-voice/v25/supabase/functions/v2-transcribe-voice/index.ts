import WebSocket, { RawData } from "npm:ws@8.18.3";

import {
  isUuid,
  requireDevice,
  requiredString,
  serviceClient,
} from "../_shared/auth.ts";
import {
  handleError,
  HttpError,
  jsonResponse,
  readJsonObject,
} from "../_shared/http.ts";
import {
  IncidentPrivateKeyConfigError,
  readIncidentPrivateKey,
} from "../_shared/incident_private_key.ts";
import { isOpenAIDataRetentionPolicyAcknowledged } from "../_shared/incident_retention_policy.ts";
import {
  parseOpenAIAudioChatTranscription,
  parseOpenAIVoiceTranscription,
  validateCanonicalPcmWav,
  VOICE_ASR_GUIDED_MODEL,
  VOICE_ASR_MODEL,
  VOICE_ASR_REALTIME_CONNECTION_MODEL,
  VOICE_ASR_REALTIME_MODEL,
  voiceAsrProviderCandidates,
} from "../_shared/voice_asr_contract.ts";
import {
  decryptVoiceAsrAudio,
  MAX_VOICE_ASR_ENVELOPE_BASE64_CHARS,
  MAX_VOICE_ASR_REQUEST_BYTES,
  validateVoiceAsrClaim,
  VoiceAsrClaim,
  VoiceAsrCryptoError,
} from "../_shared/voice_asr_crypto.ts";

Deno.serve(async (request) => {
  const startedAt = performance.now();
  let plaintext: Uint8Array | undefined;
  let providerTimeout: ReturnType<typeof setTimeout> | undefined;
  try {
    if (Deno.env.get("KIPPY_VOICE_ASR_ENABLED") !== "true") {
      throw new HttpError(503, "voice_asr_disabled");
    }
    const body = await readJsonObject(request, MAX_VOICE_ASR_REQUEST_BYTES);
    const client = serviceClient();
    const device = await requireDevice(request, client);
    const claim = parseClaim(body, device.deviceId);
    validateVoiceAsrClaim(claim, Date.now());

    let privateKey: string;
    try {
      privateKey = readIncidentPrivateKey(claim.key_version);
    } catch (error) {
      if (error instanceof IncidentPrivateKeyConfigError) {
        throw new HttpError(503, "voice_asr_configuration_incomplete");
      }
      throw error;
    }
    plaintext = await decryptVoiceAsrAudio(claim, privateKey);
    validateCanonicalPcmWav(plaintext, claim.audio_duration_ms);

    const elapsedBeforeProvider = performance.now() - startedAt;
    const providerBudgetMs = Math.floor(
      claim.max_processing_ms - elapsedBeforeProvider,
    );
    if (providerBudgetMs <= 0) {
      throw new HttpError(504, "voice_asr_deadline_exceeded");
    }
    const openAiKey = Deno.env.get("OPEN_AI_KEY") ?? "";
    if (openAiKey.length < 20 || openAiKey.length > 512) {
      throw new HttpError(503, "voice_asr_configuration_incomplete");
    }

    const controller = new AbortController();
    providerTimeout = setTimeout(() => controller.abort(), providerBudgetMs);
    let response: Response | undefined;
    let providerResponseText: string | undefined;
    let directTranscript:
      | { text: string; confidence: number }
      | undefined;
    let responseModel = VOICE_ASR_MODEL;
    let responseKind: "transcription" | "translation" | "audio_chat" =
      "transcription";
    let providerError:
      | { type: string; code: string; param: string }
      | undefined;
    try {
      const audioChatRequested =
        Deno.env.get("KIPPY_VOICE_ASR_AUDIO_CHAT_ENABLED") === "true";
      const highAccuracyOnly =
        Deno.env.get("KIPPY_VOICE_ASR_HIGH_ACCURACY_ONLY") === "true";
      const translationOnly =
        Deno.env.get("KIPPY_VOICE_ASR_TRANSLATION_ONLY") === "true";
      const realtimeRequested =
        Deno.env.get("KIPPY_VOICE_ASR_REALTIME_QA") === "true";
      if (
        [
          audioChatRequested,
          highAccuracyOnly,
          translationOnly,
          realtimeRequested,
        ]
          .filter(Boolean).length > 1
      ) {
        throw new HttpError(503, "voice_asr_configuration_incomplete");
      }
      const retentionAcknowledged = isOpenAIDataRetentionPolicyAcknowledged(
        Deno.env.get("KIPPY_OPENAI_ZDR_APPROVED"),
        Deno.env.get("KIPPY_OPENAI_STANDARD_RETENTION_ACKNOWLEDGED"),
      );
      if (
        (audioChatRequested || realtimeRequested) && !retentionAcknowledged
      ) {
        throw new HttpError(
          503,
          "voice_asr_retention_acknowledgement_required",
        );
      }
      if (realtimeRequested) {
        directTranscript = await requestOpenAIRealtimeTranscription(
          openAiKey,
          plaintext,
          controller.signal,
        );
        responseModel = VOICE_ASR_REALTIME_MODEL;
      } else {
        const providerModels = voiceAsrProviderCandidates(
          audioChatRequested,
          highAccuracyOnly,
          translationOnly,
        );
        for (let index = 0; index < providerModels.length; index += 1) {
          const candidate = providerModels[index];
          response = candidate.kind === "audio_chat"
            ? await requestOpenAIAudioChatTranscription(
              openAiKey,
              plaintext,
              candidate.model,
              controller.signal,
            )
            : candidate.kind === "translation"
            ? await requestOpenAIWhisperTranslation(
              openAiKey,
              plaintext,
              candidate.model,
              controller.signal,
            )
            : await requestOpenAIVoiceTranscription(
              openAiKey,
              plaintext,
              candidate.model,
              candidate.includeLogprobs,
              controller.signal,
            );
          responseModel = candidate.responseModel ?? candidate.model;
          responseKind = candidate.kind;
          const responseText = await readBoundedProviderResponseText(
            response,
            response.ok ? 256 * 1024 : 64 * 1024,
            controller.signal,
          );
          if (response.ok) {
            providerResponseText = responseText;
            providerError = undefined;
            break;
          }
          providerError = parseProviderErrorMetadata(responseText);
          const next = providerModels[index + 1];
          if (
            next && response.status === 403 &&
            providerError.code === "model_not_found"
          ) {
            console.warn(JSON.stringify({
              event: "voice_asr_provider_fallback",
              status: response.status,
              type: providerError.type,
              code: providerError.code,
              param: providerError.param,
              from_model: candidate.model,
              to_model: next.model,
            }));
            continue;
          }
          break;
        }
      }
    } catch (error) {
      if (error instanceof HttpError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new HttpError(504, "voice_asr_deadline_exceeded");
      }
      throw new HttpError(503, "voice_asr_provider_unavailable");
    }
    if (controller.signal.aborted) {
      throw new HttpError(504, "voice_asr_deadline_exceeded");
    }
    if (!directTranscript && !response) {
      throw new HttpError(503, "voice_asr_provider_unavailable");
    }
    if (response && !response.ok) {
      const rejected = providerError ?? {
        type: "UNKNOWN",
        code: "UNKNOWN",
        param: "UNKNOWN",
      };
      console.warn(JSON.stringify({
        event: "voice_asr_provider_rejected",
        status: response.status,
        type: rejected.type,
        code: rejected.code,
        param: rejected.param,
      }));
      throw new HttpError(
        response.status === 408 || response.status === 429 ||
          response.status >= 500
          ? 503
          : 502,
        "voice_asr_provider_rejected",
      );
    }
    let transcript = directTranscript;
    if (!transcript) {
      const responseText = providerResponseText;
      if (responseText === undefined) {
        throw new HttpError(502, "invalid_voice_asr_provider_response");
      }
      let providerBody: unknown;
      try {
        providerBody = JSON.parse(responseText);
      } catch {
        throw new HttpError(502, "invalid_voice_asr_provider_response");
      }
      transcript = responseKind === "audio_chat"
        ? parseOpenAIAudioChatTranscription(providerBody)
        : parseOpenAIVoiceTranscription(providerBody);
    }
    const elapsedMs = Math.ceil(performance.now() - startedAt);
    if (elapsedMs > claim.max_processing_ms) {
      throw new HttpError(504, "voice_asr_deadline_exceeded");
    }
    return jsonResponse(200, {
      text: transcript.text,
      confidence: transcript.confidence,
      model: responseModel,
      server_elapsed_ms: elapsedMs,
    });
  } catch (error) {
    if (error instanceof VoiceAsrCryptoError) {
      return handleError(new HttpError(400, error.code));
    }
    return handleError(error);
  } finally {
    if (providerTimeout !== undefined) clearTimeout(providerTimeout);
    plaintext?.fill(0);
  }
});

function parseClaim(
  body: Record<string, unknown>,
  authenticatedDeviceId: string,
): VoiceAsrClaim {
  const expectedKeys = [
    "request_id",
    "audio_duration_ms",
    "audio_mime_type",
    "model_contract_version",
    "aad_version",
    "encrypted_payload_base64",
    "encryption_algorithm",
    "key_version",
    "expires_at",
    "max_processing_ms",
  ].sort();
  const actualKeys = Object.keys(body).sort();
  if (
    actualKeys.length !== expectedKeys.length ||
    !actualKeys.every((key, index) => key === expectedKeys[index])
  ) {
    throw new HttpError(400, "invalid_voice_asr_header");
  }
  const requestId = requiredString(
    body.request_id,
    "invalid_voice_asr_header",
    36,
  );
  if (!isUuid(requestId)) throw new HttpError(400, "invalid_voice_asr_header");
  const encryptedPayload = requiredString(
    body.encrypted_payload_base64,
    "invalid_voice_asr_payload",
    MAX_VOICE_ASR_ENVELOPE_BASE64_CHARS,
  );
  return {
    request_id: requestId,
    device_id: authenticatedDeviceId,
    key_version: requireInteger(body.key_version),
    encryption_algorithm: requiredString(
      body.encryption_algorithm,
      "invalid_voice_asr_header",
      64,
    ),
    aad_version: requireInteger(body.aad_version),
    model_contract_version: requireInteger(body.model_contract_version),
    audio_duration_ms: requireInteger(body.audio_duration_ms),
    audio_mime_type: requiredString(
      body.audio_mime_type,
      "invalid_voice_asr_header",
      40,
    ),
    model: VOICE_ASR_MODEL,
    expires_at: requiredString(body.expires_at, "invalid_voice_asr_header", 32),
    max_processing_ms: requireInteger(body.max_processing_ms),
    encrypted_payload_base64: encryptedPayload,
  };
}

function requireInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new HttpError(400, "invalid_voice_asr_header");
  }
  return value;
}

function cryptoBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  if (!(bytes.buffer instanceof ArrayBuffer)) {
    throw new HttpError(500, "unsupported_voice_asr_buffer");
  }
  return bytes as Uint8Array<ArrayBuffer>;
}

function requestOpenAIVoiceTranscription(
  openAiKey: string,
  plaintext: Uint8Array,
  model: string,
  includeLogprobs: boolean,
  signal: AbortSignal,
): Promise<Response> {
  const form = new FormData();
  form.set(
    "file",
    new File([cryptoBytes(plaintext)], "voice.wav", { type: "audio/wav" }),
  );
  form.set("model", model);
  form.set("response_format", "json");
  if (model === VOICE_ASR_GUIDED_MODEL) {
    for (const language of ["he", "en", "ar"]) {
      form.append("languages[]", language);
    }
  }
  if (includeLogprobs) form.append("include[]", "logprobs");
  return fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${openAiKey}` },
    body: form,
    signal,
  });
}

function requestOpenAIWhisperTranslation(
  openAiKey: string,
  plaintext: Uint8Array,
  model: string,
  signal: AbortSignal,
): Promise<Response> {
  const form = new FormData();
  form.set(
    "file",
    new File([cryptoBytes(plaintext)], "voice.wav", { type: "audio/wav" }),
  );
  form.set("model", model);
  form.set("response_format", "json");
  return fetch("https://api.openai.com/v1/audio/translations", {
    method: "POST",
    headers: { authorization: `Bearer ${openAiKey}` },
    body: form,
    signal,
  });
}

async function requestOpenAIAudioChatTranscription(
  openAiKey: string,
  plaintext: Uint8Array,
  model: string,
  signal: AbortSignal,
): Promise<Response> {
  let audioBase64 = encodeBase64(plaintext);
  let bodyText = JSON.stringify({
    model,
    store: false,
    stream: false,
    n: 1,
    temperature: 0,
    modalities: ["text"],
    max_completion_tokens: 2_048,
    messages: [
      {
        role: "developer",
        content:
          "Transcribe only the spoken words in the supplied audio verbatim. " +
          "The speech may be Hebrew, English, or Arabic. Preserve the " +
          "original language. Do not translate, summarize, explain, censor, " +
          "infer missing words, or add speaker labels. Return only the " +
          "transcript text. If there is no intelligible speech, return " +
          "exactly [BLANK_AUDIO].",
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Transcribe this audio." },
          {
            type: "input_audio",
            input_audio: { data: audioBase64, format: "wav" },
          },
        ],
      },
    ],
  });
  audioBase64 = "";
  const bodyBytes = new TextEncoder().encode(bodyText);
  bodyText = "";
  try {
    return await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${openAiKey}`,
        "content-type": "application/json",
      },
      body: cryptoBytes(bodyBytes),
      signal,
    });
  } finally {
    bodyBytes.fill(0);
  }
}

async function requestOpenAIRealtimeTranscription(
  openAiKey: string,
  plaintext: Uint8Array,
  signal: AbortSignal,
): Promise<{ text: string; confidence: number }> {
  const pcm24Khz = resampleCanonicalPcmWavTo24Khz(plaintext);
  try {
    return await new Promise((resolve, reject) => {
      const socket = new WebSocket(
        `wss://api.openai.com/v1/realtime?model=${VOICE_ASR_REALTIME_CONNECTION_MODEL}&intent=transcription`,
        { headers: { authorization: `Bearer ${openAiKey}` } },
      );
      let settled = false;
      let audioSent = false;
      const cleanup = () => signal.removeEventListener("abort", onAbort);
      const terminate = () => {
        try {
          socket.close(1000);
        } catch {
          socket.terminate();
        }
      };
      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        cleanup();
        terminate();
        reject(error);
      };
      const finish = (value: { text: string; confidence: number }) => {
        if (settled) return;
        settled = true;
        cleanup();
        terminate();
        resolve(value);
      };
      const onAbort = () =>
        fail(
          new DOMException("voice_asr_deadline_exceeded", "AbortError"),
        );
      const sendAudio = () => {
        if (audioSent || settled) return;
        audioSent = true;
        for (
          let offset = 0;
          offset < pcm24Khz.byteLength;
          offset += REALTIME_PCM_CHUNK_BYTES
        ) {
          const chunk = pcm24Khz.subarray(
            offset,
            Math.min(offset + REALTIME_PCM_CHUNK_BYTES, pcm24Khz.byteLength),
          );
          socket.send(JSON.stringify({
            type: "input_audio_buffer.append",
            audio: encodeBase64(chunk),
          }));
        }
        socket.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
      };

      signal.addEventListener("abort", onAbort, { once: true });
      socket.once("open", () => {
        if (signal.aborted) {
          onAbort();
          return;
        }
        socket.send(JSON.stringify({
          type: "session.update",
          session: {
            type: "transcription",
            audio: {
              input: {
                format: { type: "audio/pcm", rate: 24_000 },
                transcription: {
                  model: VOICE_ASR_REALTIME_MODEL,
                },
                turn_detection: null,
              },
            },
          },
        }));
      });
      socket.on("message", (data: RawData) => {
        const eventText = boundedWebSocketMessageText(data);
        if (eventText === null) {
          fail(new HttpError(502, "invalid_voice_asr_provider_response"));
          return;
        }
        let event: Record<string, unknown>;
        try {
          const parsed = JSON.parse(eventText);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("invalid_event");
          }
          event = parsed as Record<string, unknown>;
        } catch {
          fail(new HttpError(502, "invalid_voice_asr_provider_response"));
          return;
        }
        if (
          event.type === "session.updated" ||
          event.type === "transcription_session.updated"
        ) {
          sendAudio();
          return;
        }
        if (
          event.type ===
            "conversation.item.input_audio_transcription.completed"
        ) {
          const parsed = parseOpenAIVoiceTranscription({
            text: event.transcript,
          });
          finish({ text: parsed.text, confidence: 0.5 });
          return;
        }
        if (
          event.type === "error" ||
          event.type === "conversation.item.input_audio_transcription.failed"
        ) {
          const error = event.error && typeof event.error === "object"
            ? event.error as Record<string, unknown>
            : {};
          const rejected = {
            type: safeProviderMetadataValue(error.type),
            code: safeProviderMetadataValue(error.code),
            param: safeProviderMetadataValue(error.param),
          };
          console.warn(JSON.stringify({
            event: "voice_asr_realtime_rejected",
            type: rejected.type,
            code: rejected.code,
            param: rejected.param,
          }));
          fail(new HttpError(502, "voice_asr_provider_rejected"));
        }
      });
      socket.once("error", () => {
        fail(new HttpError(503, "voice_asr_provider_unavailable"));
      });
      socket.once("close", () => {
        fail(new HttpError(503, "voice_asr_provider_unavailable"));
      });
    });
  } finally {
    pcm24Khz.fill(0);
  }
}

function resampleCanonicalPcmWavTo24Khz(bytes: Uint8Array): Uint8Array {
  const inputSampleCount = (bytes.byteLength - 44) / 2;
  const outputSampleCount = Math.floor(inputSampleCount * 1.5);
  const input = new DataView(
    bytes.buffer,
    bytes.byteOffset + 44,
    inputSampleCount * 2,
  );
  const output = new Uint8Array(outputSampleCount * 2);
  const outputView = new DataView(output.buffer);
  for (let outputIndex = 0; outputIndex < outputSampleCount; outputIndex += 1) {
    const inputPosition = outputIndex * 2 / 3;
    const leftIndex = Math.floor(inputPosition);
    const rightIndex = Math.min(leftIndex + 1, inputSampleCount - 1);
    const fraction = inputPosition - leftIndex;
    const left = input.getInt16(leftIndex * 2, true);
    const right = input.getInt16(rightIndex * 2, true);
    const interpolated = Math.round(left + (right - left) * fraction);
    outputView.setInt16(
      outputIndex * 2,
      Math.max(-32_768, Math.min(32_767, interpolated)),
      true,
    );
  }
  return output;
}

function boundedWebSocketMessageText(data: RawData): string | null {
  let bytes: Uint8Array;
  if (data instanceof ArrayBuffer) {
    bytes = new Uint8Array(data);
  } else if (Array.isArray(data)) {
    const total = data.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    if (total > MAX_REALTIME_EVENT_BYTES) return null;
    bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of data) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
  } else {
    bytes = data;
  }
  if (bytes.byteLength > MAX_REALTIME_EVENT_BYTES) return null;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

const REALTIME_PCM_CHUNK_BYTES = 48 * 1024;
const MAX_REALTIME_EVENT_BYTES = 256 * 1024;

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

async function readBoundedProviderResponseText(
  response: Response,
  maxBytes: number,
  signal: AbortSignal,
): Promise<string> {
  if (!response.body) {
    throw new HttpError(502, "invalid_voice_asr_provider_response");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new HttpError(502, "invalid_voice_asr_provider_response");
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (
      signal.aborted ||
      (error instanceof DOMException && error.name === "AbortError")
    ) {
      throw new HttpError(504, "voice_asr_deadline_exceeded");
    }
    throw new HttpError(503, "voice_asr_provider_unavailable");
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  try {
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
      chunk.fill(0);
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new HttpError(502, "invalid_voice_asr_provider_response");
  } finally {
    bytes.fill(0);
    for (const chunk of chunks) chunk.fill(0);
  }
}

function parseProviderErrorMetadata(
  responseText: string,
): { type: string; code: string; param: string } {
  const unknown = { type: "UNKNOWN", code: "UNKNOWN", param: "UNKNOWN" };
  try {
    const parsed = JSON.parse(responseText);
    if (!parsed || typeof parsed !== "object") return unknown;
    const error = (parsed as Record<string, unknown>).error;
    if (!error || typeof error !== "object") return unknown;
    const object = error as Record<string, unknown>;
    return {
      type: safeProviderMetadataValue(object.type),
      code: safeProviderMetadataValue(object.code),
      param: safeProviderMetadataValue(object.param),
    };
  } catch {
    return unknown;
  }
}

function safeProviderMetadataValue(value: unknown): string {
  return typeof value === "string" && /^[A-Za-z0-9_.\[\]-]{1,80}$/.test(value)
    ? value
    : "UNKNOWN";
}
