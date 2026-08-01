import { z } from "zod";

import type { StaffPermission, StaffRole } from "../../domain/types";
import {
  ctR0EnvironmentSchema,
  ctR0PageSchema,
  decodeCtR0SchemaEnvelope,
  type CtR0Page,
  type CtR0RpcEnvelope,
} from "./common";
import {
  bigintIdSchema,
  boundedTextSchema,
  decodeWithSchema,
  isoDateTimeSchema,
  nullableDateTimeSchema,
  nullableUuidSchema,
  safeKeySchema,
  uuidSchema,
  type CtR0DecodeResult,
} from "./primitives";

export const ctR0StaffRoleSchema = z.enum([
  "ceo",
  "platform_super_admin",
  "support_manager",
  "support_agent",
  "device_support",
  "finance",
  "trust_and_safety",
  "privacy_dpo",
  "security_sre",
  "growth_product_data",
  "auditor",
]);
export type CtR0StaffRole = z.infer<typeof ctR0StaffRoleSchema>;

export const ctR0PermissionSchema = z.enum([
  "control.session.read",
  "fixture.read",
  "inbox.read",
  "conversation.read",
  "case.read.assigned",
  "case.read.all",
  "message.read.redacted",
  "service360.read.masked",
  "device.install.read",
  "device.health.read",
  "device.command_lifecycle.read",
  "safety.parent_safe.read",
  "audit.read",
  "iam.read",
]);
export type CtR0Permission = z.infer<typeof ctR0PermissionSchema>;

const roleMap: Readonly<Record<CtR0StaffRole, StaffRole>> = {
  ceo: "CEO",
  platform_super_admin: "PLATFORM_SUPER_ADMIN",
  support_manager: "SUPPORT_MANAGER",
  support_agent: "SUPPORT_AGENT",
  device_support: "DEVICE_SUPPORT",
  finance: "FINANCE",
  trust_and_safety: "TRUST_AND_SAFETY",
  privacy_dpo: "PRIVACY_DPO",
  security_sre: "SECURITY_SRE",
  growth_product_data: "GROWTH_PRODUCT_DATA",
  auditor: "AUDITOR",
};

export function mapCtR0RolesToUi(roles: readonly CtR0StaffRole[]): readonly StaffRole[] {
  return roles.map((role) => roleMap[role]);
}

export function mapCtR0PermissionsToUi(
  permissions: readonly CtR0Permission[],
): readonly StaffPermission[] {
  const source = new Set(permissions);
  const mapped = new Set<StaffPermission>();

  if (source.has("control.session.read")) mapped.add("control_tower.access");
  if (source.has("case.read.all")) mapped.add("inbox.read.all");
  if (source.has("case.read.assigned")) mapped.add("inbox.read.assigned");
  if (source.has("conversation.read")) mapped.add("conversation.read");
  if (source.has("case.read.all") || source.has("case.read.assigned")) mapped.add("case.read");
  if (source.has("service360.read.masked")) mapped.add("customer360.read.masked");
  if (source.has("device.install.read") || source.has("device.health.read")) {
    mapped.add("diagnostics.read.device");
  }

  return [...mapped];
}

export const ctR0SessionSchema = z
  .object({
    principal_id: uuidSchema,
    display_name: z.string().min(1).max(120),
    environment: ctR0EnvironmentSchema,
    status: z.enum(["invited", "shadow", "active", "suspended", "revoked"]),
    aal: z.enum(["aal1", "aal2", "unknown"]),
    roles: z.array(ctR0StaffRoleSchema).max(32),
    permissions: z.array(ctR0PermissionSchema).max(64),
  })
  .strict();
export type CtR0Session = z.infer<typeof ctR0SessionSchema>;

export function decodeCtR0Session(value: unknown): CtR0DecodeResult<CtR0Session> {
  return decodeWithSchema(ctR0SessionSchema, value);
}

export function decodeCtR0SessionEnvelope(
  value: unknown,
): CtR0DecodeResult<CtR0RpcEnvelope<CtR0Session, null>> {
  return decodeCtR0SchemaEnvelope(value, ctR0SessionSchema, z.null());
}

export const ctR0ConversationStatusSchema = z.enum([
  "open",
  "ai_active",
  "takeover_requested",
  "human_active",
  "waiting_for_customer",
  "waiting_for_human",
  "resolved",
  "closed",
]);
export type CtR0ConversationStatus = z.infer<typeof ctR0ConversationStatusSchema>;

export const ctR0VerificationLevelSchema = z.enum([
  "v0_unknown",
  "v1_channel_possession",
  "v2_guardian",
  "v3_action_bound",
]);
export type CtR0VerificationLevel = z.infer<typeof ctR0VerificationLevelSchema>;

export const ctR0ChannelSchema = z.enum(["fixture", "whatsapp", "web", "email", "phone"]);
export type CtR0Channel = z.infer<typeof ctR0ChannelSchema>;

export const ctR0CaseStatusSchema = z.enum([
  "open",
  "triaged",
  "identity_pending",
  "working",
  "waiting_for_customer",
  "waiting_for_data",
  "waiting_for_human",
  "waiting_for_external",
  "resolution_proposed",
  "verifying_resolution",
  "resolved",
  "closed",
]);
export type CtR0CaseStatus = z.infer<typeof ctR0CaseStatusSchema>;

export const ctR0PrioritySchema = z.enum(["s0", "s1", "s2", "s3"]);
export type CtR0Priority = z.infer<typeof ctR0PrioritySchema>;

export const ctR0InboxItemSchema = z
  .object({
    conversation_id: uuidSchema,
    conversation_status: ctR0ConversationStatusSchema,
    channel: ctR0ChannelSchema,
    verification_level: ctR0VerificationLevelSchema,
    contact_label: boundedTextSchema,
    last_activity_at: isoDateTimeSchema,
    case_id: nullableUuidSchema,
    case_number: bigintIdSchema.nullable(),
    case_status: ctR0CaseStatusSchema.nullable(),
    priority: ctR0PrioritySchema.nullable(),
    queue_key: safeKeySchema.nullable(),
    domain_key: safeKeySchema.nullable(),
    sla_deadline_at: nullableDateTimeSchema,
  })
  .strict();
export type CtR0InboxItem = z.infer<typeof ctR0InboxItemSchema>;

const ctR0InboxSchema = z.array(ctR0InboxItemSchema).max(100);

export function decodeCtR0Inbox(value: unknown): CtR0DecodeResult<readonly CtR0InboxItem[]> {
  return decodeWithSchema(ctR0InboxSchema, value);
}

export function decodeCtR0InboxEnvelope(
  value: unknown,
): CtR0DecodeResult<CtR0RpcEnvelope<readonly CtR0InboxItem[], CtR0Page>> {
  return decodeCtR0SchemaEnvelope(value, ctR0InboxSchema, ctR0PageSchema);
}

export const ctR0InboxCursorSchema = z
  .object({
    beforeLastActivityAt: isoDateTimeSchema,
    beforeConversationId: uuidSchema,
  })
  .strict();
export type CtR0InboxCursor = z.infer<typeof ctR0InboxCursorSchema>;

export function decodeCtR0InboxCursor(value: unknown): CtR0DecodeResult<CtR0InboxCursor> {
  return decodeWithSchema(ctR0InboxCursorSchema, value);
}

export const ctR0InboxQuerySchema = z
  .object({
    queueKey: safeKeySchema.nullable().default(null),
    caseStatus: ctR0CaseStatusSchema.nullable().default(null),
    cursor: ctR0InboxCursorSchema.nullable().default(null),
    limit: z.number().int().min(1).max(100).default(50),
  })
  .strict();
export type CtR0InboxQuery = z.input<typeof ctR0InboxQuerySchema>;
export type CtR0DecodedInboxQuery = z.output<typeof ctR0InboxQuerySchema>;

export function decodeCtR0InboxQuery(value: unknown): CtR0DecodeResult<CtR0DecodedInboxQuery> {
  return decodeWithSchema(ctR0InboxQuerySchema, value);
}

