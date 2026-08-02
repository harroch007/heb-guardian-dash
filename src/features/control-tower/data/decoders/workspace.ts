import { z } from "zod";

import {
  ctR0PageSchema,
  ctR0SensitivitySchema,
  ctR0SourceModeSchema,
  decodeCtR0SchemaEnvelope,
  type CtR0Page,
  type CtR0RpcEnvelope,
} from "./common";
import {
  ctR0CaseStatusSchema,
  ctR0ChannelSchema,
  ctR0ConversationStatusSchema,
  ctR0PrioritySchema,
  ctR0VerificationLevelSchema,
} from "./sessionInbox";
import {
  bigintIdSchema,
  boundedTextSchema,
  decodeWithSchema,
  isoDateTimeSchema,
  nullableBoundedTextSchema,
  nullableDateTimeSchema,
  nullableUuidSchema,
  safeJsonValueSchema,
  safeKeySchema,
  uuidSchema,
  type CtR0DecodeResult,
} from "./primitives";

export const ctR0ConversationSchema = z
  .object({
    conversation_id: uuidSchema,
    source_mode: ctR0SourceModeSchema,
    channel: ctR0ChannelSchema,
    status: ctR0ConversationStatusSchema,
    verification_level: ctR0VerificationLevelSchema,
    contact_label: boundedTextSchema,
    responder_principal_id: nullableUuidSchema,
    responder_lease_expires_at: nullableDateTimeSchema,
    last_activity_at: isoDateTimeSchema,
    created_at: isoDateTimeSchema,
    closed_at: nullableDateTimeSchema,
    case_id: nullableUuidSchema,
  })
  .strict();
export type CtR0Conversation = z.infer<typeof ctR0ConversationSchema>;

export function decodeCtR0Conversation(value: unknown): CtR0DecodeResult<CtR0Conversation> {
  return decodeWithSchema(ctR0ConversationSchema, value);
}

export function decodeCtR0ConversationEnvelope(
  value: unknown,
): CtR0DecodeResult<CtR0RpcEnvelope<CtR0Conversation, null>> {
  return decodeCtR0SchemaEnvelope(value, ctR0ConversationSchema, z.null());
}

export const ctR0CaseConversationSchema = z
  .object({
    conversation_id: uuidSchema,
    is_primary: z.boolean(),
    linked_at: isoDateTimeSchema,
  })
  .strict();
export type CtR0CaseConversation = z.infer<typeof ctR0CaseConversationSchema>;

export const ctR0CaseParticipantSchema = z
  .object({
    principal_id: uuidSchema,
    participant_role: z.enum(["owner", "resolver", "supervisor", "viewer"]),
    assigned_at: isoDateTimeSchema,
  })
  .strict();
export type CtR0CaseParticipant = z.infer<typeof ctR0CaseParticipantSchema>;

export const ctR0CaseSchema = z
  .object({
    case_id: uuidSchema,
    case_number: bigintIdSchema,
    source_mode: ctR0SourceModeSchema,
    domain_key: safeKeySchema,
    category_key: safeKeySchema,
    intent_key: safeKeySchema,
    priority: ctR0PrioritySchema,
    status: ctR0CaseStatusSchema,
    substatus: z.string().max(240).nullable(),
    queue_key: safeKeySchema,
    purpose_code: safeKeySchema,
    sensitivity: ctR0SensitivitySchema,
    privacy_class: safeKeySchema,
    verification_level: ctR0VerificationLevelSchema,
    accountable_owner_principal_id: nullableUuidSchema,
    resolver_principal_id: nullableUuidSchema,
    human_supervisor_principal_id: nullableUuidSchema,
    sla_deadline_at: nullableDateTimeSchema,
    wait_deadline_at: nullableDateTimeSchema,
    reopen_count: z.number().int().nonnegative(),
    last_activity_at: isoDateTimeSchema,
    created_at: isoDateTimeSchema,
    closed_at: nullableDateTimeSchema,
    conversations: z.array(ctR0CaseConversationSchema).max(100),
    participants: z.array(ctR0CaseParticipantSchema).max(100),
  })
  .strict();
export type CtR0Case = z.infer<typeof ctR0CaseSchema>;

export function decodeCtR0Case(value: unknown): CtR0DecodeResult<CtR0Case> {
  return decodeWithSchema(ctR0CaseSchema, value);
}

export function decodeCtR0CaseEnvelope(
  value: unknown,
): CtR0DecodeResult<CtR0RpcEnvelope<CtR0Case, null>> {
  return decodeCtR0SchemaEnvelope(value, ctR0CaseSchema, z.null());
}

export const ctR0MessageDirectionSchema = z.enum(["inbound", "outbound", "internal"]);
export type CtR0MessageDirection = z.infer<typeof ctR0MessageDirectionSchema>;

export const ctR0MessageTypeSchema = z.enum([
  "text",
  "image",
  "video",
  "audio",
  "voice",
  "document",
  "location",
  "contact",
  "interactive",
  "reaction",
  "sticker",
  "button",
  "contacts",
  "order",
  "system",
  "unsupported",
  "internal_note",
]);
export type CtR0MessageType = z.infer<typeof ctR0MessageTypeSchema>;

export const ctR0IngestStatusSchema = z.enum([
  "received",
  "validated",
  "persisted",
  "duplicate",
  "rejected",
]);
export type CtR0IngestStatus = z.infer<typeof ctR0IngestStatusSchema>;

export const ctR0DeliveryStatusSchema = z.enum([
  "not_applicable",
  "queued",
  "provider_accepted",
  "delivered",
  "read",
  "failed",
]);
export type CtR0DeliveryStatus = z.infer<typeof ctR0DeliveryStatusSchema>;

export const ctR0MessageSchema = z
  .object({
    message_id: uuidSchema,
    conversation_id: uuidSchema,
    direction: ctR0MessageDirectionSchema,
    message_type: ctR0MessageTypeSchema,
    ingest_status: ctR0IngestStatusSchema,
    delivery_status: ctR0DeliveryStatusSchema,
    redacted_value: z.string().max(4_000).nullable(),
    content_available: z.boolean(),
    provider_occurred_at: nullableDateTimeSchema,
    server_received_at: isoDateTimeSchema,
    sensitivity: ctR0SensitivitySchema,
  })
  .strict();
export type CtR0Message = z.infer<typeof ctR0MessageSchema>;

const ctR0MessagesSchema = z.array(ctR0MessageSchema).max(100);

export function decodeCtR0Messages(value: unknown): CtR0DecodeResult<readonly CtR0Message[]> {
  return decodeWithSchema(ctR0MessagesSchema, value);
}

export function decodeCtR0MessagesEnvelope(
  value: unknown,
): CtR0DecodeResult<CtR0RpcEnvelope<readonly CtR0Message[], CtR0Page>> {
  return decodeCtR0SchemaEnvelope(value, ctR0MessagesSchema, ctR0PageSchema);
}

export const ctR0MessageCursorSchema = z
  .object({
    beforeServerReceivedAt: isoDateTimeSchema,
    beforeMessageId: uuidSchema,
  })
  .strict();
export type CtR0MessageCursor = z.infer<typeof ctR0MessageCursorSchema>;

export function decodeCtR0MessageCursor(value: unknown): CtR0DecodeResult<CtR0MessageCursor> {
  return decodeWithSchema(ctR0MessageCursorSchema, value);
}

export const ctR0MessageQuerySchema = z
  .object({
    cursor: ctR0MessageCursorSchema.nullable().default(null),
    limit: z.number().int().min(1).max(100).default(100),
  })
  .strict();
export type CtR0MessageQuery = z.input<typeof ctR0MessageQuerySchema>;
export type CtR0DecodedMessageQuery = z.output<typeof ctR0MessageQuerySchema>;

export function decodeCtR0MessageQuery(value: unknown): CtR0DecodeResult<CtR0DecodedMessageQuery> {
  return decodeWithSchema(ctR0MessageQuerySchema, value);
}

export const ctR0CaseTimelineEventSchema = z
  .object({
    timeline_type: z.literal("case_event"),
    event_id: uuidSchema,
    event_type: safeKeySchema,
    previous_status: nullableBoundedTextSchema,
    new_status: nullableBoundedTextSchema,
    actor_principal_id: nullableUuidSchema,
    reason_code: boundedTextSchema,
    safe_metadata: safeJsonValueSchema,
    occurred_at: isoDateTimeSchema,
  })
  .strict();
export type CtR0CaseTimelineEvent = z.infer<typeof ctR0CaseTimelineEventSchema>;

export const ctR0ActionRiskSchema = z.enum([
  "r0_masked",
  "r0_sensitive",
  "r1_internal",
  "r1_communication",
  "r2",
  "r3",
]);
export type CtR0ActionRisk = z.infer<typeof ctR0ActionRiskSchema>;

export const ctR0ActionStatusSchema = z.enum([
  "draft",
  "policy_checked",
  "approval_pending",
  "authorized",
  "queued",
  "dispatched",
  "acknowledged",
  "verifying",
  "verified",
  "denied",
  "declined",
  "expired",
  "cancelled",
  "failed_retryable",
  "failed_final",
]);
export type CtR0ActionStatus = z.infer<typeof ctR0ActionStatusSchema>;

export const ctR0ActionTimelineEventSchema = z
  .object({
    timeline_type: z.literal("action"),
    action_id: uuidSchema,
    action_key: safeKeySchema,
    risk_class: ctR0ActionRiskSchema,
    status: ctR0ActionStatusSchema,
    created_at: isoDateTimeSchema,
  })
  .strict();
export type CtR0ActionTimelineEvent = z.infer<typeof ctR0ActionTimelineEventSchema>;

export const ctR0TimelineEventSchema = z.discriminatedUnion("timeline_type", [
  ctR0CaseTimelineEventSchema,
  ctR0ActionTimelineEventSchema,
]);
export type CtR0TimelineEvent = z.infer<typeof ctR0TimelineEventSchema>;

const ctR0TimelineSchema = z.array(ctR0TimelineEventSchema).max(100);

export function decodeCtR0Timeline(value: unknown): CtR0DecodeResult<readonly CtR0TimelineEvent[]> {
  return decodeWithSchema(ctR0TimelineSchema, value);
}

export function decodeCtR0TimelineEnvelope(
  value: unknown,
): CtR0DecodeResult<CtR0RpcEnvelope<readonly CtR0TimelineEvent[], CtR0Page>> {
  return decodeCtR0SchemaEnvelope(value, ctR0TimelineSchema, ctR0PageSchema);
}

export const ctR0TimelineCursorSchema = z
  .object({
    beforeOccurredAt: isoDateTimeSchema,
    beforeEventId: bigintIdSchema,
  })
  .strict();
export type CtR0TimelineCursor = z.infer<typeof ctR0TimelineCursorSchema>;

export function decodeCtR0TimelineCursor(value: unknown): CtR0DecodeResult<CtR0TimelineCursor> {
  return decodeWithSchema(ctR0TimelineCursorSchema, value);
}

export const ctR0TimelineQuerySchema = z
  .object({
    cursor: ctR0TimelineCursorSchema.nullable().default(null),
    limit: z.number().int().min(1).max(100).default(100),
  })
  .strict();
export type CtR0TimelineQuery = z.input<typeof ctR0TimelineQuerySchema>;
export type CtR0DecodedTimelineQuery = z.output<typeof ctR0TimelineQuerySchema>;

export function decodeCtR0TimelineQuery(value: unknown): CtR0DecodeResult<CtR0DecodedTimelineQuery> {
  return decodeWithSchema(ctR0TimelineQuerySchema, value);
}
