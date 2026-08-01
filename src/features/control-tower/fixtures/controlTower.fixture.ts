import type {
  AllowedAction,
  CapabilityDiagnostic,
  CapabilityState,
  ConversationListItem,
  ConversationWorkspace,
  Customer360Snapshot,
  DataEnvelope,
  FieldContractAvailability,
  FieldValueState,
  FreshnessStatus,
  MonitoringState,
  Sensitivity,
  StaffSession,
  SupportMessage,
} from "../domain/types";

export const FIXTURE_NOW = "2026-07-31T09:00:00Z";

interface EnvelopeOptions {
  contractAvailability?: FieldContractAvailability;
  freshnessStatus?: FreshnessStatus;
  sensitivity?: Sensitivity;
  observedAt?: string | null;
  receivedAt?: string | null;
  effectiveAt?: string | null;
  revisionOrEtag?: string | null;
  resource?: string;
  masked?: boolean;
}

export function fixtureField<T>(value: T, options: EnvelopeOptions = {}): DataEnvelope<T> {
  return {
    value,
    contractAvailability: options.contractAvailability ?? "EXISTING_V2",
    valueState: "AVAILABLE",
    source: {
      system: "FIXTURE",
      resource: options.resource ?? "synthetic_fixture",
      formulaVersion: options.contractAvailability === "DERIVED_SERVER" ? "fixture-formula-v1" : null,
    },
    observedAt: options.observedAt ?? FIXTURE_NOW,
    receivedAt: options.receivedAt ?? FIXTURE_NOW,
    effectiveAt: options.effectiveAt ?? FIXTURE_NOW,
    freshnessStatus: options.freshnessStatus ?? "FRESH",
    sensitivity: options.sensitivity ?? "INTERNAL",
    redaction: options.masked ? { kind: "MASKED", strategy: "LABEL_ONLY" } : { kind: "NONE" },
    revisionOrEtag: options.revisionOrEtag ?? "fixture-etag-1",
  };
}

export function fixtureMissing<T>(
  valueState: Exclude<FieldValueState, "AVAILABLE">,
  contractAvailability: FieldContractAvailability,
  resource: string,
  sensitivity: Sensitivity = "INTERNAL",
): DataEnvelope<T> {
  return {
    value: null,
    contractAvailability,
    valueState,
    source: { system: "FIXTURE", resource, formulaVersion: null },
    observedAt: null,
    receivedAt: null,
    effectiveAt: null,
    freshnessStatus: valueState === "SOURCE_UNAVAILABLE" ? "STALE" : "UNKNOWN",
    sensitivity,
    redaction:
      valueState === "PERMISSION_DENIED" || valueState === "PROHIBITED"
        ? { kind: "DENIED", reasonCode: valueState }
        : { kind: "NONE" },
    revisionOrEtag: null,
  };
}

export const FIXTURE_MANAGER_SESSION: StaffSession = {
  staffId: "staff_fixture_manager_001",
  displayName: "מנהלת שירות — בדיקה",
  roles: ["SUPPORT_MANAGER"],
  permissions: [
    "control_tower.access",
    "inbox.read.all",
    "conversation.read",
    "conversation.reply.public",
    "conversation.reply.account",
    "conversation.takeover",
    "case.read",
    "case.assign",
    "case.note.write",
    "customer360.read.masked",
    "diagnostics.read.device",
    "action.report_heartbeat.request",
    "action.refresh_settings.request",
  ],
  environment: "STAGING",
  assurance: "AAL2",
  expiresAt: "2099-01-01T00:00:00Z",
};

export const FIXTURE_L1_SESSION: StaffSession = {
  staffId: "staff_fixture_l1_001",
  displayName: "נציגת שירות — בדיקה",
  roles: ["SUPPORT_AGENT"],
  permissions: [
    "control_tower.access",
    "inbox.read.assigned",
    "conversation.read",
    "conversation.reply.public",
    "conversation.takeover",
    "case.read",
    "case.note.write",
    "customer360.read.masked",
    "diagnostics.read.device",
  ],
  environment: "STAGING",
  assurance: "AAL2",
  expiresAt: "2099-01-01T00:00:00Z",
};

export const FIXTURE_QUEUES = [
  { queueId: "all", label: "כל הפניות" },
  { queueId: "device-ops", label: "מכשירים והתקנה" },
  { queueId: "identity-review", label: "בדיקת זהות" },
  { queueId: "sales", label: "מכירה" },
  { queueId: "trust-safety", label: "בטיחות" },
  { queueId: "finance", label: "כספים" },
] as const;

export const FIXTURE_CONVERSATIONS: ConversationListItem[] = [
  {
    conversationId: "conv_fixture_device_001",
    maskedContactLabel: "לקוחה • 0101",
    maskedChannelAddress: "+1 ••• ••• 0101",
    verificationLevel: "V2_AUTHENTICATED_GUARDIAN",
    guardianRole: "OWNER",
    domains: ["MONITORING", "PERMISSIONS"],
    priority: "S1",
    state: "HUMAN_ACTIVE",
    queueId: "device-ops",
    caseIds: ["case_fixture_device_001"],
    unreadCount: 2,
    lastMessagePreview: "האפליקציה הפסיקה לעדכן, אפשר לבדוק?",
    lastMessageAt: "2026-07-31T08:55:00Z",
    lastDeliveryState: "READ",
    identityMatch: "VERIFIED",
    sla: {
      status: "AT_RISK",
      firstResponseDueAt: "2026-07-31T09:05:00Z",
      resolutionDueAt: "2026-07-31T10:00:00Z",
      pausedReason: null,
    },
    sensitive: false,
  },
  {
    conversationId: "conv_fixture_prospect_001",
    maskedContactLabel: "מתעניינת חדשה",
    maskedChannelAddress: "+1 ••• ••• 0102",
    verificationLevel: "V0_UNKNOWN",
    guardianRole: "UNKNOWN",
    domains: ["PRE_SALES"],
    priority: "S3",
    state: "AI_ACTIVE",
    queueId: "sales",
    caseIds: [],
    unreadCount: 0,
    lastMessagePreview: "כמה עולה השירות?",
    lastMessageAt: "2026-07-31T08:51:00Z",
    lastDeliveryState: "DELIVERED",
    identityMatch: "NONE",
    sla: { status: "ON_TRACK", firstResponseDueAt: null, resolutionDueAt: null, pausedReason: null },
    sensitive: false,
  },
  {
    conversationId: "conv_fixture_identity_001",
    maskedContactLabel: "פונה • זהות לא חד־משמעית",
    maskedChannelAddress: "+1 ••• ••• 0103",
    verificationLevel: "V1_CHANNEL_POSSESSION",
    guardianRole: "UNKNOWN",
    domains: ["REGISTRATION"],
    priority: "S2",
    state: "TAKEOVER_REQUESTED",
    queueId: "identity-review",
    caseIds: ["case_fixture_identity_001"],
    unreadCount: 1,
    lastMessagePreview: "אני לא מצליחה להיכנס לחשבון.",
    lastMessageAt: "2026-07-31T08:49:00Z",
    lastDeliveryState: "DELIVERED",
    identityMatch: "AMBIGUOUS",
    sla: {
      status: "ON_TRACK",
      firstResponseDueAt: "2026-07-31T09:20:00Z",
      resolutionDueAt: "2026-07-31T13:00:00Z",
      pausedReason: null,
    },
    sensitive: false,
  },
  {
    conversationId: "conv_fixture_xiaomi_001",
    maskedContactLabel: "לקוח • 0104",
    maskedChannelAddress: "+1 ••• ••• 0104",
    verificationLevel: "V2_AUTHENTICATED_GUARDIAN",
    guardianRole: "GUARDIAN",
    domains: ["PERMISSIONS", "MONITORING"],
    priority: "S1",
    state: "WAITING_FOR_HUMAN",
    queueId: "device-ops",
    caseIds: ["case_fixture_xiaomi_001"],
    unreadCount: 0,
    lastMessagePreview: "עדיין אין עדכון מהמכשיר.",
    lastMessageAt: "2026-07-31T08:35:00Z",
    lastDeliveryState: "READ",
    identityMatch: "VERIFIED",
    sla: {
      status: "BREACHED",
      firstResponseDueAt: "2026-07-31T08:40:00Z",
      resolutionDueAt: "2026-07-31T08:55:00Z",
      pausedReason: null,
    },
    sensitive: false,
  },
  {
    conversationId: "conv_fixture_safety_001",
    maskedContactLabel: "פנייה רגישה",
    maskedChannelAddress: "+1 ••• ••• 0105",
    verificationLevel: "V1_CHANNEL_POSSESSION",
    guardianRole: "UNKNOWN",
    domains: ["CHILD_SAFETY"],
    priority: "S0",
    state: "HUMAN_ACTIVE",
    queueId: "trust-safety",
    caseIds: ["case_fixture_safety_001"],
    unreadCount: 1,
    lastMessagePreview: "תוכן הפנייה מוגבל לצוות מורשה.",
    lastMessageAt: "2026-07-31T08:58:00Z",
    lastDeliveryState: "DELIVERED",
    identityMatch: "SINGLE_CANDIDATE",
    sla: {
      status: "AT_RISK",
      firstResponseDueAt: "2026-07-31T09:00:00Z",
      resolutionDueAt: null,
      pausedReason: null,
    },
    sensitive: true,
  },
  {
    conversationId: "conv_fixture_delivery_001",
    maskedContactLabel: "לקוחה • 0106",
    maskedChannelAddress: "+1 ••• ••• 0106",
    verificationLevel: "V2_AUTHENTICATED_GUARDIAN",
    guardianRole: "OWNER",
    domains: ["BILLING"],
    priority: "S2",
    state: "HUMAN_ACTIVE",
    queueId: "finance",
    caseIds: ["case_fixture_delivery_001"],
    unreadCount: 0,
    lastMessagePreview: "שליחת ההודעה נכשלה.",
    lastMessageAt: "2026-07-31T08:44:00Z",
    lastDeliveryState: "FAILED",
    identityMatch: "VERIFIED",
    sla: {
      status: "ON_TRACK",
      firstResponseDueAt: null,
      resolutionDueAt: "2026-07-31T14:00:00Z",
      pausedReason: null,
    },
    sensitive: false,
  },
];

const fixtureActions: AllowedAction[] = [
  {
    actionId: "ADD_INTERNAL_NOTE",
    label: "הוספת הערה פנימית",
    risk: "R1_INTERNAL",
    availability: "FUTURE_DOMAIN",
    autonomy: "AUTOMATIC",
    uiState: "ENABLED",
    reasonCodes: [],
    requiresCase: true,
    requiresVerification: "V1_CHANNEL_POSSESSION",
    requiresConfirmation: false,
  },
  {
    actionId: "SEND_PUBLIC_REPLY",
    label: "שליחת מענה",
    risk: "R1_COMMUNICATION",
    availability: "DISCOVERY_REQUIRED_META",
    autonomy: "AUTOMATIC",
    uiState: "ENABLED",
    reasonCodes: [],
    requiresCase: false,
    requiresVerification: "V1_CHANNEL_POSSESSION",
    requiresConfirmation: false,
  },
  {
    actionId: "REPORT_HEARTBEAT",
    label: "בקשת דיווח חיבור",
    risk: "R2",
    availability: "REQUIRES_STAFF_ACTION_API",
    autonomy: "POLICY_CONTROLLED",
    uiState: "ENABLED",
    reasonCodes: [],
    requiresCase: true,
    requiresVerification: "V2_AUTHENTICATED_GUARDIAN",
    requiresConfirmation: true,
  },
  {
    actionId: "REFRESH_SETTINGS",
    label: "רענון הגדרות",
    risk: "R2",
    availability: "REQUIRES_STAFF_ACTION_API",
    autonomy: "POLICY_CONTROLLED",
    uiState: "DISABLED",
    reasonCodes: ["EXPECTED_REVISION_CONFIRMATION_REQUIRED"],
    requiresCase: true,
    requiresVerification: "V2_AUTHENTICATED_GUARDIAN",
    requiresConfirmation: true,
  },
  {
    actionId: "LOCATE_NOW",
    label: "איתור מיקום",
    risk: "R3",
    availability: "PROHIBITED_PENDING_POLICY",
    autonomy: "NONE",
    uiState: "HIDDEN",
    reasonCodes: ["PARENT_SELF_ACTION_ONLY"],
    requiresCase: true,
    requiresVerification: "V3_ACTION_BOUND_STEP_UP",
    requiresConfirmation: true,
  },
  {
    actionId: "RING_DEVICE",
    label: "צלצול במכשיר",
    risk: "R3",
    availability: "PROHIBITED_PENDING_POLICY",
    autonomy: "NONE",
    uiState: "HIDDEN",
    reasonCodes: ["PARENT_SELF_ACTION_ONLY"],
    requiresCase: true,
    requiresVerification: "V3_ACTION_BOUND_STEP_UP",
    requiresConfirmation: true,
  },
];

function capability(
  key: CapabilityDiagnostic["key"],
  displayName: string,
  state: CapabilityState,
  impact: CapabilityDiagnostic["impact"],
  reasonCodes: string[] = [],
): CapabilityDiagnostic {
  const repair = state === "GRANTED"
    ? fixtureField("לא נדרשת פעולה", { resource: "capability_policy" })
    : state === "DENIED"
      ? fixtureField("יש לבטל הגבלת סוללה עבור Kippy בהגדרות המכשיר ולאמת דיווח חדש.", {
          resource: "capability_policy",
          contractAvailability: "DERIVED_SERVER",
        })
      : state === "NOT_SUPPORTED"
        ? fixtureMissing<string>("NOT_SUPPORTED", "NOT_COLLECTED", "capability_policy")
        : fixtureMissing<string>("UNKNOWN", "REQUIRES_PROJECTION", "capability_policy");

  return {
    key,
    displayName,
    state: fixtureField(state, { resource: "v2_device_health_events" }),
    requiredByPolicy: fixtureField(state !== "NOT_SUPPORTED", { resource: "capability_policy" }),
    impact,
    reasonCodes,
    repairInstruction: repair,
  };
}

const defaultCustomer360: Customer360Snapshot = {
  snapshotAt: FIXTURE_NOW,
  contactId: "contact_fixture_001",
  verificationLevel: "V2_AUTHENTICATED_GUARDIAN",
  guardianRole: "OWNER",
  familyLabel: fixtureField("משפחת בדיקה א׳", { sensitivity: "PERSONAL", masked: true }),
  childLabel: fixtureField("ילד/ה א׳", { sensitivity: "SENSITIVE", masked: true }),
  entitlement: fixtureField("מסלול בדיקה", {
    contractAvailability: "NEW_DOMAIN_REQUIRED",
    sensitivity: "PERSONAL",
  }),
  installation: {
    status: fixtureField("CONSUMED", { resource: "v2_child_install_sessions" }),
    expiresAt: fixtureField("2026-07-31T08:00:00Z", { resource: "v2_child_install_sessions" }),
    otpRequestCount: fixtureField(1, { resource: "v2_child_install_sessions" }),
    pairedAt: fixtureField("2026-07-30T17:20:00Z", { resource: "v2_protected_devices" }),
    setupStep: fixtureMissing("NOT_COLLECTED", "NEW_COLLECTION_REQUIRED", "android_setup_contract"),
  },
  device: {
    deviceId: fixtureField("device_fixture_001", { sensitivity: "RESTRICTED", masked: true }),
    manufacturer: fixtureField("Samsung", { resource: "v2_protected_devices" }),
    model: fixtureField("SM-A155F", { resource: "v2_protected_devices" }),
    androidVersion: fixtureMissing("NOT_COLLECTED", "NEW_COLLECTION_REQUIRED", "android_health_contract"),
    appVersion: fixtureField("2.0.0-fixture", { resource: "v2_protected_devices" }),
    build: fixtureMissing("NOT_COLLECTED", "NEW_COLLECTION_REQUIRED", "android_health_contract"),
    captureContractVersion: fixtureField(1, { resource: "v2_protected_devices" }),
    status: fixtureField("active", { resource: "v2_protected_devices" }),
    lastSeenAt: fixtureField("2026-07-31T08:44:00Z", {
      resource: "v2_protected_devices",
      freshnessStatus: "STALE",
    }),
    batteryPercent: fixtureField(61, { resource: "v2_device_health_events", observedAt: "2026-07-31T08:42:00Z" }),
  },
  capabilities: [
    capability("accessibility_enabled", "שירות נגישות", "GRANTED", ["CAPTURE"]),
    capability("notification_listener_enabled", "גישה להתראות", "GRANTED", ["CAPTURE"]),
    capability("app_notifications_allowed", "התראות אפליקציה", "GRANTED", ["MONITORING"]),
    capability("battery_optimization_exempt", "חריגה מחיסכון בסוללה", "DENIED", ["MONITORING"], [
      "BATTERY_OPTIMIZATION_NOT_EXEMPT",
    ]),
    capability("oem_autostart_review", "בדיקת הפעלה אוטומטית של היצרן", "UNKNOWN", ["MONITORING"], [
      "OEM_AUTOSTART_NOT_REPORTED",
    ]),
    capability("usage_access", "גישה לנתוני שימוש", "NOT_SUPPORTED", ["PARENTAL_ENFORCEMENT"]),
    capability("precise_location", "מיקום מדויק", "NOT_SUPPORTED", ["PARENTAL_ENFORCEMENT"]),
    capability("background_location", "מיקום ברקע", "NOT_SUPPORTED", ["PARENTAL_ENFORCEMENT"]),
    capability("location_services", "שירותי מיקום", "UNKNOWN", ["PARENTAL_ENFORCEMENT"], [
      "LOCATION_SERVICES_NOT_REPORTED",
    ]),
    capability("package_inventory", "מלאי אפליקציות מותקנות", "UNKNOWN", ["PARENTAL_ENFORCEMENT"], [
      "PACKAGE_INVENTORY_NOT_REPORTED",
    ]),
  ],
  monitoring: {
    state: fixtureField<MonitoringState>("INTERRUPTED", {
      resource: "v2_device_monitoring_state",
      freshnessStatus: "STALE",
    }),
    lastHealthyAt: fixtureField("2026-07-31T08:42:00Z", { resource: "v2_device_monitoring_state" }),
    lateAfterAt: fixtureField("2026-07-31T08:47:00Z", { resource: "v2_device_monitoring_state" }),
    interruptedAfterAt: fixtureField("2026-07-31T08:52:00Z", { resource: "v2_device_monitoring_state" }),
    reasonCodes: ["BATTERY_OPTIMIZATION_NOT_EXEMPT"],
  },
  parentalSync: {
    desiredRevision: fixtureField(12, {
      resource: "v2_parental_settings",
      freshnessStatus: "NOT_APPLICABLE",
    }),
    appliedRevision: fixtureField(11, {
      resource: "v2_parental_device_state",
      freshnessStatus: "UNKNOWN",
    }),
    syncState: fixtureField("DEVICE_BEHIND", {
      resource: "parental_revision_comparison",
      contractAvailability: "DERIVED_SERVER",
      freshnessStatus: "UNKNOWN",
    }),
    revisionDelta: fixtureField(1, {
      resource: "parental_revision_comparison",
      contractAvailability: "DERIVED_SERVER",
      freshnessStatus: "UNKNOWN",
    }),
    driftDurationSeconds: fixtureMissing(
      "UNKNOWN",
      "REQUIRES_PROJECTION",
      "parental_sync_drift_projection",
    ),
    stateReport: {
      observedAt: fixtureField("2026-07-31T08:30:00Z", {
        resource: "v2_parental_device_state",
        observedAt: "2026-07-31T08:30:00Z",
        freshnessStatus: "UNKNOWN",
      }),
    },
    installedAppsSnapshot: {
      observedAt: fixtureMissing(
        "UNKNOWN",
        "REQUIRES_PROJECTION",
        "parental_inventory_snapshot_projection",
      ),
      completeness: fixtureMissing(
        "UNKNOWN",
        "REQUIRES_PROJECTION",
        "parental_inventory_snapshot_projection",
      ),
    },
  },
  push: {
    registrationHealth: fixtureField("UNKNOWN", {
      resource: "v2_push_projection",
      contractAvailability: "REQUIRES_PROJECTION",
      freshnessStatus: "UNKNOWN",
    }),
    lastDeliveryAt: fixtureMissing("UNKNOWN", "REQUIRES_PROJECTION", "v2_push_projection"),
    lastFailureCode: fixtureMissing("UNKNOWN", "REQUIRES_PROJECTION", "v2_push_projection"),
  },
};

function message(
  id: string,
  conversationId: string,
  senderKind: SupportMessage["senderKind"],
  body: string,
  at: string,
  deliveryState: SupportMessage["deliveryState"] = "READ",
): SupportMessage {
  return {
    messageId: id,
    conversationId,
    direction: senderKind === "CUSTOMER" ? "INBOUND" : "OUTBOUND",
    senderKind,
    type: "TEXT",
    body: fixtureField(body, { resource: "support_message", sensitivity: "PERSONAL" }),
    attachment: null,
    replyToMessageId: null,
    deliveryState,
    providerObservedAt: at,
    serverReceivedAt: at,
    templateId: null,
    templateVersion: null,
  };
}

function caseFor(conversation: ConversationListItem) {
  if (!conversation.caseIds[0]) return [];
  return [
    {
      caseId: conversation.caseIds[0],
      state: conversation.identityMatch === "AMBIGUOUS" ? ("IDENTITY_PENDING" as const) : ("WORKING" as const),
      domain: conversation.domains[0],
      priority: conversation.priority,
      accountableOwnerLabel: conversation.state === "AI_ACTIVE" ? "Front Office" : "צוות אנושי",
      rootCause: null,
      resolutionCode: null,
      reopenCount: 0,
    },
  ];
}

function baseWorkspace(conversation: ConversationListItem): ConversationWorkspace {
  return {
    version: "fixture-v1",
    conversation: { ...conversation },
    messages: [
      message(
        `msg_${conversation.conversationId}_1`,
        conversation.conversationId,
        "CUSTOMER",
        conversation.lastMessagePreview ?? "הודעת fixture לא זמינה",
        conversation.lastMessageAt,
        conversation.lastDeliveryState ?? "NOT_APPLICABLE",
      ),
    ],
    cases: caseFor(conversation),
    customer360: null,
    timeline: [
      {
        eventId: `event_${conversation.conversationId}_received`,
        type: "MESSAGE",
        occurredAt: conversation.lastMessageAt,
        actorLabel: "לקוח/ה",
        summary: "התקבלה הודעת שירות",
        sensitivity: conversation.sensitive ? "RESTRICTED" : "PERSONAL",
        immutableAuditReference: null,
      },
    ],
    allowedActions: fixtureActions.map((action) => ({ ...action })),
  };
}

const detailedWorkspace = baseWorkspace(FIXTURE_CONVERSATIONS[0]);
detailedWorkspace.customer360 = defaultCustomer360;
detailedWorkspace.messages = [
  message(
    "msg_fixture_device_001_in",
    detailedWorkspace.conversation.conversationId,
    "CUSTOMER",
    "האפליקציה הפסיקה לעדכן, אפשר לבדוק?",
    "2026-07-31T08:50:00Z",
  ),
  message(
    "msg_fixture_device_001_ai",
    detailedWorkspace.conversation.conversationId,
    "AI",
    "אני עוזר ה‑AI של Kippy. אבדוק את מצב החיבור ואעביר לנציגת שירות לפי הצורך.",
    "2026-07-31T08:51:00Z",
    "DELIVERED",
  ),
  message(
    "msg_fixture_device_001_staff",
    detailedWorkspace.conversation.conversationId,
    "STAFF",
    "אני איתך ובודקת את מצב המכשיר.",
    "2026-07-31T08:55:00Z",
    "READ",
  ),
];
detailedWorkspace.timeline = [
  {
    eventId: "event_fixture_verification",
    type: "VERIFICATION",
    occurredAt: "2026-07-31T08:49:00Z",
    actorLabel: "מערכת אימות",
    summary: "Guardian אומת ברמת V2 לשיחה זו",
    sensitivity: "INTERNAL",
    immutableAuditReference: "audit-fixture-verification",
  },
  {
    eventId: "event_fixture_diagnostic",
    type: "DIAGNOSTIC",
    occurredAt: "2026-07-31T08:52:00Z",
    actorLabel: "Device & Fleet",
    summary: "זוהתה הפסקת heartbeat והגבלת סוללה",
    sensitivity: "INTERNAL",
    immutableAuditReference: "audit-fixture-diagnostic",
  },
  {
    eventId: "event_fixture_takeover",
    type: "HANDOFF",
    occurredAt: "2026-07-31T08:54:00Z",
    actorLabel: "Case Workflow",
    summary: "השיחה הועברה לנציגת שירות",
    sensitivity: "INTERNAL",
    immutableAuditReference: "audit-fixture-takeover",
  },
  {
    eventId: "event_fixture_lease",
    type: "ASSIGNMENT",
    occurredAt: "2026-07-31T08:55:00Z",
    actorLabel: "מנהלת שירות — בדיקה",
    summary: "conversation lease נרכש",
    sensitivity: "INTERNAL",
    immutableAuditReference: "audit-fixture-lease",
  },
];

const xiaomiWorkspace = baseWorkspace(FIXTURE_CONVERSATIONS[3]);
xiaomiWorkspace.customer360 = {
  ...defaultCustomer360,
  contactId: "contact_fixture_004",
  familyLabel: fixtureField("משפחת בדיקה ד׳", { sensitivity: "PERSONAL", masked: true }),
  childLabel: fixtureField("ילד/ה ד׳", { sensitivity: "SENSITIVE", masked: true }),
  device: {
    ...defaultCustomer360.device,
    manufacturer: fixtureField("Xiaomi", { resource: "v2_protected_devices" }),
    model: fixtureField("Redmi fixture", { resource: "v2_protected_devices" }),
    lastSeenAt: fixtureMissing("SOURCE_UNAVAILABLE", "REQUIRES_PROJECTION", "v2_device_projection"),
    batteryPercent: fixtureMissing("SOURCE_UNAVAILABLE", "EXISTING_V2", "v2_device_health_events"),
  },
  monitoring: {
    state: fixtureMissing("SOURCE_UNAVAILABLE", "EXISTING_V2", "v2_device_monitoring_state"),
    lastHealthyAt: fixtureMissing("SOURCE_UNAVAILABLE", "EXISTING_V2", "v2_device_monitoring_state"),
    lateAfterAt: fixtureMissing("SOURCE_UNAVAILABLE", "EXISTING_V2", "v2_device_monitoring_state"),
    interruptedAfterAt: fixtureMissing("SOURCE_UNAVAILABLE", "EXISTING_V2", "v2_device_monitoring_state"),
    reasonCodes: ["SOURCE_UNAVAILABLE"],
  },
};

const identityWorkspace = baseWorkspace(FIXTURE_CONVERSATIONS[2]);
identityWorkspace.allowedActions = fixtureActions.map((action) =>
  action.actionId === "REPORT_HEARTBEAT"
    ? { ...action, uiState: "DISABLED", reasonCodes: ["V2_VERIFICATION_REQUIRED"] }
    : action,
);

const safetyWorkspace = baseWorkspace(FIXTURE_CONVERSATIONS[4]);
safetyWorkspace.messages = [
  {
    ...message(
      "msg_fixture_safety_redacted",
      safetyWorkspace.conversation.conversationId,
      "SYSTEM",
      "",
      "2026-07-31T08:58:00Z",
      "DELIVERED",
    ),
    body: fixtureMissing("PERMISSION_DENIED", "PROHIBITED", "safety_case_content", "RESTRICTED"),
  },
];
safetyWorkspace.allowedActions = fixtureActions.map((action) => ({
  ...action,
  uiState: "HIDDEN",
  reasonCodes: ["TRUST_AND_SAFETY_ROLE_REQUIRED"],
}));

export const FIXTURE_WORKSPACES: Record<string, ConversationWorkspace> = {
  conv_fixture_device_001: detailedWorkspace,
  conv_fixture_prospect_001: baseWorkspace(FIXTURE_CONVERSATIONS[1]),
  conv_fixture_identity_001: identityWorkspace,
  conv_fixture_xiaomi_001: xiaomiWorkspace,
  conv_fixture_safety_001: safetyWorkspace,
  conv_fixture_delivery_001: baseWorkspace(FIXTURE_CONVERSATIONS[5]),
};
