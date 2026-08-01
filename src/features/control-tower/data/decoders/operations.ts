import { z } from "zod";

import {
  ctR0PageSchema,
  ctR0SensitivitySchema,
  decodeCtR0SchemaEnvelope,
  type CtR0Page,
  type CtR0RpcEnvelope,
} from "./common";
import { ctR0ActionRiskSchema, ctR0ActionStatusSchema } from "./workspace";
import {
  bigintIdSchema,
  decodeWithSchema,
  isoDateTimeSchema,
  nullableDateTimeSchema,
  nullableUuidSchema,
  safeJsonValueSchema,
  safeKeySchema,
  uuidSchema,
  type CtR0DecodeResult,
} from "./primitives";

export const ctR0ApprovalSchema = z
  .object({
    approval_id: uuidSchema,
    approval_kind: z.enum(["guardian", "staff_second_eye", "step_up", "policy"]),
    decision: z.enum(["approved", "declined"]),
    assurance_level: z.string().min(1).max(120).nullable(),
    decided_at: isoDateTimeSchema,
    expires_at: isoDateTimeSchema,
  })
  .strict();
export type CtR0Approval = z.infer<typeof ctR0ApprovalSchema>;

export const ctR0ActionEffectSchema = z
  .object({
    outbox_id: uuidSchema,
    effect_key: safeKeySchema,
    destination_kind: safeKeySchema,
    status: z.enum([
      "pending",
      "leased",
      "dispatched",
      "acknowledged",
      "failed_retryable",
      "dead_letter",
      "cancelled",
    ]),
    attempt_count: z.number().int().nonnegative(),
    not_before: isoDateTimeSchema,
    dispatched_at: nullableDateTimeSchema,
    acknowledged_at: nullableDateTimeSchema,
    last_failure_code: z.string().max(120).nullable(),
  })
  .strict();
export type CtR0ActionEffect = z.infer<typeof ctR0ActionEffectSchema>;

export const ctR0CaseActionSchema = z
  .object({
    action_id: uuidSchema,
    action_key: safeKeySchema,
    risk_class: ctR0ActionRiskSchema,
    status: ctR0ActionStatusSchema,
    resource_type: safeKeySchema,
    resource_id: nullableUuidSchema,
    purpose_code: safeKeySchema,
    policy_version: z.string().min(1).max(80),
    expected_revision: z.string().max(240).nullable(),
    expires_at: isoDateTimeSchema,
    created_at: isoDateTimeSchema,
    updated_at: isoDateTimeSchema,
    approvals: z.array(ctR0ApprovalSchema).max(100),
    effects: z.array(ctR0ActionEffectSchema).max(100),
  })
  .strict();
export type CtR0CaseAction = z.infer<typeof ctR0CaseActionSchema>;

const ctR0CaseActionsSchema = z.array(ctR0CaseActionSchema).max(100);

export function decodeCtR0CaseActions(value: unknown): CtR0DecodeResult<readonly CtR0CaseAction[]> {
  return decodeWithSchema(ctR0CaseActionsSchema, value);
}

export function decodeCtR0CaseActionsEnvelope(
  value: unknown,
): CtR0DecodeResult<CtR0RpcEnvelope<readonly CtR0CaseAction[], CtR0Page>> {
  return decodeCtR0SchemaEnvelope(value, ctR0CaseActionsSchema, ctR0PageSchema);
}

export const ctR0AuditOutcomeSchema = z.enum(["success", "denied", "failed"]);
export type CtR0AuditOutcome = z.infer<typeof ctR0AuditOutcomeSchema>;

export const ctR0AuditEventSchema = z
  .object({
    audit_event_id: bigintIdSchema,
    event_id: uuidSchema,
    event_type: safeKeySchema,
    outcome: ctR0AuditOutcomeSchema,
    actor_principal_id: nullableUuidSchema,
    sponsor_principal_id: nullableUuidSchema,
    case_id: nullableUuidSchema,
    conversation_id: nullableUuidSchema,
    action_request_id: nullableUuidSchema,
    approval_id: nullableUuidSchema,
    purpose_code: safeKeySchema,
    permission_snapshot: safeJsonValueSchema,
    policy_version: z.string().max(240).nullable(),
    policy_decision: z.string().max(240).nullable(),
    deny_reason_code: z.string().max(240).nullable(),
    object_type: safeKeySchema,
    object_id: nullableUuidSchema,
    requested_action: z.string().max(240).nullable(),
    executed_action: z.string().max(240).nullable(),
    field_keys: z.array(safeKeySchema).max(256),
    sensitivity: ctR0SensitivitySchema,
    correlation_id: uuidSchema,
    version_snapshot: safeJsonValueSchema,
    safe_metadata: safeJsonValueSchema,
    created_at: isoDateTimeSchema,
  })
  .strict();
export type CtR0AuditEvent = z.infer<typeof ctR0AuditEventSchema>;

const ctR0AuditEventsSchema = z.array(ctR0AuditEventSchema).max(100);

export function decodeCtR0AuditEvents(value: unknown): CtR0DecodeResult<readonly CtR0AuditEvent[]> {
  return decodeWithSchema(ctR0AuditEventsSchema, value);
}

export function decodeCtR0AuditEventsEnvelope(
  value: unknown,
): CtR0DecodeResult<CtR0RpcEnvelope<readonly CtR0AuditEvent[], CtR0Page>> {
  return decodeCtR0SchemaEnvelope(value, ctR0AuditEventsSchema, ctR0PageSchema);
}

export const ctR0AuditCursorSchema = z
  .object({
    beforeCreatedAt: isoDateTimeSchema,
    beforeEventId: bigintIdSchema,
  })
  .strict();
export type CtR0AuditCursor = z.infer<typeof ctR0AuditCursorSchema>;

export function decodeCtR0AuditCursor(value: unknown): CtR0DecodeResult<CtR0AuditCursor> {
  return decodeWithSchema(ctR0AuditCursorSchema, value);
}

export const ctR0AuditQuerySchema = z
  .object({
    caseId: uuidSchema.nullable().default(null),
    cursor: ctR0AuditCursorSchema.nullable().default(null),
    limit: z.number().int().min(1).max(100).default(100),
  })
  .strict();
export type CtR0AuditQuery = z.input<typeof ctR0AuditQuerySchema>;
export type CtR0DecodedAuditQuery = z.output<typeof ctR0AuditQuerySchema>;

export function decodeCtR0AuditQuery(value: unknown): CtR0DecodeResult<CtR0DecodedAuditQuery> {
  return decodeWithSchema(ctR0AuditQuerySchema, value);
}

