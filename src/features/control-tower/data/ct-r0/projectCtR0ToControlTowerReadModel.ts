import type {
  CtR0Case,
  CtR0Conversation,
  CtR0FieldEnvelope,
  CtR0InboxItem,
  CtR0Message,
  CtR0Session,
  CtR0StagingService360,
  CtR0TimelineEvent,
} from "../decoders";
import { mapCtR0PermissionsToUi, mapCtR0RolesToUi } from "../decoders";
import type {
  CapabilityDiagnostic,
  CaseDomain,
  CaseState,
  ConversationListItem,
  ConversationState,
  ConversationWorkspace,
  Customer360Snapshot,
  DataEnvelope,
  DeliveryState,
  DeviceCapabilityKey,
  FieldContractAvailability,
  FieldValueState,
  FreshnessStatus,
  GuardianRole,
  MessageType,
  MonitoringState,
  OperationalTimelineEvent,
  Priority,
  Redaction,
  Sensitivity,
  StaffAccess,
  SupportMessage,
  VerificationLevel,
} from "../../domain/types";

export const CT_R1_PROJECTION_REQUIRED_FIELDS = [
  "inbox.queue_totals",
  "inbox.unread_count",
  "inbox.last_message_preview",
  "inbox.last_delivery_summary",
  "inbox.identity_match",
  "inbox.full_sla_clock",
  "case.accountable_owner_label",
  "case.root_cause",
  "case.resolution_code",
  "message.sender_metadata",
  "message.attachment_metadata",
  "message.reply_metadata",
  "message.template_metadata",
  "service360.android_os_version",
  "service360.android_build",
  "service360.entitlement",
  "service360.parental_sync",
  "service360.repair_guidance",
  "workspace.allowed_action_catalogue",
] as const;

export type CtR1ProjectionRequiredField = (typeof CT_R1_PROJECTION_REQUIRED_FIELDS)[number];

export interface CtR0WorkspaceProjectionInput {
  readonly generatedAt: string;
  readonly conversation: CtR0Conversation;
  readonly caseRecord: CtR0Case | null;
  readonly messages: readonly CtR0Message[];
  readonly timeline: readonly CtR0TimelineEvent[];
  readonly service360: CtR0StagingService360 | null;
}

export function projectCtR0SessionToStaffAccess(session: CtR0Session): StaffAccess {
  return {
    kind: "GRANTED",
    fixture: false,
    session: {
      staffId: session.principal_id,
      displayName: session.display_name,
      roles: mapCtR0RolesToUi(session.roles),
      permissions: mapCtR0PermissionsToUi(session.permissions),
      environment: session.environment.toUpperCase() as "STAGING" | "PRODUCTION",
      assurance: session.aal.toUpperCase() as "AAL1" | "AAL2",
      expiresAt: null,
    },
  };
}

export function projectCtR0InboxItem(item: CtR0InboxItem): ConversationListItem {
  const verificationLevel = mapVerification(item.verification_level);
  return {
    conversationId: item.conversation_id,
    maskedContactLabel: item.contact_label,
    maskedChannelAddress: item.channel.toUpperCase(),
    verificationLevel,
    guardianRole: guardianRoleFor(verificationLevel),
    domains: item.domain_key ? [mapDomain(item.domain_key)] : [],
    priority: mapPriority(item.priority),
    state: mapConversationState(item.conversation_status),
    queueId: item.queue_key ?? "unassigned",
    caseIds: item.case_id ? [item.case_id] : [],
    unreadCount: null,
    lastMessagePreview: null,
    lastMessageAt: item.last_activity_at,
    lastDeliveryState: null,
    identityMatch: identityFor(verificationLevel),
    sla: slaFor(item.sla_deadline_at),
    sensitive: identityFor(verificationLevel) !== "VERIFIED",
    projectionGaps: CT_R1_PROJECTION_REQUIRED_FIELDS,
  };
}

export function projectCtR0Workspace(
  input: CtR0WorkspaceProjectionInput,
): ConversationWorkspace {
  const { conversation, caseRecord } = input;
  const verificationLevel = mapVerification(conversation.verification_level);
  const conversationModel: ConversationListItem = {
    conversationId: conversation.conversation_id,
    maskedContactLabel: conversation.contact_label,
    maskedChannelAddress: conversation.channel.toUpperCase(),
    verificationLevel,
    guardianRole: guardianRoleFor(verificationLevel),
    domains: caseRecord ? [mapDomain(caseRecord.domain_key)] : [],
    priority: mapPriority(caseRecord?.priority ?? null),
    state: mapConversationState(conversation.status),
    queueId: caseRecord?.queue_key ?? "unassigned",
    caseIds: caseRecord ? [caseRecord.case_id] : [],
    unreadCount: null,
    lastMessagePreview: null,
    lastMessageAt: conversation.last_activity_at,
    lastDeliveryState: null,
    identityMatch: identityFor(verificationLevel),
    sla: slaFor(caseRecord?.sla_deadline_at ?? null),
    sensitive: identityFor(verificationLevel) !== "VERIFIED",
    projectionGaps: CT_R1_PROJECTION_REQUIRED_FIELDS,
  };

  return {
    version: [
      "ct-r0",
      conversation.last_activity_at,
      caseRecord?.last_activity_at ?? "no-case",
    ].join(":"),
    conversation: conversationModel,
    messages: input.messages.map(projectMessage),
    cases: caseRecord
      ? [{
          caseId: caseRecord.case_id,
          state: mapCaseState(caseRecord.status),
          domain: mapDomain(caseRecord.domain_key),
          priority: mapPriority(caseRecord.priority),
          accountableOwnerLabel: caseRecord.accountable_owner_principal_id
            ? "מזהה אחראי זמין ביומן המאובטח"
            : "לא הוקצה",
          rootCause: null,
          resolutionCode: null,
          reopenCount: caseRecord.reopen_count,
        }]
      : [],
    customer360: input.service360
      ? projectService360(input.service360, input.generatedAt, verificationLevel)
      : null,
    timeline: input.timeline.map(projectTimelineEvent),
    allowedActions: [],
    projectionGaps: CT_R1_PROJECTION_REQUIRED_FIELDS,
  };
}

function projectMessage(message: CtR0Message): SupportMessage {
  const body = message.redacted_value !== null
    ? availableField(message.redacted_value, "v2_support_messages.redacted_value", message.server_received_at, message.sensitivity)
    : unavailableField<string>(
        "v2_support_messages.protected_content",
        message.content_available ? "PROHIBITED" : "NOT_COLLECTED",
        message.content_available ? "PROHIBITED" : "NOT_COLLECTED",
        message.sensitivity,
      );
  return {
    messageId: message.message_id,
    conversationId: message.conversation_id,
    direction: message.direction === "outbound"
      ? "OUTBOUND"
      : message.direction === "internal"
        ? "INTERNAL"
        : "INBOUND",
    senderKind: message.direction === "outbound"
      ? "STAFF"
      : message.direction === "internal"
        ? "SYSTEM"
        : "CUSTOMER",
    type: mapMessageType(message.message_type),
    body,
    attachment: null,
    replyToMessageId: null,
    deliveryState: mapDelivery(message.delivery_status),
    providerObservedAt: message.provider_occurred_at ?? message.server_received_at,
    serverReceivedAt: message.server_received_at,
    templateId: null,
    templateVersion: null,
  };
}

function projectTimelineEvent(event: CtR0TimelineEvent): OperationalTimelineEvent {
  if (event.timeline_type === "action") {
    return {
      eventId: event.action_id,
      type: "ACTION",
      occurredAt: event.created_at,
      actorLabel: "Control Tower",
      summary: `${event.action_key} · ${event.status}`,
      sensitivity: "INTERNAL",
      immutableAuditReference: event.action_id,
    };
  }
  return {
    eventId: event.event_id,
    type: mapTimelineType(event.event_type),
    occurredAt: event.occurred_at,
    actorLabel: event.actor_principal_id ? "Staff/Agent" : "System",
    summary: event.reason_code,
    sensitivity: "INTERNAL",
    immutableAuditReference: event.event_id,
  };
}

function projectService360(
  source: CtR0StagingService360,
  generatedAt: string,
  verificationLevel: VerificationLevel,
): Customer360Snapshot {
  const capabilities: CapabilityDiagnostic[] = (source.capabilities.value ?? []).map((item) => ({
    key: item.key,
    displayName: item.key,
    state: projectField(source.capabilities, () => item.state),
    requiredByPolicy: unavailableField<boolean>("control_tower.policy_projection", "REQUIRES_PROJECTION"),
    impact: capabilityImpact(item.key),
    reasonCodes: [],
    repairInstruction: unavailableField<string>("control_tower.repair_guidance", "REQUIRES_PROJECTION"),
  }));
  const parentalResource = source.parental_controls.source || "v2_parental_settings_projection";

  return {
    snapshotAt: generatedAt,
    contactId: null,
    verificationLevel,
    guardianRole: guardianRoleFor(verificationLevel),
    familyLabel: projectField(source.family, (value) => value.display_label),
    childLabel: projectField(source.child, (value) => value.display_label),
    entitlement: unavailableField<string>("billing.entitlement_projection", "NEW_DOMAIN_REQUIRED"),
    installation: {
      status: projectField(source.install, (value) => value.status.toUpperCase() as Customer360Snapshot["installation"]["status"]["value"]),
      expiresAt: projectField(source.install, (value) => value.expires_at),
      otpRequestCount: projectField(source.install, (value) => value.otp_request_count),
      pairedAt: projectField(source.install, (value) => value.consumed_at ?? value.activated_at),
      setupStep: projectField(source.install, (value) => value.status),
    },
    device: {
      deviceId: projectField(source.device, (value) => value.device_id),
      manufacturer: projectField(source.device, (value) => value.manufacturer),
      model: projectField(source.device, (value) => value.model),
      androidVersion: unavailableField<string>("v2_protected_devices.android_version", "REQUIRES_PROJECTION"),
      appVersion: projectField(source.device, (value) => value.app_version),
      build: unavailableField<string>("v2_protected_devices.build", "REQUIRES_PROJECTION"),
      captureContractVersion: projectField(source.device, (value) => value.capture_contract_version),
      status: projectField(source.device, (value) => value.status),
      lastSeenAt: projectField(source.device, (value) => value.last_seen_at),
      batteryPercent: projectField(source.device, (value) => value.battery_level_percent),
    },
    capabilities,
    monitoring: {
      state: projectField(source.monitoring, (value) => value.state.toUpperCase() as MonitoringState),
      lastHealthyAt: projectField(source.monitoring, (value) => value.last_observed_at),
      lateAfterAt: projectField(source.monitoring, (value) => value.late_after_at),
      interruptedAfterAt: projectField(source.monitoring, (value) => value.interrupted_after_at),
      reasonCodes: source.monitoring.value?.reason_codes ?? [],
    },
    parentalSync: {
      desiredRevision: unavailableField<number>(parentalResource, source.parental_controls.availability),
      appliedRevision: unavailableField<number>(parentalResource, source.parental_controls.availability),
      syncState: unavailableField<"IN_SYNC" | "DEVICE_BEHIND" | "DEVICE_AHEAD" | "UNKNOWN">(parentalResource, source.parental_controls.availability),
      revisionDelta: unavailableField<number>(parentalResource, source.parental_controls.availability),
      driftDurationSeconds: unavailableField<number>(parentalResource, source.parental_controls.availability),
      stateReport: { observedAt: unavailableField<string>(parentalResource, source.parental_controls.availability) },
      installedAppsSnapshot: {
        observedAt: unavailableField<string>(parentalResource, source.parental_controls.availability),
        completeness: unavailableField<"COMPLETE" | "PARTIAL" | "UNKNOWN">(parentalResource, source.parental_controls.availability),
      },
    },
    push: {
      registrationHealth: projectField(source.push, (value) => value.active_count > 0 ? "HEALTHY" as const : value.registered_count > 0 ? "DEGRADED" as const : "UNKNOWN" as const),
      lastDeliveryAt: unavailableField<string>("v2_guardian_push_endpoints.last_delivery", "REQUIRES_PROJECTION"),
      lastFailureCode: unavailableField<string>("v2_alert_deliveries.last_failure", "REQUIRES_PROJECTION"),
    },
  };
}

function projectField<TSource, TValue>(
  field: Readonly<Partial<CtR0FieldEnvelope<TSource>>>,
  select: (value: TSource) => TValue | null,
): DataEnvelope<TValue> {
  const sourceValue = field.value ?? null;
  const value = sourceValue === null ? null : select(sourceValue);
  const availability = field.availability ?? "REQUIRES_PROJECTION";
  return {
    value,
    contractAvailability: availability,
    valueState: valueStateFor(field, value),
    source: dataSource(field.source ?? "control_tower.projection_unavailable"),
    observedAt: field.observed_at ?? null,
    receivedAt: field.received_at ?? null,
    effectiveAt: field.effective_at ?? null,
    freshnessStatus: mapFreshness(field.freshness_status ?? "unknown"),
    sensitivity: mapSensitivity(field.sensitivity ?? "internal"),
    redaction: mapRedaction(field.redaction ?? "not_available"),
    revisionOrEtag: field.revision_or_etag ?? null,
  };
}

function availableField<T>(value: T, resource: string, at: string, sensitivity: string): DataEnvelope<T> {
  return {
    value,
    contractAvailability: "EXISTING_V2",
    valueState: "AVAILABLE",
    source: dataSource(resource),
    observedAt: at,
    receivedAt: at,
    effectiveAt: at,
    freshnessStatus: "FRESH",
    sensitivity: mapSensitivity(sensitivity),
    redaction: { kind: "MASKED", strategy: "LABEL_ONLY" },
    revisionOrEtag: null,
  };
}

function unavailableField<T>(
  resource: string,
  availability: FieldContractAvailability,
  forcedState?: FieldValueState,
  sensitivity = "internal",
): DataEnvelope<T> {
  return {
    value: null,
    contractAvailability: availability,
    valueState: forcedState ?? availabilityState(availability),
    source: dataSource(resource),
    observedAt: null,
    receivedAt: null,
    effectiveAt: null,
    freshnessStatus: "UNKNOWN",
    sensitivity: mapSensitivity(sensitivity),
    redaction: availability === "PROHIBITED" ? { kind: "DENIED", reasonCode: "PROHIBITED" } : { kind: "NONE" },
    revisionOrEtag: null,
  };
}

function valueStateFor<T>(field: Readonly<Partial<CtR0FieldEnvelope<T>>>, value: unknown): FieldValueState {
  if (field.redaction === "permission_denied") return "PERMISSION_DENIED";
  if (field.redaction === "not_available") return "SOURCE_UNAVAILABLE";
  if (field.redaction === "not_collected") return "NOT_COLLECTED";
  if (field.availability === "PROHIBITED") return "PROHIBITED";
  if (value !== null) return "AVAILABLE";
  return availabilityState(field.availability ?? "REQUIRES_PROJECTION");
}

function availabilityState(availability: FieldContractAvailability): FieldValueState {
  if (availability === "PROHIBITED") return "PROHIBITED";
  if (availability === "NOT_COLLECTED" || availability === "NEW_COLLECTION_REQUIRED") return "NOT_COLLECTED";
  if (availability === "NEW_DOMAIN_REQUIRED") return "NOT_SUPPORTED";
  return "UNKNOWN";
}

function dataSource(resource: string): DataEnvelope<unknown>["source"] {
  return {
    system: resource.startsWith("v2_") ? "V2" : "CONTROL_TOWER",
    resource,
    formulaVersion: null,
  };
}

function mapRedaction(value: string): Redaction {
  if (value === "permission_denied") return { kind: "DENIED", reasonCode: "PERMISSION_DENIED" };
  if (value === "masked" || value === "parent_safe_only" || value === "payload_hidden") {
    return { kind: "MASKED", strategy: "LABEL_ONLY" };
  }
  return { kind: "NONE" };
}

function mapFreshness(value: string): FreshnessStatus {
  if (value === "fresh") return "FRESH";
  if (value === "late") return "AGING";
  if (value === "interrupted" || value === "expired") return "STALE";
  if (value === "not_applicable") return "NOT_APPLICABLE";
  return "UNKNOWN";
}

function mapSensitivity(value: string): Sensitivity {
  if (value === "public") return "PUBLIC";
  if (value === "restricted") return "RESTRICTED";
  if (value === "confidential") return "SENSITIVE";
  return "INTERNAL";
}

function mapPriority(value: string | null): Priority {
  return value ? value.toUpperCase() as Priority : "UNKNOWN";
}

function mapVerification(value: string): VerificationLevel {
  if (value === "v1_channel_possession") return "V1_CHANNEL_POSSESSION";
  if (value === "v2_guardian") return "V2_AUTHENTICATED_GUARDIAN";
  if (value === "v3_action_bound") return "V3_ACTION_BOUND_STEP_UP";
  return "V0_UNKNOWN";
}

function identityFor(level: VerificationLevel): ConversationListItem["identityMatch"] {
  if (level === "V2_AUTHENTICATED_GUARDIAN" || level === "V3_ACTION_BOUND_STEP_UP") return "VERIFIED";
  if (level === "V1_CHANNEL_POSSESSION") return "SINGLE_CANDIDATE";
  return "NONE";
}

function guardianRoleFor(level: VerificationLevel): GuardianRole {
  return level === "V2_AUTHENTICATED_GUARDIAN" || level === "V3_ACTION_BOUND_STEP_UP"
    ? "GUARDIAN"
    : "UNKNOWN";
}

function mapConversationState(value: string): ConversationState {
  const map: Record<string, ConversationState> = {
    open: "OPEN", ai_active: "AI_ACTIVE", takeover_requested: "TAKEOVER_REQUESTED",
    human_active: "HUMAN_ACTIVE", waiting_for_customer: "WAITING_CUSTOMER",
    waiting_for_human: "WAITING_FOR_HUMAN", resolved: "RESOLVED", closed: "CLOSED",
  };
  return map[value] ?? "OPEN";
}

function mapCaseState(value: string): CaseState {
  return value.toUpperCase() as CaseState;
}

function mapDomain(value: string): CaseDomain {
  const key = value.toLowerCase();
  if (key.includes("install")) return "INSTALLATION";
  if (key.includes("permission")) return "PERMISSIONS";
  if (key.includes("parental")) return "PARENTAL_CONTROLS";
  if (key.includes("monitor") || key.includes("device")) return "MONITORING";
  if (key.includes("bill") || key.includes("finance")) return "BILLING";
  if (key.includes("privacy")) return "PRIVACY";
  if (key.includes("security")) return "SECURITY";
  if (key.includes("safety")) return "CHILD_SAFETY";
  if (key.includes("legal") || key.includes("media") || key.includes("partner")) return "LEGAL_MEDIA_PARTNER";
  if (key.includes("sales")) return "PRE_SALES";
  if (key.includes("registration")) return "REGISTRATION";
  return "PRODUCT_FEEDBACK";
}

function slaFor(deadline: string | null): ConversationListItem["sla"] {
  if (!deadline) return { status: "UNKNOWN", firstResponseDueAt: null, resolutionDueAt: null, pausedReason: null };
  return {
    status: Date.parse(deadline) <= Date.now() ? "BREACHED" : "ON_TRACK",
    firstResponseDueAt: null,
    resolutionDueAt: deadline,
    pausedReason: null,
  };
}

function mapDelivery(value: string): DeliveryState {
  const map: Record<string, DeliveryState> = {
    queued: "PENDING", provider_accepted: "SENT", delivered: "DELIVERED",
    read: "READ", failed: "FAILED", not_applicable: "NOT_APPLICABLE",
  };
  return map[value] ?? "NOT_APPLICABLE";
}

function mapMessageType(value: string): MessageType {
  const normalized = value.toUpperCase();
  if (["TEXT", "IMAGE", "VIDEO", "AUDIO", "VOICE", "DOCUMENT", "LOCATION", "CONTACT", "REACTION", "STICKER", "UNSUPPORTED"].includes(normalized)) {
    return normalized as MessageType;
  }
  if (value === "button" || value === "interactive") return "BUTTON_REPLY";
  if (value === "contacts") return "CONTACT";
  return "UNSUPPORTED";
}

function mapTimelineType(value: string): OperationalTimelineEvent["type"] {
  if (value.includes("message")) return "MESSAGE";
  if (value.includes("assign")) return "ASSIGNMENT";
  if (value.includes("handoff")) return "HANDOFF";
  if (value.includes("verification")) return "VERIFICATION";
  if (value.includes("diagnostic")) return "DIAGNOSTIC";
  if (value.includes("note")) return "INTERNAL_NOTE";
  return "CASE_STATE";
}

function capabilityImpact(key: DeviceCapabilityKey): CapabilityDiagnostic["impact"] {
  if (key === "accessibility_enabled" || key === "notification_listener_enabled") return ["CAPTURE", "MONITORING"];
  if (key === "app_notifications_allowed" || key === "battery_optimization_exempt" || key === "oem_autostart_review") return ["MONITORING"];
  return ["PARENTAL_ENFORCEMENT"];
}
