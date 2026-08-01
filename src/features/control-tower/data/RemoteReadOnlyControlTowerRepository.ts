import type { CtR0ClientError, CtR0InboxCursor, CtR0StagingService360 } from "./decoders";
import { createCtR0ReadOnlyClient } from "./ct-r0/CtR0ReadOnlyClient";
import {
  projectCtR0InboxItem,
  projectCtR0SessionToStaffAccess,
  projectCtR0Workspace,
} from "./ct-r0/projectCtR0ToControlTowerReadModel";
import { executeCtR0SupabaseRpc } from "./ct-r0/supabaseExecutor";
import type { SafeActionId, StaffAccess } from "../domain/types";
import type {
  CommandBase,
  CommandReceipt,
  ControlTowerRepository,
  InboxQuery,
  InboxResult,
  RepositoryErrorCode,
  RepositoryResult,
} from "./ControlTowerRepository";

const client = createCtR0ReadOnlyClient(executeCtR0SupabaseRpc, { sourceMode: "staging" });

export class RemoteReadOnlyControlTowerRepository implements ControlTowerRepository {
  readonly mode = "REMOTE" as const;

  async getStaffAccess(signal?: AbortSignal): Promise<StaffAccess> {
    const result = await client.getSession(signal);
    if (result.ok === true) return projectCtR0SessionToStaffAccess(result.data);
    if (result.error.code === "UNAUTHENTICATED") return { kind: "UNAUTHENTICATED" };
    if (result.error.code === "MFA_REQUIRED") return { kind: "MFA_REQUIRED" };
    if (result.error.code === "FORBIDDEN" || result.error.code === "FIXTURE_PERMISSION_REQUIRED") {
      return { kind: "FORBIDDEN", reasonCode: result.error.backendReasonCode ?? result.error.code };
    }
    return { kind: "UNAVAILABLE", reasonCode: "SOURCE_UNAVAILABLE" };
  }

  async listInbox(
    query: InboxQuery,
    signal?: AbortSignal,
  ): Promise<RepositoryResult<InboxResult>> {
    if (query.priorities.length > 0 || query.states.length > 0) {
      return failure("VALIDATION_FAILED", "המסנן אינו נתמך עדיין בחוזה הקריאה.", "ct-r0-inbox-filter", false);
    }
    const cursor = decodeCursor(query.cursor);
    if (query.cursor && !cursor) {
      return failure("VALIDATION_FAILED", "סמן העמוד אינו תקין.", "ct-r0-inbox-cursor", false);
    }
    const result = await client.listInbox({
      queueKey: query.queueId && query.queueId !== "all" ? query.queueId : null,
      caseStatus: null,
      cursor,
      limit: Math.max(1, Math.min(100, query.limit)),
    }, signal);
    if (result.ok === false) return mapClientFailure(result.error, "ct-r0-inbox");

    const queueKeys = [...new Set(result.data.items.map((item) => item.queue_key).filter(Boolean))] as string[];
    return {
      ok: true,
      requestId: requestId("inbox", result.meta.auditEventId),
      data: {
        queues: [
          { queueId: "all", label: "כל התורים", count: null },
          ...queueKeys.map((queueId) => ({ queueId, label: queueId, count: null })),
        ],
        conversations: result.data.items.map(projectCtR0InboxItem),
        nextCursor: result.data.page.nextCursor
          ? encodeURIComponent(JSON.stringify(result.data.page.nextCursor))
          : null,
      },
    };
  }

  async getWorkspace(
    conversationId: string,
    signal?: AbortSignal,
  ): Promise<RepositoryResult<ReturnType<typeof projectCtR0Workspace>>> {
    const conversation = await client.getConversation(conversationId, signal);
    if (conversation.ok === false) return mapClientFailure(conversation.error, "ct-r0-conversation");

    if (!conversation.data.case_id) {
      return {
        ok: true,
        requestId: requestId("workspace", conversation.meta.auditEventId),
        data: projectCtR0Workspace({
          generatedAt: conversation.meta.generatedAt,
          conversation: conversation.data,
          caseRecord: null,
          messages: [],
          timeline: [],
          service360: null,
        }),
      };
    }

    const caseId = conversation.data.case_id;
    const [caseResult, messages, timeline, service360] = await Promise.all([
      client.getCase(caseId, signal),
      client.listCaseMessages(caseId, { limit: 100 }, signal),
      client.listCaseTimeline(caseId, { limit: 100 }, signal),
      client.getService360(caseId, signal),
    ]);
    if (caseResult.ok === false) return mapClientFailure(caseResult.error, "ct-r0-case");
    if (messages.ok === false) return mapClientFailure(messages.error, "ct-r0-messages");
    if (timeline.ok === false) return mapClientFailure(timeline.error, "ct-r0-timeline");

    const canonicalService360: CtR0StagingService360 | null = service360.ok === true && !("fixture" in service360.data)
      ? service360.data as CtR0StagingService360
      : null;
    return {
      ok: true,
      requestId: requestId("workspace", conversation.meta.auditEventId),
      data: projectCtR0Workspace({
        generatedAt: conversation.meta.generatedAt,
        conversation: conversation.data,
        caseRecord: caseResult.data,
        messages: messages.data.items,
        timeline: timeline.data.items,
        service360: canonicalService360,
      }),
    };
  }

  requestTakeover(command: CommandBase) { return this.notSupported(command.requestId); }
  acceptConversationLease(command: CommandBase) { return this.notSupported(command.requestId); }
  releaseConversationLease(command: CommandBase) { return this.notSupported(command.requestId); }
  addInternalNote(command: CommandBase & { body: string }) { return this.notSupported(command.requestId); }
  sendReply(command: CommandBase & { body: string; replyKind: "PUBLIC" | "ACCOUNT_SPECIFIC" }) {
    return this.notSupported(command.requestId);
  }
  executeSafeAction(command: CommandBase & { actionId: SafeActionId }) {
    return this.notSupported(command.requestId);
  }

  private notSupported(requestIdValue: string): Promise<RepositoryResult<CommandReceipt>> {
    return Promise.resolve(failure(
      "NOT_SUPPORTED",
      "חוזה Control Tower הנוכחי הוא לקריאה בלבד.",
      requestIdValue,
      false,
    ));
  }
}

function decodeCursor(value: string | null): CtR0InboxCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Record<string, unknown>;
    if (typeof parsed.beforeLastActivityAt !== "string" || typeof parsed.beforeConversationId !== "string") return null;
    return {
      beforeLastActivityAt: parsed.beforeLastActivityAt,
      beforeConversationId: parsed.beforeConversationId,
    };
  } catch {
    return null;
  }
}

function mapClientFailure<T>(error: CtR0ClientError, fallbackId: string): RepositoryResult<T> {
  const codeMap: Partial<Record<CtR0ClientError["code"], RepositoryErrorCode>> = {
    UNAUTHENTICATED: "UNAUTHENTICATED",
    MFA_REQUIRED: "MFA_REQUIRED",
    FORBIDDEN: "FORBIDDEN",
    FIXTURE_PERMISSION_REQUIRED: "FORBIDDEN",
    VERIFICATION_REQUIRED: "VERIFICATION_REQUIRED",
    NOT_FOUND: "NOT_FOUND",
    VALIDATION_FAILED: "VALIDATION_FAILED",
    RATE_LIMITED: "RATE_LIMITED",
    SOURCE_UNAVAILABLE: "SOURCE_UNAVAILABLE",
  };
  return failure(codeMap[error.code] ?? "SOURCE_UNAVAILABLE", error.safeMessage, fallbackId, error.retryable);
}

function failure<T>(
  code: RepositoryErrorCode,
  safeMessage: string,
  requestIdValue: string,
  retryable: boolean,
): RepositoryResult<T> {
  return { ok: false, error: { code, safeMessage, requestId: requestIdValue, retryable } };
}

function requestId(scope: string, auditEventId: string | null): string {
  return auditEventId ? `ct-r0:${scope}:audit:${auditEventId}` : `ct-r0:${scope}`;
}

export function createRemoteReadOnlyControlTowerRepository(): ControlTowerRepository {
  return new RemoteReadOnlyControlTowerRepository();
}
