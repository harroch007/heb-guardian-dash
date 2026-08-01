import type {
  CtR0AuditCursor,
  CtR0AuditEvent,
  CtR0AuditQuery,
  CtR0Case,
  CtR0CaseAction,
  CtR0ClientError,
  CtR0Collection,
  CtR0Conversation,
  CtR0InboxCursor,
  CtR0InboxItem,
  CtR0InboxQuery,
  CtR0Message,
  CtR0MessageCursor,
  CtR0MessageQuery,
  CtR0ParentSafeIncident,
  CtR0Service360,
  CtR0Session,
  CtR0SourceMode,
  CtR0TimelineCursor,
  CtR0TimelineEvent,
  CtR0TimelineQuery,
} from "../decoders";

export const CT_R0_READ_RPC_NAMES = [
  "v2_admin_get_session",
  "v2_admin_list_inbox",
  "v2_admin_get_conversation",
  "v2_admin_get_case",
  "v2_admin_list_case_messages",
  "v2_admin_list_case_timeline",
  "v2_admin_get_service360",
  "v2_admin_get_parent_safe_incident",
  "v2_admin_list_case_actions",
  "v2_admin_list_audit_events",
] as const;

export type CtR0ReadRpcName = (typeof CT_R0_READ_RPC_NAMES)[number];

export type CtR0RpcArgument = string | number | boolean | null;
export type CtR0RpcArguments = Readonly<Record<string, CtR0RpcArgument>>;

export interface CtR0RpcExecution {
  readonly data: unknown;
  readonly error: unknown | null;
}

export type CtR0RpcExecutor = (
  rpcName: CtR0ReadRpcName,
  arguments_: CtR0RpcArguments,
  signal?: AbortSignal,
) => Promise<CtR0RpcExecution>;

export interface CtR0ClientOptions {
  readonly sourceMode: CtR0SourceMode;
}

export interface CtR0ResponseMeta {
  readonly schemaVersion: 1;
  readonly generatedAt: string;
  readonly sourceMode: CtR0SourceMode;
  readonly auditEventId: string | null;
}

export type CtR0ClientResult<T> =
  | { readonly ok: true; readonly data: T; readonly meta: CtR0ResponseMeta }
  | { readonly ok: false; readonly error: CtR0ClientError };

export type CtR0InboxCollection = CtR0Collection<CtR0InboxItem, CtR0InboxCursor>;
export type CtR0MessageCollection = CtR0Collection<CtR0Message, CtR0MessageCursor>;
export type CtR0TimelineCollection = CtR0Collection<CtR0TimelineEvent, CtR0TimelineCursor>;
export interface CtR0ActionCursorUnsupported {
  readonly unsupported: true;
}
export type CtR0ActionCollection = CtR0Collection<CtR0CaseAction, CtR0ActionCursorUnsupported>;
export type CtR0AuditCollection = CtR0Collection<CtR0AuditEvent, CtR0AuditCursor>;

export interface CtR0ReadOnlyClientContract {
  readonly sourceMode: CtR0SourceMode;
  getSession(signal?: AbortSignal): Promise<CtR0ClientResult<CtR0Session>>;
  listInbox(
    query?: CtR0InboxQuery,
    signal?: AbortSignal,
  ): Promise<CtR0ClientResult<CtR0InboxCollection>>;
  getConversation(
    conversationId: string,
    signal?: AbortSignal,
  ): Promise<CtR0ClientResult<CtR0Conversation>>;
  getCase(caseId: string, signal?: AbortSignal): Promise<CtR0ClientResult<CtR0Case>>;
  listCaseMessages(
    caseId: string,
    query?: CtR0MessageQuery,
    signal?: AbortSignal,
  ): Promise<CtR0ClientResult<CtR0MessageCollection>>;
  listCaseTimeline(
    caseId: string,
    query?: CtR0TimelineQuery,
    signal?: AbortSignal,
  ): Promise<CtR0ClientResult<CtR0TimelineCollection>>;
  getService360(
    caseId: string,
    signal?: AbortSignal,
  ): Promise<CtR0ClientResult<CtR0Service360>>;
  getParentSafeIncident(
    caseId: string,
    signal?: AbortSignal,
  ): Promise<CtR0ClientResult<CtR0ParentSafeIncident>>;
  listCaseActions(
    caseId: string,
    signal?: AbortSignal,
  ): Promise<CtR0ClientResult<CtR0ActionCollection>>;
  listAuditEvents(
    query?: CtR0AuditQuery,
    signal?: AbortSignal,
  ): Promise<CtR0ClientResult<CtR0AuditCollection>>;
}
