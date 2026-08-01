import { z } from "zod";

import {
  bigintIdSchema,
  boundedTextSchema,
  decodeWithSchema,
  isoDateTimeSchema,
  nullableBigintIdSchema,
  nullableBoundedTextSchema,
  nullableDateTimeSchema,
  type CtR0DecodeResult,
} from "./primitives";

export const ctR0SourceModeSchema = z.enum(["fixture", "staging"]);
export type CtR0SourceMode = z.infer<typeof ctR0SourceModeSchema>;

export const ctR0EnvironmentSchema = z.enum(["staging", "production"]);
export type CtR0Environment = z.infer<typeof ctR0EnvironmentSchema>;

export const ctR0AvailabilitySchema = z.enum([
  "EXISTING_V2",
  "DERIVED_SERVER",
  "REQUIRES_PROJECTION",
  "NEW_COLLECTION_REQUIRED",
  "NEW_DOMAIN_REQUIRED",
  "NOT_COLLECTED",
  "PROHIBITED",
]);
export type CtR0Availability = z.infer<typeof ctR0AvailabilitySchema>;

export const ctR0FreshnessSchema = z.enum([
  "fresh",
  "unknown",
  "late",
  "interrupted",
  "expired",
  "not_applicable",
]);
export type CtR0Freshness = z.infer<typeof ctR0FreshnessSchema>;

export const ctR0SensitivitySchema = z.enum([
  "public",
  "internal",
  "confidential",
  "restricted",
]);
export type CtR0Sensitivity = z.infer<typeof ctR0SensitivitySchema>;

export const ctR0RedactionSchema = z.enum([
  "none",
  "masked",
  "permission_denied",
  "allowlisted",
  "payload_hidden",
  "secrets_hidden",
  "not_collected",
  "not_available",
  "parent_safe_only",
  "synthetic",
  "synthetic_allowlist",
]);
export type CtR0Redaction = z.infer<typeof ctR0RedactionSchema>;

export function ctR0FieldEnvelopeSchema<T extends z.ZodTypeAny>(valueSchema: T) {
  return z
    .object({
      value: valueSchema.nullable(),
      source: z.string().min(1).max(240),
      observed_at: nullableDateTimeSchema,
      received_at: nullableDateTimeSchema,
      effective_at: nullableDateTimeSchema,
      freshness_status: ctR0FreshnessSchema,
      sensitivity: ctR0SensitivitySchema,
      redaction: ctR0RedactionSchema,
      revision_or_etag: z.string().min(1).max(240).nullable(),
      availability: ctR0AvailabilitySchema,
    })
    .strict();
}

export type CtR0FieldEnvelope<T> = {
  readonly value: T | null;
  readonly source: string;
  readonly observed_at: string | null;
  readonly received_at: string | null;
  readonly effective_at: string | null;
  readonly freshness_status: CtR0Freshness;
  readonly sensitivity: CtR0Sensitivity;
  readonly redaction: CtR0Redaction;
  readonly revision_or_etag: string | null;
  readonly availability: CtR0Availability;
};

export const ctR0FixtureFieldEnvelopeSchema = z
  .object({
    value: z.unknown().nullable(),
    source: z.string().min(1).max(240),
    observed_at: nullableDateTimeSchema.optional(),
    received_at: nullableDateTimeSchema.optional(),
    effective_at: nullableDateTimeSchema.optional(),
    freshness_status: ctR0FreshnessSchema,
    sensitivity: ctR0SensitivitySchema,
    redaction: ctR0RedactionSchema,
    revision_or_etag: z.string().min(1).max(240).nullable().optional(),
    availability: ctR0AvailabilitySchema,
  })
  .strict();

export type CtR0FixtureFieldEnvelope = z.infer<typeof ctR0FixtureFieldEnvelopeSchema>;

export function isCtR0FieldReadable<T>(
  envelope: CtR0FieldEnvelope<T> | CtR0FixtureFieldEnvelope,
): envelope is CtR0FieldEnvelope<T> & { readonly value: T } {
  return (
    envelope.value !== null &&
    envelope.redaction !== "permission_denied" &&
    envelope.redaction !== "not_collected" &&
    envelope.redaction !== "not_available" &&
    envelope.availability !== "NOT_COLLECTED" &&
    envelope.availability !== "PROHIBITED"
  );
}

export const ctR0PageSchema = z.object({ limit: z.number().int().min(1).max(100) }).strict();
export type CtR0Page = z.infer<typeof ctR0PageSchema>;

export type CtR0CursorState = "AVAILABLE" | "END" | "UNAVAILABLE_CT_R0_GAP";

export interface CtR0CollectionPage<TCursor> extends CtR0Page {
  readonly cursorState: CtR0CursorState;
  readonly nextCursor: TCursor | null;
}

export interface CtR0Collection<TItem, TCursor> {
  readonly items: readonly TItem[];
  readonly page: CtR0CollectionPage<TCursor>;
}

export const ctR0DeniedEnvelopeSchema = z
  .object({
    schema_version: z.literal(1),
    generated_at: isoDateTimeSchema,
    data: z.null(),
    error: z
      .object({
        code: z.string().min(2).max(120).regex(/^[a-z0-9_.:-]+$/),
        message: boundedTextSchema,
      })
      .strict(),
    audit_event_id: bigintIdSchema,
  })
  .strict();

export type CtR0DeniedEnvelope = z.infer<typeof ctR0DeniedEnvelopeSchema>;

export interface CtR0SuccessEnvelope<TData, TPage extends CtR0Page | null> {
  readonly schema_version: 1;
  readonly generated_at: string;
  readonly source_mode: CtR0SourceMode;
  readonly data: TData;
  readonly page: TPage;
  readonly audit_event_id: string | null;
}

export type CtR0RpcEnvelope<TData, TPage extends CtR0Page | null> =
  | { readonly kind: "SUCCESS"; readonly envelope: CtR0SuccessEnvelope<TData, TPage> }
  | { readonly kind: "DENIED"; readonly envelope: CtR0DeniedEnvelope };

export function decodeCtR0SchemaEnvelope<
  TData,
  TPage extends CtR0Page | null,
  TDataInput,
  TPageInput,
>(
  value: unknown,
  dataSchema: z.ZodType<TData, z.ZodTypeDef, TDataInput>,
  pageSchema: z.ZodType<TPage, z.ZodTypeDef, TPageInput>,
): CtR0DecodeResult<CtR0RpcEnvelope<TData, TPage>> {
  const successSchema = z
    .object({
      schema_version: z.literal(1),
      generated_at: isoDateTimeSchema,
      source_mode: ctR0SourceModeSchema,
      data: dataSchema,
      page: pageSchema,
      audit_event_id: nullableBigintIdSchema,
    })
    .strict();

  const decodedSuccess = successSchema.safeParse(value);
  if (decodedSuccess.success) {
    return {
      ok: true,
      value: {
        kind: "SUCCESS",
        envelope: decodedSuccess.data as CtR0SuccessEnvelope<TData, TPage>,
      },
    };
  }

  const decodedDenied = decodeWithSchema(ctR0DeniedEnvelopeSchema, value);
  if (decodedDenied.ok) {
    return { ok: true, value: { kind: "DENIED", envelope: decodedDenied.value } };
  }

  return {
    ok: false,
    issues: decodedSuccess.error.issues.map((issue) => ({
      path: issue.path.length ? `$.${issue.path.join(".")}` : "$",
      code: issue.code,
    })),
  };
}

export function decodeCtR0Page(value: unknown): CtR0DecodeResult<CtR0Page> {
  return decodeWithSchema(ctR0PageSchema, value);
}

export function decodeCtR0FieldEnvelope<T, TInput>(
  value: unknown,
  valueSchema: z.ZodType<T, z.ZodTypeDef, TInput>,
): CtR0DecodeResult<CtR0FieldEnvelope<T>> {
  return decodeWithSchema(
    ctR0FieldEnvelopeSchema(valueSchema) as unknown as z.ZodType<CtR0FieldEnvelope<T>>,
    value,
  );
}

export function decodeCtR0Redaction(value: unknown): CtR0DecodeResult<CtR0Redaction> {
  return decodeWithSchema(ctR0RedactionSchema, value);
}

export function decodeCtR0Freshness(value: unknown): CtR0DecodeResult<CtR0Freshness> {
  return decodeWithSchema(ctR0FreshnessSchema, value);
}

export function decodeNullableText(value: unknown): CtR0DecodeResult<string | null> {
  return decodeWithSchema(nullableBoundedTextSchema, value);
}
