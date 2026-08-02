export type IsoDateTime = string;
export type ConversationId = string;
export type CaseId = string;
export type ContactId = string;
export type FamilyId = string;
export type ChildId = string;
export type DeviceId = string;
export type QueueId = string;
export type StaffId = string;

export type RuntimeEnvironment = "STAGING" | "PRODUCTION";

export type FieldContractAvailability =
  | "EXISTING_V2"
  | "DERIVED_SERVER"
  | "REQUIRES_PROJECTION"
  | "NEW_COLLECTION_REQUIRED"
  | "NEW_DOMAIN_REQUIRED"
  | "NOT_COLLECTED"
  | "PROHIBITED";

export type FieldValueState =
  | "AVAILABLE"
  | "UNKNOWN"
  | "NOT_COLLECTED"
  | "NOT_SUPPORTED"
  | "SOURCE_UNAVAILABLE"
  | "PERMISSION_DENIED"
  | "PROHIBITED";

export type FreshnessStatus = "FRESH" | "AGING" | "STALE" | "UNKNOWN" | "NOT_APPLICABLE";
export type Sensitivity = "PUBLIC" | "INTERNAL" | "PERSONAL" | "SENSITIVE" | "RESTRICTED";

export type Redaction =
  | { kind: "NONE" }
  | { kind: "MASKED"; strategy: "LAST4" | "INITIALS" | "LABEL_ONLY" }
  | { kind: "DENIED"; reasonCode: string };

export interface DataSource {
  system: "V2" | "CONTROL_TOWER" | "FIXTURE";
  resource: string;
  formulaVersion: string | null;
}

export interface DataEnvelope<T> {
  value: T | null;
  contractAvailability: FieldContractAvailability;
  valueState: FieldValueState;
  source: DataSource;
  observedAt: IsoDateTime | null;
  receivedAt: IsoDateTime | null;
  effectiveAt: IsoDateTime | null;
  freshnessStatus: FreshnessStatus;
  sensitivity: Sensitivity;
  redaction: Redaction;
  revisionOrEtag: string | null;
}

export type StaffRole =
  | "CEO"
  | "PLATFORM_SUPER_ADMIN"
  | "SUPPORT_MANAGER"
  | "SUPPORT_AGENT"
  | "DEVICE_SUPPORT"
  | "FINANCE"
  | "TRUST_AND_SAFETY"
  | "PRIVACY_DPO"
  | "SECURITY_SRE"
  | "GROWTH_PRODUCT_DATA"
  | "AUDITOR";

export type StaffPermission =
  | "control_tower.access"
  | "inbox.read.assigned"
  | "inbox.read.all"
  | "conversation.read"
  | "conversation.reply.public"
  | "conversation.reply.account"
  | "conversation.takeover"
  | "case.read"
  | "case.assign"
  | "case.note.write"
  | "customer360.read.masked"
  | "customer360.read.sensitive"
  | "diagnostics.read.device"
  | "action.report_heartbeat.request"
  | "action.refresh_settings.request";

export interface StaffSession {
  staffId: StaffId;
  displayName: string;
  roles: readonly StaffRole[];
  permissions: readonly StaffPermission[];
  environment: RuntimeEnvironment;
  assurance: "AAL1" | "AAL2";
  expiresAt: IsoDateTime | null;
}

export type StaffAccess =
  | { kind: "GRANTED"; session: StaffSession; fixture: boolean }
  | { kind: "UNAUTHENTICATED" }
  | { kind: "MFA_REQUIRED" }
  | { kind: "FORBIDDEN"; reasonCode: string }
  | {
      kind: "UNAVAILABLE";
      reasonCode: "STAFF_BACKEND_NOT_CONFIGURED" | "SOURCE_UNAVAILABLE";
    };

export type VerificationLevel =
  | "V0_UNKNOWN"
  | "V1_CHANNEL_POSSESSION"
  | "V2_AUTHENTICATED_GUARDIAN"
  | "V3_ACTION_BOUND_STEP_UP";

export type GuardianRole = "OWNER" | "GUARDIAN" | "UNKNOWN";

export type CaseDomain =
  | "PRE_SALES"
  | "REGISTRATION"
  | "INSTALLATION"
  | "PERMISSIONS"
  | "PARENTAL_CONTROLS"
  | "MONITORING"
  | "BILLING"
  | "PRIVACY"
  | "SECURITY"
  | "CHILD_SAFETY"
  | "COMPLAINT"
  | "PRODUCT_FEEDBACK"
  | "LEGAL_MEDIA_PARTNER"
  | "SPAM_ABUSE";

export type Priority = "S0" | "S1" | "S2" | "S3" | "UNKNOWN";

export type ConversationState =
  | "OPEN"
  | "AI_ACTIVE"
  | "TAKEOVER_REQUESTED"
  | "WAITING_FOR_HUMAN"
  | "LEASE_OFFERED"
  | "HUMAN_ASSIGNED"
  | "HUMAN_ACTIVE"
  | "WAITING_CUSTOMER"
  | "WAITING_INTERNAL"
  | "RESOLVED"
  | "CLOSED"
  | "REOPENED";

export type CaseState =
  | "OPEN"
  | "TRIAGED"
  | "IDENTITY_PENDING"
  | "WORKING"
  | "WAITING_FOR_CUSTOMER"
  | "WAITING_FOR_DATA"
  | "WAITING_FOR_HUMAN"
  | "WAITING_FOR_EXTERNAL"
  | "RESOLUTION_PROPOSED"
  | "VERIFYING_RESOLUTION"
  | "RESOLVED"
  | "CLOSED"
  | "REOPENED";

export type SlaStatus = "ON_TRACK" | "AT_RISK" | "BREACHED" | "PAUSED" | "UNKNOWN";

export interface SlaClock {
  status: SlaStatus;
  firstResponseDueAt: IsoDateTime | null;
  resolutionDueAt: IsoDateTime | null;
  pausedReason: "WAITING_FOR_CUSTOMER" | null;
}

export type MessageType =
  | "TEXT"
  | "IMAGE"
  | "VIDEO"
  | "AUDIO"
  | "VOICE"
  | "DOCUMENT"
  | "LOCATION"
  | "CONTACT"
  | "BUTTON_REPLY"
  | "LIST_REPLY"
  | "REACTION"
  | "STICKER"
  | "UNSUPPORTED";

export type MessageDirection = "INBOUND" | "OUTBOUND" | "INTERNAL";
export type DeliveryState = "PENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED" | "NOT_APPLICABLE";
export type AttachmentScanState = "NOT_APPLICABLE" | "SCANNING" | "CLEAN" | "BLOCKED" | "FAILED";

export interface SupportAttachment {
  attachmentId: string;
  type: Exclude<MessageType, "TEXT" | "REACTION">;
  displayName: string;
  mimeType: string;
  sizeBytes: number;
  scanState: AttachmentScanState;
  downloadAllowed: boolean;
}

export interface SupportMessage {
  messageId: string;
  conversationId: ConversationId;
  direction: MessageDirection;
  senderKind: "CUSTOMER" | "AI" | "STAFF" | "SYSTEM";
  type: MessageType;
  body: DataEnvelope<string>;
  attachment: SupportAttachment | null;
  replyToMessageId: string | null;
  deliveryState: DeliveryState;
  providerObservedAt: IsoDateTime;
  serverReceivedAt: IsoDateTime;
  templateId: string | null;
  templateVersion: string | null;
}

export interface ConversationListItem {
  conversationId: ConversationId;
  maskedContactLabel: string;
  maskedChannelAddress: string;
  verificationLevel: VerificationLevel;
  guardianRole: GuardianRole;
  domains: readonly CaseDomain[];
  priority: Priority;
  state: ConversationState;
  queueId: QueueId;
  caseIds: readonly CaseId[];
  unreadCount: number | null;
  lastMessagePreview: string | null;
  lastMessageAt: IsoDateTime;
  lastDeliveryState: DeliveryState | null;
  identityMatch: "NONE" | "SINGLE_CANDIDATE" | "AMBIGUOUS" | "VERIFIED";
  sla: SlaClock;
  sensitive: boolean;
  projectionGaps?: readonly string[];
}

export interface SupportCaseSummary {
  caseId: CaseId;
  state: CaseState;
  domain: CaseDomain;
  priority: Priority;
  accountableOwnerLabel: string;
  rootCause: string | null;
  resolutionCode: string | null;
  reopenCount: number;
}

export type InstallationStatus = "CREATED" | "ACTIVATED" | "CONSUMED" | "EXPIRED" | "CANCELLED";
export type CapabilityState = "GRANTED" | "DENIED" | "NOT_REQUESTED" | "REVOKED" | "NOT_SUPPORTED" | "UNKNOWN";
export type DeviceCapabilityKey =
  | "accessibility_enabled"
  | "notification_listener_enabled"
  | "app_notifications_allowed"
  | "battery_optimization_exempt"
  | "oem_autostart_review"
  | "usage_access"
  | "precise_location"
  | "background_location"
  | "location_services"
  | "package_inventory";
export type MonitoringState =
  | "AWAITING_FIRST_HEARTBEAT"
  | "PROTECTED"
  | "DEGRADED"
  | "ACTION_REQUIRED"
  | "HEARTBEAT_LATE"
  | "INTERRUPTED"
  | "RECOVERING"
  | "REVOKED";

export type ParentalSyncState = "IN_SYNC" | "DEVICE_BEHIND" | "DEVICE_AHEAD" | "UNKNOWN";
export type InstalledAppsSnapshotCompleteness = "COMPLETE" | "PARTIAL" | "UNKNOWN";

export interface CapabilityDiagnostic {
  key: DeviceCapabilityKey;
  displayName: string;
  state: DataEnvelope<CapabilityState>;
  requiredByPolicy: DataEnvelope<boolean>;
  impact: readonly ("CAPTURE" | "MONITORING" | "PARENTAL_ENFORCEMENT")[];
  reasonCodes: readonly string[];
  repairInstruction: DataEnvelope<string>;
}

export interface Customer360Snapshot {
  snapshotAt: IsoDateTime;
  contactId: ContactId | null;
  verificationLevel: VerificationLevel;
  guardianRole: GuardianRole;
  familyLabel: DataEnvelope<string>;
  childLabel: DataEnvelope<string>;
  entitlement: DataEnvelope<string>;
  installation: {
    status: DataEnvelope<InstallationStatus>;
    expiresAt: DataEnvelope<IsoDateTime>;
    otpRequestCount: DataEnvelope<number>;
    pairedAt: DataEnvelope<IsoDateTime>;
    setupStep: DataEnvelope<string>;
  };
  device: {
    deviceId: DataEnvelope<DeviceId>;
    manufacturer: DataEnvelope<string>;
    model: DataEnvelope<string>;
    androidVersion: DataEnvelope<string>;
    appVersion: DataEnvelope<string>;
    build: DataEnvelope<string>;
    captureContractVersion: DataEnvelope<number>;
    status: DataEnvelope<string>;
    lastSeenAt: DataEnvelope<IsoDateTime>;
    batteryPercent: DataEnvelope<number>;
  };
  capabilities: readonly CapabilityDiagnostic[];
  monitoring: {
    state: DataEnvelope<MonitoringState>;
    lastHealthyAt: DataEnvelope<IsoDateTime>;
    lateAfterAt: DataEnvelope<IsoDateTime>;
    interruptedAfterAt: DataEnvelope<IsoDateTime>;
    reasonCodes: readonly string[];
  };
  parentalSync: {
    desiredRevision: DataEnvelope<number>;
    appliedRevision: DataEnvelope<number>;
    syncState: DataEnvelope<ParentalSyncState>;
    revisionDelta: DataEnvelope<number>;
    driftDurationSeconds: DataEnvelope<number>;
    stateReport: {
      observedAt: DataEnvelope<IsoDateTime>;
    };
    installedAppsSnapshot: {
      observedAt: DataEnvelope<IsoDateTime>;
      completeness: DataEnvelope<InstalledAppsSnapshotCompleteness>;
    };
  };
  push: {
    registrationHealth: DataEnvelope<"HEALTHY" | "DEGRADED" | "UNKNOWN">;
    lastDeliveryAt: DataEnvelope<IsoDateTime>;
    lastFailureCode: DataEnvelope<string>;
  };
}

export type ActionRisk = "R0_MASKED" | "R0_SENSITIVE" | "R1_INTERNAL" | "R1_COMMUNICATION" | "R2" | "R3";
export type ActionAvailability =
  | "EXISTING_READ_CONTRACT"
  | "REQUIRES_STAFF_READ_MODEL"
  | "REQUIRES_STAFF_ACTION_API"
  | "DISCOVERY_REQUIRED_META"
  | "FUTURE_DOMAIN"
  | "PROHIBITED_PENDING_POLICY";

export type SafeActionId =
  | "ADD_INTERNAL_NOTE"
  | "SEND_PUBLIC_REPLY"
  | "REQUEST_SUPPORT_VERIFICATION"
  | "REQUEST_GUARDIAN_REINSTALL"
  | "REQUEST_CHILD_INSTALL_OTP_RESEND"
  | "REPORT_HEARTBEAT"
  | "REFRESH_SETTINGS"
  | "LOCATE_NOW"
  | "RING_DEVICE";

export interface AllowedAction {
  actionId: SafeActionId;
  label: string;
  risk: ActionRisk;
  availability: ActionAvailability;
  autonomy: "AUTOMATIC" | "POLICY_CONTROLLED" | "HUMAN_REQUIRED" | "NONE";
  uiState: "ENABLED" | "DISABLED" | "HIDDEN";
  reasonCodes: readonly string[];
  requiresCase: boolean;
  requiresVerification: VerificationLevel;
  requiresConfirmation: boolean;
}

export type TimelineEventType =
  | "MESSAGE"
  | "DELIVERY"
  | "VERIFICATION"
  | "CLASSIFICATION"
  | "ROUTING"
  | "ASSIGNMENT"
  | "HANDOFF"
  | "DIAGNOSTIC"
  | "ACTION"
  | "INTERNAL_NOTE"
  | "SLA"
  | "CASE_STATE";

export interface OperationalTimelineEvent {
  eventId: string;
  type: TimelineEventType;
  occurredAt: IsoDateTime;
  actorLabel: string;
  summary: string;
  sensitivity: Sensitivity;
  immutableAuditReference: string | null;
}

export interface ConversationWorkspace {
  version: string;
  conversation: ConversationListItem;
  messages: readonly SupportMessage[];
  cases: readonly SupportCaseSummary[];
  customer360: Customer360Snapshot | null;
  timeline: readonly OperationalTimelineEvent[];
  allowedActions: readonly AllowedAction[];
  projectionGaps?: readonly string[];
}
