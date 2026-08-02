import { z } from "zod";

import {
  ctR0FieldEnvelopeSchema,
  ctR0FixtureFieldEnvelopeSchema,
  decodeCtR0SchemaEnvelope,
  type CtR0RpcEnvelope,
} from "./common";
import {
  boundedTextSchema,
  decodeWithSchema,
  isoDateTimeSchema,
  nullableDateTimeSchema,
  safeKeySchema,
  uuidSchema,
  type CtR0DecodeResult,
} from "./primitives";

export const ctR0FamilyValueSchema = z
  .object({
    family_id: uuidSchema,
    display_label: z.string().min(1).max(120),
    status: z.enum(["active", "suspended", "archived"]),
    guardian_roles: z
      .array(
        z
          .object({
            role: z.enum(["owner", "guardian"]),
            status: z.enum(["invited", "active", "revoked"]),
          })
          .strict(),
      )
      .max(100),
  })
  .strict();
export type CtR0FamilyValue = z.infer<typeof ctR0FamilyValueSchema>;

export const ctR0ChildValueSchema = z
  .object({
    child_id: uuidSchema,
    display_label: z.string().min(1).max(120),
    birth_year: z.number().int().min(2000).max(2100).nullable(),
    status: z.enum(["active", "paused", "archived"]),
  })
  .strict();
export type CtR0ChildValue = z.infer<typeof ctR0ChildValueSchema>;

export const ctR0InstallValueSchema = z
  .object({
    install_session_id: uuidSchema,
    status: z.enum(["created", "activated", "consumed", "cancelled", "expired"]),
    otp_request_count: z.number().int().min(0).max(3),
    activated_at: nullableDateTimeSchema,
    consumed_at: nullableDateTimeSchema,
    expires_at: isoDateTimeSchema,
  })
  .strict();
export type CtR0InstallValue = z.infer<typeof ctR0InstallValueSchema>;

export const ctR0DeviceValueSchema = z
  .object({
    device_id: uuidSchema,
    manufacturer: z.string().min(1).max(240).nullable(),
    model: z.string().min(1).max(240).nullable(),
    app_version: z.string().min(1).max(120),
    capture_contract_version: z.number().int().min(2),
    status: z.enum(["pending", "active", "degraded", "revoked"]),
    registered_at: isoDateTimeSchema,
    last_seen_at: nullableDateTimeSchema,
    battery_level_percent: z.number().int().min(0).max(100).nullable(),
  })
  .strict();
export type CtR0DeviceValue = z.infer<typeof ctR0DeviceValueSchema>;

export const ctR0MonitoringStateSchema = z.enum([
  "awaiting_first_heartbeat",
  "protected",
  "degraded",
  "action_required",
  "heartbeat_late",
  "interrupted",
  "recovering",
  "revoked",
]);
export type CtR0MonitoringState = z.infer<typeof ctR0MonitoringStateSchema>;

export const ctR0MonitoringValueSchema = z
  .object({
    state: ctR0MonitoringStateSchema,
    reason_codes: z.array(safeKeySchema).max(64),
    last_observed_at: nullableDateTimeSchema,
    last_received_at: nullableDateTimeSchema,
    late_after_at: nullableDateTimeSchema,
    interrupted_after_at: nullableDateTimeSchema,
    capture_ready: z.boolean().nullable(),
    accessibility_enabled: z.boolean().nullable(),
    notification_listener_enabled: z.boolean().nullable(),
    battery_optimization_exempt: z.boolean().nullable(),
    oem_autostart_state: z
      .enum(["not_applicable", "confirmed", "review_required"])
      .nullable(),
  })
  .strict();
export type CtR0MonitoringValue = z.infer<typeof ctR0MonitoringValueSchema>;

export const ctR0CapabilityKeySchema = z.enum([
  "accessibility_enabled",
  "notification_listener_enabled",
  "app_notifications_allowed",
  "battery_optimization_exempt",
  "oem_autostart_review",
  "usage_access",
  "precise_location",
  "background_location",
  "location_services",
  "package_inventory",
]);
export type CtR0CapabilityKey = z.infer<typeof ctR0CapabilityKeySchema>;

export const ctR0CapabilitySchema = z
  .object({
    key: ctR0CapabilityKeySchema,
    state: z.enum(["GRANTED", "DENIED", "NOT_SUPPORTED", "UNKNOWN"]),
  })
  .strict();
export type CtR0Capability = z.infer<typeof ctR0CapabilitySchema>;

const ctR0CapabilitiesSchema = z.array(ctR0CapabilitySchema).max(10).superRefine((items, context) => {
  const keys = new Set<string>();
  items.forEach((item, index) => {
    if (keys.has(item.key)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "duplicate_capability",
        path: [index, "key"],
      });
    }
    keys.add(item.key);
  });
});

export const ctR0DeviceCommandSchema = z
  .object({
    command_id: uuidSchema,
    command_type: z.string().min(1).max(120),
    status: z.enum(["pending", "claimed", "completed", "failed", "expired"]),
    not_before: isoDateTimeSchema,
    expires_at: isoDateTimeSchema,
    completed_at: nullableDateTimeSchema,
    failure_code: z.string().max(120).nullable(),
    created_at: isoDateTimeSchema,
  })
  .strict();
export type CtR0DeviceCommand = z.infer<typeof ctR0DeviceCommandSchema>;

export const ctR0PushAggregateSchema = z
  .object({
    registered_count: z.number().int().nonnegative(),
    active_count: z.number().int().nonnegative(),
    denied_count: z.number().int().nonnegative(),
    last_seen_at: nullableDateTimeSchema,
  })
  .strict();
export type CtR0PushAggregate = z.infer<typeof ctR0PushAggregateSchema>;

export const ctR0StagingService360Schema = z
  .object({
    family: ctR0FieldEnvelopeSchema(ctR0FamilyValueSchema),
    child: ctR0FieldEnvelopeSchema(ctR0ChildValueSchema),
    install: ctR0FieldEnvelopeSchema(ctR0InstallValueSchema),
    device: ctR0FieldEnvelopeSchema(ctR0DeviceValueSchema),
    monitoring: ctR0FieldEnvelopeSchema(ctR0MonitoringValueSchema),
    capabilities: ctR0FieldEnvelopeSchema(ctR0CapabilitiesSchema),
    commands: ctR0FieldEnvelopeSchema(z.array(ctR0DeviceCommandSchema).max(10)),
    push: ctR0FieldEnvelopeSchema(ctR0PushAggregateSchema),
    parental_controls: ctR0FieldEnvelopeSchema(z.unknown()),
  })
  .strict();
export type CtR0StagingService360 = z.infer<typeof ctR0StagingService360Schema>;

export const ctR0FixtureService360Schema = z
  .object({
    schema_version: z.literal(1),
    fixture: z.literal(true),
    family: ctR0FixtureFieldEnvelopeSchema,
    child: ctR0FixtureFieldEnvelopeSchema,
    monitoring: ctR0FixtureFieldEnvelopeSchema,
    capabilities: ctR0FixtureFieldEnvelopeSchema,
    parental_controls: ctR0FixtureFieldEnvelopeSchema,
  })
  .strict();
export type CtR0FixtureService360 = z.infer<typeof ctR0FixtureService360Schema>;

export type CtR0Service360 = CtR0StagingService360 | CtR0FixtureService360;

const ctR0Service360Schema = z.union([
  ctR0StagingService360Schema,
  ctR0FixtureService360Schema,
]);

export function decodeCtR0Service360(value: unknown): CtR0DecodeResult<CtR0Service360> {
  return decodeWithSchema(ctR0Service360Schema, value);
}

export function decodeCtR0Service360Envelope(
  value: unknown,
): CtR0DecodeResult<CtR0RpcEnvelope<CtR0Service360, null>> {
  const decoded = decodeCtR0SchemaEnvelope(value, ctR0Service360Schema, z.null());
  if (decoded.ok === false || decoded.value.kind === "DENIED") return decoded;

  const { source_mode: sourceMode, data } = decoded.value.envelope;
  const isFixtureDocument = "fixture" in data && data.fixture === true;
  if ((sourceMode === "fixture") !== isFixtureDocument) {
    return { ok: false, issues: [{ path: "$.data", code: "source_mode_mismatch" }] };
  }
  return decoded;
}

export const ctR0ParentSafeIncidentValueSchema = z
  .object({
    incident_id: uuidSchema,
    category: z.enum([
      "bullying",
      "exclusion",
      "sexual_content",
      "violence",
      "grooming",
      "manipulation",
      "stranger_contact",
      "self_harm",
      "other",
    ]),
    severity: z.enum(["low", "medium", "high", "critical"]),
    child_role: z.enum(["target", "participant", "initiator", "unknown"]),
    confidence: z.number().min(0).max(1),
    capture_quality: z.number().min(0).max(1),
    status: z.enum(["confirmed", "alerted"]),
    source_platform: z.literal("whatsapp"),
    privacy_contract_version: z.literal(1),
    reason_code: safeKeySchema,
    action_code: safeKeySchema,
    safe_summary: boundedTextSchema,
    safe_reason: boundedTextSchema,
    recommended_action: boundedTextSchema,
    occurred_at: isoDateTimeSchema,
    received_at: isoDateTimeSchema,
    analyzed_at: isoDateTimeSchema,
    delivery: z
      .object({
        attempt_count: z.number().int().nonnegative(),
        delivered_count: z.number().int().nonnegative(),
        channels: z.array(z.enum(["push", "email", "in_app"])).max(3),
        last_attempted_at: nullableDateTimeSchema,
        last_delivered_at: nullableDateTimeSchema,
      })
      .strict(),
  })
  .strict();
export type CtR0ParentSafeIncidentValue = z.infer<typeof ctR0ParentSafeIncidentValueSchema>;

export const ctR0ParentSafeIncidentSchema = ctR0FieldEnvelopeSchema(
  ctR0ParentSafeIncidentValueSchema,
);
export type CtR0ParentSafeIncident =
  | z.infer<typeof ctR0ParentSafeIncidentSchema>
  | z.infer<typeof ctR0FixtureFieldEnvelopeSchema>;

const ctR0ParentSafeIncidentResponseDataSchema = z.union([
  ctR0ParentSafeIncidentSchema,
  ctR0FixtureFieldEnvelopeSchema,
]);

export function decodeCtR0ParentSafeIncident(
  value: unknown,
): CtR0DecodeResult<CtR0ParentSafeIncident> {
  return decodeWithSchema(ctR0ParentSafeIncidentResponseDataSchema, value);
}

export function decodeCtR0ParentSafeIncidentEnvelope(
  value: unknown,
): CtR0DecodeResult<CtR0RpcEnvelope<CtR0ParentSafeIncident, null>> {
  const decoded = decodeCtR0SchemaEnvelope(
    value,
    ctR0ParentSafeIncidentResponseDataSchema,
    z.null(),
  );
  if (decoded.ok === false || decoded.value.kind === "DENIED") return decoded;

  const { source_mode: sourceMode, data } = decoded.value.envelope;
  const isCanonicalEnvelope = "observed_at" in data;
  if ((sourceMode === "staging") !== isCanonicalEnvelope) {
    return { ok: false, issues: [{ path: "$.data", code: "source_mode_mismatch" }] };
  }
  return decoded;
}
