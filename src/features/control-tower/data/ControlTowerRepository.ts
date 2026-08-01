import type {
  CaseId,
  ConversationId,
  ConversationState,
  ConversationWorkspace,
  Priority,
  QueueId,
  SafeActionId,
  StaffAccess,
} from "../domain/types";

export type RepositoryErrorCode =
  | "UNAUTHENTICATED"
  | "MFA_REQUIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "STALE_REVISION"
  | "VALIDATION_FAILED"
  | "VERIFICATION_REQUIRED"
  | "APPROVAL_REQUIRED"
  | "RATE_LIMITED"
  | "SOURCE_UNAVAILABLE"
  | "NOT_SUPPORTED";

export type RepositoryResult<T> =
  | { ok: true; data: T; requestId: string }
  | {
      ok: false;
      error: {
        code: RepositoryErrorCode;
        safeMessage: string;
        requestId: string;
        retryable: boolean;
      };
    };

export interface InboxQuery {
  queueId: QueueId | null;
  priorities: readonly Priority[];
  states: readonly ConversationState[];
  cursor: string | null;
  limit: number;
}

export interface InboxResult {
  queues: readonly { queueId: QueueId; label: string; count: number | null }[];
  conversations: readonly import("../domain/types").ConversationListItem[];
  nextCursor: string | null;
}

export interface CommandBase {
  requestId: string;
  idempotencyKey: string;
  conversationId: ConversationId;
  caseId: CaseId | null;
  expectedWorkspaceVersion: string;
  reason: string;
}

export interface CommandReceipt {
  requestId: string;
  eventId: string;
  state: "ACCEPTED" | "COMPLETED" | "PENDING_VERIFICATION" | "DENIED";
  acceptedAt: string;
  workspaceVersion: string;
}

export interface ControlTowerRepository {
  readonly mode: "FIXTURE" | "REMOTE" | "UNAVAILABLE";
  getStaffAccess(signal?: AbortSignal): Promise<StaffAccess>;
  listInbox(query: InboxQuery, signal?: AbortSignal): Promise<RepositoryResult<InboxResult>>;
  getWorkspace(conversationId: ConversationId, signal?: AbortSignal): Promise<RepositoryResult<ConversationWorkspace>>;
  requestTakeover(command: CommandBase): Promise<RepositoryResult<CommandReceipt>>;
  acceptConversationLease(command: CommandBase): Promise<RepositoryResult<CommandReceipt>>;
  releaseConversationLease(command: CommandBase): Promise<RepositoryResult<CommandReceipt>>;
  addInternalNote(command: CommandBase & { body: string }): Promise<RepositoryResult<CommandReceipt>>;
  sendReply(
    command: CommandBase & { body: string; replyKind: "PUBLIC" | "ACCOUNT_SPECIFIC" },
  ): Promise<RepositoryResult<CommandReceipt>>;
  executeSafeAction(command: CommandBase & { actionId: SafeActionId }): Promise<RepositoryResult<CommandReceipt>>;
}
