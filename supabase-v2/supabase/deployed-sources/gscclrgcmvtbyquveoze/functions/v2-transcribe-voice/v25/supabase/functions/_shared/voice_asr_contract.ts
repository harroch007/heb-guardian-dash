import { HttpError } from "./http.ts";

export const VOICE_ASR_MODEL = "gpt-4o-mini-transcribe";
export const VOICE_ASR_MODEL_SNAPSHOT_LATEST =
  "gpt-4o-mini-transcribe-2025-12-15";
export const VOICE_ASR_MODEL_SNAPSHOT_LEGACY =
  "gpt-4o-mini-transcribe-2025-03-20";
export const VOICE_ASR_GUIDED_MODEL = "gpt-transcribe";
export const VOICE_ASR_HIGH_ACCURACY_MODEL = "gpt-4o-transcribe";
export const VOICE_ASR_AUDIO_MODEL = "gpt-audio-1.5";
export const VOICE_ASR_REALTIME_MODEL = "gpt-live-transcribe";
export const VOICE_ASR_REALTIME_CONNECTION_MODEL = "gpt-realtime-2.1";
export const VOICE_ASR_FALLBACK_MODEL = "whisper-1";
export const VOICE_ASR_TRANSLATION_MODEL = "whisper-1-translation";

export type VoiceAsrProviderCandidate = Readonly<{
  kind: "transcription" | "translation" | "audio_chat";
  model: string;
  responseModel?: string;
  includeLogprobs: boolean;
}>;

export function voiceAsrProviderCandidates(
  audioChatEnabled: boolean,
  highAccuracyOnly: boolean = false,
  translationOnly: boolean = false,
): readonly VoiceAsrProviderCandidate[] {
  if (audioChatEnabled) {
    return [{
      kind: "audio_chat",
      model: VOICE_ASR_AUDIO_MODEL,
      includeLogprobs: false,
    }];
  }
  if (highAccuracyOnly) {
    return [{
      kind: "transcription",
      model: VOICE_ASR_HIGH_ACCURACY_MODEL,
      includeLogprobs: true,
    }];
  }
  if (translationOnly) {
    return [{
      kind: "translation",
      model: VOICE_ASR_FALLBACK_MODEL,
      responseModel: VOICE_ASR_TRANSLATION_MODEL,
      includeLogprobs: false,
    }];
  }
  return [{
    kind: "transcription",
    model: VOICE_ASR_HIGH_ACCURACY_MODEL,
    includeLogprobs: true,
  }];
}

export function validateCanonicalPcmWav(
  bytes: Uint8Array,
  declaredDurationMs: number,
): void {
  if (
    bytes.byteLength < 46 || readAscii(bytes, 0, 4) !== "RIFF" ||
    readAscii(bytes, 8, 4) !== "WAVE" ||
    readAscii(bytes, 12, 4) !== "fmt " ||
    readUint32(bytes, 16) !== 16 || readUint16(bytes, 20) !== 1 ||
    readUint16(bytes, 22) !== 1 || readUint32(bytes, 24) !== 16_000 ||
    readUint32(bytes, 28) !== 32_000 || readUint16(bytes, 32) !== 2 ||
    readUint16(bytes, 34) !== 16 || readAscii(bytes, 36, 4) !== "data"
  ) {
    throw new HttpError(400, "invalid_voice_asr_wav");
  }
  const dataBytes = readUint32(bytes, 40);
  if (dataBytes !== bytes.byteLength - 44 || dataBytes % 2 !== 0) {
    throw new HttpError(400, "invalid_voice_asr_wav");
  }
  const measuredDurationMs = Math.round(dataBytes / 2 / 16_000 * 1_000);
  if (Math.abs(measuredDurationMs - declaredDurationMs) > 100) {
    throw new HttpError(400, "voice_asr_duration_mismatch");
  }
}

export function parseOpenAIVoiceTranscription(
  value: unknown,
): { text: string; confidence: number } {
  if (!isRecord(value) || typeof value.text !== "string") {
    throw new HttpError(502, "invalid_voice_asr_provider_response");
  }
  const text = value.text.replaceAll(/\s+/g, " ").trim();
  if (text.length === 0 || text.length > 8_000) {
    throw new HttpError(422, "voice_asr_no_transcript");
  }
  const logprobs = Array.isArray(value.logprobs)
    ? value.logprobs.flatMap((entry) =>
      isRecord(entry) && typeof entry.logprob === "number" &&
        Number.isFinite(entry.logprob)
        ? [entry.logprob]
        : []
    )
    : [];
  const confidence = logprobs.length === 0 ? 0.75 : Math.exp(
    logprobs.reduce((sum, logprob) => sum + logprob, 0) /
      logprobs.length,
  );
  return { text, confidence: Math.max(0, Math.min(1, confidence)) };
}

export function parseOpenAIAudioChatTranscription(
  value: unknown,
): { text: string; confidence: number } {
  if (
    !isRecord(value) || !Array.isArray(value.choices) ||
    value.choices.length !== 1
  ) {
    throw new HttpError(502, "invalid_voice_asr_provider_response");
  }
  const choice = value.choices[0];
  const message = isRecord(choice) && isRecord(choice.message)
    ? choice.message
    : undefined;
  const toolCalls = message?.tool_calls;
  if (
    !isRecord(choice) || choice.finish_reason !== "stop" || !message ||
    message.role !== "assistant" ||
    (message.refusal !== undefined && message.refusal !== null) ||
    (message.audio !== undefined && message.audio !== null) ||
    (toolCalls !== undefined && toolCalls !== null &&
      (!Array.isArray(toolCalls) || toolCalls.length !== 0)) ||
    typeof message.content !== "string"
  ) {
    throw new HttpError(502, "invalid_voice_asr_provider_response");
  }
  const text = message.content.replaceAll(/\s+/g, " ").trim();
  if (text.length === 0 || text.length > 8_000) {
    throw new HttpError(422, "voice_asr_no_transcript");
  }
  return { text, confidence: 0.75 };
}

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function readUint16(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    .getUint16(offset, true);
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    .getUint32(offset, true);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
