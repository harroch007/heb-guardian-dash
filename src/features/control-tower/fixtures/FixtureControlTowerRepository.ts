import type {
  AllowedAction,
  ConversationListItem,
  ConversationWorkspace,
  SafeActionId,
  StaffAccess,
  StaffPermission,
  SupportMessage,
} from "../domain/types";
import type {
  CommandBase,
  CommandReceipt,
  ControlTowerRepository,
  InboxQuery,
  InboxResult,
  RepositoryErrorCode,
  RepositoryResult,
} from "../data/ControlTowerRepository";
import {
  FIXTURE_CONVERSATIONS,
  FIXTURE_L1_SESSION,
  FIXTURE_MANAGER_SESSION,
  FIXTURE_NOW,
  FIXTURE_QUEUES,
  FIXTURE_WORKSPACES,
  fixtureField,
  fixtureMissing,
} from "./controlTower.fixture";

export type FixtureScenario =
  | "GRANTED_MANAGER"
  | "GRANTED_L1"
  | "GRANTED_AAL1"
  | "UNAUTHENTICATED"
  | "MFA_REQUIRED"
  | "FORBIDDEN"
  | "UNAVAILABLE";

declare global {
  interface Window {
    __KIPPY_CT_FIXTURE_SCENARIO__?: FixtureScenario;
  }
}

interface StoredReceipt {
  signature: string;
  result: RepositoryResult<CommandReceipt>;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nextVersion(current: string): string {
  const parsed = Number.parseInt(current.replace("fixture-v", ""), 10);
  return `fixture-v${Number.isFinite(parsed) ? parsed + 1 : 2}`;
}

export class FixtureControlTowerRepository implements ControlTowerRepository {
  readonly mode = "FIXTURE" as const;
  private readonly scenario: FixtureScenario;
  private readonly conversations: ConversationListItem[] = clone(FIXTURE_CONVERSATIONS);
  private readonly workspaces: Record<string, ConversationWorkspace> = clone(FIXTURE_WORKSPACES);
  private readonly receipts = new Map<string, StoredReceipt>();
  private eventSequence = 1;

  constructor(scenario?: FixtureScenario) {
    this.scenario =
      scenario ??
      (typeof window !== "undefined" ? window.__KIPPY_CT_FIXTURE_SCENARIO__ : undefined) ??
      "GRANTED_MANAGER";
  }

  async getStaffAccess(): Promise<StaffAccess> {
    switch (this.scenario) {
      case "GRANTED_MANAGER":
        return { kind: "GRANTED", session: clone(FIXTURE_MANAGER_SESSION), fixture: true };
      case "GRANTED_L1":
        return { kind: "GRANTED", session: clone(FIXTURE_L1_SESSION), fixture: true };
      case "GRANTED_AAL1":
        return {
          kind: "GRANTED",
          session: { ...clone(FIXTURE_MANAGER_SESSION), assurance: "AAL1" },
          fixture: true,
        };
      case "UNAUTHENTICATED":
        return { kind: "UNAUTHENTICATED" };
      case "MFA_REQUIRED":
        return { kind: "MFA_REQUIRED" };
      case "FORBIDDEN":
        return { kind: "FORBIDDEN", reasonCode: "CONTROL_TOWER_PERMISSION_MISSING" };
      case "UNAVAILABLE":
        return { kind: "UNAVAILABLE", reasonCode: "SOURCE_UNAVAILABLE" };
    }
  }

  async listInbox(query: InboxQuery): Promise<RepositoryResult<InboxResult>> {
    const denied = this.requireAccess<InboxResult>("conversation.read", "fixture-list-inbox");
    if (denied) return denied;

    const limit = Math.max(1, Math.min(50, query.limit));
    const visible = this.visibleConversations().filter((conversation) => {
      if (query.queueId && query.queueId !== "all" && conversation.queueId !== query.queueId) return false;
      if (query.priorities.length > 0 && !query.priorities.includes(conversation.priority)) return false;
      if (query.states.length > 0 && !query.states.includes(conversation.state)) return false;
      return true;
    });

    const offset = query.cursor ? Number.parseInt(query.cursor, 10) || 0 : 0;
    const page = visible.slice(offset, offset + limit);
    const allVisible = this.visibleConversations();
    const queues = FIXTURE_QUEUES.map((queue) => ({
      ...queue,
      count:
        queue.queueId === "all"
          ? allVisible.length
          : allVisible.filter((conversation) => conversation.queueId === queue.queueId).length,
    })).filter((queue) => queue.queueId === "all" || queue.count > 0);

    return {
      ok: true,
      data: {
        queues,
        conversations: clone(page),
        nextCursor: offset + limit < visible.length ? String(offset + limit) : null,
      },
      requestId: "fixture-list-inbox",
    };
  }

  async getWorkspace(conversationId: string): Promise<RepositoryResult<ConversationWorkspace>> {
    const denied = this.requireAccess<ConversationWorkspace>("conversation.read", "fixture-get-workspace");
    if (denied) return denied;
    if (!this.visibleConversations().some((item) => item.conversationId === conversationId)) {
      return this.error("NOT_FOUND", "לא ניתן לפתוח את הפנייה.", "fixture-get-workspace", false);
    }

    const workspace = this.workspaces[conversationId];
    if (!workspace) {
      return this.error("NOT_FOUND", "לא ניתן לפתוח את הפנייה.", "fixture-get-workspace", false);
    }

    return {
      ok: true,
      data: this.scenario === "GRANTED_L1" ? this.maskForL1(workspace) : clone(workspace),
      requestId: "fixture-get-workspace",
    };
  }

  requestTakeover(command: CommandBase): Promise<RepositoryResult<CommandReceipt>> {
    return this.mutate(command, "request-takeover", "conversation.takeover", (workspace, eventId) => {
      workspace.conversation.state = "WAITING_FOR_HUMAN";
      workspace.timeline = [
        ...workspace.timeline,
        this.timelineEvent(eventId, "HANDOFF", "התבקשה העברה לנציג/ה אנושי/ת"),
      ];
    });
  }

  acceptConversationLease(command: CommandBase): Promise<RepositoryResult<CommandReceipt>> {
    return this.mutate(command, "accept-lease", "conversation.takeover", (workspace, eventId) => {
      workspace.conversation.state = "HUMAN_ACTIVE";
      workspace.timeline = [
        ...workspace.timeline,
        this.timelineEvent(eventId, "ASSIGNMENT", "conversation lease נרכש פעם אחת"),
      ];
    });
  }

  releaseConversationLease(command: CommandBase): Promise<RepositoryResult<CommandReceipt>> {
    return this.mutate(command, "release-lease", "conversation.takeover", (workspace, eventId) => {
      workspace.conversation.state = "WAITING_FOR_HUMAN";
      workspace.timeline = [
        ...workspace.timeline,
        this.timelineEvent(eventId, "ASSIGNMENT", "conversation lease שוחרר"),
      ];
    });
  }

  addInternalNote(command: CommandBase & { body: string }): Promise<RepositoryResult<CommandReceipt>> {
    return this.mutate(command, `note:${command.body}`, "case.note.write", (workspace, eventId) => {
      workspace.timeline = [
        ...workspace.timeline,
        this.timelineEvent(eventId, "INTERNAL_NOTE", command.body),
      ];
    });
  }

  sendReply(
    command: CommandBase & { body: string; replyKind: "PUBLIC" | "ACCOUNT_SPECIFIC" },
  ): Promise<RepositoryResult<CommandReceipt>> {
    const permission: StaffPermission =
      command.replyKind === "ACCOUNT_SPECIFIC"
        ? "conversation.reply.account"
        : "conversation.reply.public";

    return this.mutate(
      command,
      `reply:${command.replyKind}:${command.body}`,
      permission,
      (workspace, eventId) => {
        const supportMessage: SupportMessage = {
          messageId: `msg_${eventId}`,
          conversationId: command.conversationId,
          direction: "OUTBOUND",
          senderKind: "STAFF",
          type: "TEXT",
          body: fixtureField(command.body, { resource: "support_message", sensitivity: "PERSONAL" }),
          attachment: null,
          replyToMessageId: null,
          deliveryState: "DELIVERED",
          providerObservedAt: FIXTURE_NOW,
          serverReceivedAt: FIXTURE_NOW,
          templateId: null,
          templateVersion: null,
        };
        workspace.messages = [...workspace.messages, supportMessage];
        workspace.conversation.lastMessagePreview = command.body;
        workspace.conversation.lastMessageAt = FIXTURE_NOW;
        workspace.conversation.lastDeliveryState = "DELIVERED";
        workspace.timeline = [
          ...workspace.timeline,
          this.timelineEvent(eventId, "MESSAGE", "נשלחה הודעת שירות סינתטית"),
        ];
      },
    );
  }

  executeSafeAction(
    command: CommandBase & { actionId: SafeActionId },
  ): Promise<RepositoryResult<CommandReceipt>> {
    const workspace = this.workspaces[command.conversationId];
    const action = workspace?.allowedActions.find((candidate) => candidate.actionId === command.actionId);
    if (!action || action.uiState !== "ENABLED" || action.availability === "PROHIBITED_PENDING_POLICY") {
      return Promise.resolve(
        this.error("NOT_SUPPORTED", "הפעולה אינה זמינה לפי המדיניות הנוכחית.", command.requestId, false),
      );
    }

    const permission = this.permissionForAction(action);
    return this.mutate(command, `action:${command.actionId}`, permission, (current, eventId) => {
      if (command.actionId === "REPORT_HEARTBEAT" && current.customer360) {
        current.customer360.monitoring.state = fixtureField("RECOVERING", {
          resource: "v2_device_monitoring_state",
          contractAvailability: "DERIVED_SERVER",
        });
        current.customer360.monitoring.reasonCodes = ["FIXTURE_HEARTBEAT_REQUESTED"];
      }
      current.timeline = [
        ...current.timeline,
        this.timelineEvent(eventId, "ACTION", `${command.actionId} התקבל ואומת ב־fixture`),
      ];
    });
  }

  private permissionForAction(action: AllowedAction): StaffPermission {
    if (action.actionId === "REPORT_HEARTBEAT") return "action.report_heartbeat.request";
    if (action.actionId === "REFRESH_SETTINGS") return "action.refresh_settings.request";
    return "conversation.read";
  }

  private visibleConversations(): ConversationListItem[] {
    if (this.scenario !== "GRANTED_L1") return this.conversations;
    return this.conversations.filter((conversation) =>
      ["device-ops", "identity-review"].includes(conversation.queueId),
    );
  }

  private maskForL1(workspace: ConversationWorkspace): ConversationWorkspace {
    const masked = clone(workspace);
    if (masked.customer360) {
      masked.customer360.entitlement = fixtureMissing(
        "PERMISSION_DENIED",
        "NEW_DOMAIN_REQUIRED",
        "billing_domain",
        "SENSITIVE",
      );
    }
    masked.allowedActions = masked.allowedActions.map((action) => {
      if (action.risk === "R2" || action.risk === "R3" || action.risk === "R0_SENSITIVE") {
        return { ...action, uiState: "HIDDEN", reasonCodes: ["STAFF_PERMISSION_MISSING"] };
      }
      return action;
    });
    return masked;
  }

  private requireAccess<T>(
    permission: StaffPermission,
    requestId: string,
  ): RepositoryResult<T> | null {
    const session =
      this.scenario === "GRANTED_MANAGER"
        ? FIXTURE_MANAGER_SESSION
        : this.scenario === "GRANTED_L1"
          ? FIXTURE_L1_SESSION
          : null;
    if (!session) return this.error("FORBIDDEN", "הגישה אינה זמינה.", requestId, false);
    if (!session.permissions.includes(permission)) {
      return this.error("FORBIDDEN", "אין הרשאה לפעולה זו.", requestId, false);
    }
    return null;
  }

  private mutate(
    command: CommandBase,
    signature: string,
    permission: StaffPermission,
    updater: (workspace: ConversationWorkspace, eventId: string) => void,
  ): Promise<RepositoryResult<CommandReceipt>> {
    const denied = this.requireAccess<CommandReceipt>(permission, command.requestId);
    if (denied) return Promise.resolve(denied);

    const stored = this.receipts.get(command.idempotencyKey);
    if (stored) {
      if (stored.signature !== signature) {
        return Promise.resolve(
          this.error("CONFLICT", "מפתח הפעולה כבר שימש לבקשה אחרת.", command.requestId, false),
        );
      }
      return Promise.resolve(clone(stored.result));
    }

    const workspace = this.workspaces[command.conversationId];
    if (!workspace) {
      return Promise.resolve(this.error("NOT_FOUND", "לא ניתן לפתוח את הפנייה.", command.requestId, false));
    }
    if (workspace.version !== command.expectedWorkspaceVersion) {
      return Promise.resolve(
        this.error("STALE_REVISION", "הפנייה השתנתה. יש לרענן לפני ניסיון נוסף.", command.requestId, true),
      );
    }
    if (!command.reason.trim()) {
      return Promise.resolve(
        this.error("VALIDATION_FAILED", "נדרשת סיבה מתועדת לפעולה.", command.requestId, false),
      );
    }

    const eventId = `fixture-event-${this.eventSequence++}`;
    updater(workspace, eventId);
    workspace.version = nextVersion(workspace.version);
    this.syncConversation(workspace.conversation);

    const receipt: CommandReceipt = {
      requestId: command.requestId,
      eventId,
      state: "COMPLETED",
      acceptedAt: FIXTURE_NOW,
      workspaceVersion: workspace.version,
    };
    const result: RepositoryResult<CommandReceipt> = {
      ok: true,
      data: receipt,
      requestId: command.requestId,
    };
    this.receipts.set(command.idempotencyKey, { signature, result: clone(result) });
    return Promise.resolve(clone(result));
  }

  private syncConversation(conversation: ConversationListItem) {
    const index = this.conversations.findIndex((item) => item.conversationId === conversation.conversationId);
    if (index >= 0) this.conversations[index] = clone(conversation);
  }

  private timelineEvent(
    eventId: string,
    type: import("../domain/types").TimelineEventType,
    summary: string,
  ) {
    return {
      eventId,
      type,
      occurredAt: FIXTURE_NOW,
      actorLabel: "מנהלת שירות — בדיקה",
      summary,
      sensitivity: "INTERNAL" as const,
      immutableAuditReference: `audit-${eventId}`,
    };
  }

  private error<T>(
    code: RepositoryErrorCode,
    safeMessage: string,
    requestId: string,
    retryable: boolean,
  ): RepositoryResult<T> {
    return { ok: false, error: { code, safeMessage, requestId, retryable } };
  }
}

export function createFixtureControlTowerRepository(): ControlTowerRepository {
  return new FixtureControlTowerRepository();
}
