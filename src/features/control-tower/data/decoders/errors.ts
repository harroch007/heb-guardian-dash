import { z } from "zod";

import type { CtR0DeniedEnvelope } from "./common";
import { decodeWithSchema, type CtR0DecodeIssue, type CtR0DecodeResult } from "./primitives";

export type CtR0ErrorCode =
  | "ABORTED"
  | "UNAUTHENTICATED"
  | "MFA_REQUIRED"
  | "FORBIDDEN"
  | "FIXTURE_PERMISSION_REQUIRED"
  | "VERIFICATION_REQUIRED"
  | "NOT_FOUND"
  | "VALIDATION_FAILED"
  | "RATE_LIMITED"
  | "SOURCE_UNAVAILABLE"
  | "SOURCE_MODE_MISMATCH"
  | "SCHEMA_MISMATCH"
  | "MALFORMED_RESPONSE";

export interface CtR0ClientError {
  readonly code: CtR0ErrorCode;
  readonly safeMessage: string;
  readonly retryable: boolean;
  readonly backendReasonCode: string | null;
  readonly decodeIssues?: readonly CtR0DecodeIssue[];
}

const ctR0TransportErrorSchema = z
  .object({
    code: z.union([z.string().max(120), z.number().int()]).optional(),
    message: z.string().max(4_000).optional(),
    details: z.string().max(4_000).nullable().optional(),
    hint: z.string().max(4_000).nullable().optional(),
    status: z.number().int().optional(),
  })
  .passthrough();

export type CtR0TransportError = z.infer<typeof ctR0TransportErrorSchema>;

export function decodeCtR0TransportError(value: unknown): CtR0DecodeResult<CtR0TransportError> {
  return decodeWithSchema(ctR0TransportErrorSchema, value);
}

function clientError(
  code: CtR0ErrorCode,
  safeMessage: string,
  retryable: boolean,
  backendReasonCode: string | null = null,
): CtR0ClientError {
  return { code, safeMessage, retryable, backendReasonCode };
}

export function mapCtR0TransportError(
  value: unknown,
  signal?: AbortSignal,
): CtR0ClientError {
  if (signal?.aborted) {
    return clientError("ABORTED", "The Control Tower request was cancelled.", false);
  }

  const decoded = decodeCtR0TransportError(value);
  if (decoded.ok === false) {
    return clientError("SOURCE_UNAVAILABLE", "Control Tower is temporarily unavailable.", true);
  }

  const transport = decoded.value;
  const code = String(transport.code ?? "").toLowerCase();
  const message = (transport.message ?? "").toLowerCase();
  const status = transport.status;

  if (message.includes("staff_mfa_required")) {
    return clientError("MFA_REQUIRED", "Multi-factor authentication is required.", false);
  }
  if (
    code === "pgrst301" ||
    status === 401 ||
    message.includes("jwt expired") ||
    message.includes("invalid jwt")
  ) {
    return clientError("UNAUTHENTICATED", "A valid staff session is required.", false);
  }
  if (message.includes("staff_not_authorized") || code === "42501" || status === 403) {
    return clientError("FORBIDDEN", "Access is denied by Control Tower policy.", false);
  }
  if (code === "p0002" || message.includes("not_found")) {
    return clientError("NOT_FOUND", "The requested Control Tower resource was not found.", false);
  }
  if (code === "22023" || message.startsWith("invalid_")) {
    return clientError("VALIDATION_FAILED", "The Control Tower request is invalid.", false);
  }
  if (status === 429 || code === "429" || message.includes("rate limit")) {
    return clientError("RATE_LIMITED", "Control Tower is busy. Try again shortly.", true);
  }

  return clientError("SOURCE_UNAVAILABLE", "Control Tower is temporarily unavailable.", true);
}

export function mapCtR0DeniedEnvelope(envelope: CtR0DeniedEnvelope): CtR0ClientError {
  const reasonCode = envelope.error.code;
  switch (reasonCode) {
    case "guardian_verification_required":
      return clientError(
        "VERIFICATION_REQUIRED",
        "Guardian verification is required for this view.",
        false,
        reasonCode,
      );
    case "permission_denied":
    case "case_resource_mismatch":
      return clientError(
        "FORBIDDEN",
        "Access is denied by Control Tower policy.",
        false,
        reasonCode,
      );
    default:
      return clientError(
        "FORBIDDEN",
        "Access is denied by Control Tower policy.",
        false,
        reasonCode,
      );
  }
}

export function malformedCtR0ResponseError(
  issues: readonly CtR0DecodeIssue[],
): CtR0ClientError {
  return {
    code: issues.some((issue) => issue.path === "$.schema_version")
      ? "SCHEMA_MISMATCH"
      : "MALFORMED_RESPONSE",
    safeMessage: "Control Tower returned an unsupported response.",
    retryable: false,
    backendReasonCode: null,
    decodeIssues: issues,
  };
}
