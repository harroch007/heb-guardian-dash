import {
  ctR0SourceModeSchema,
  decodeCtR0AuditEventsEnvelope,
  decodeCtR0AuditQuery,
  decodeCtR0CaseActionsEnvelope,
  decodeCtR0CaseEnvelope,
  decodeCtR0ConversationEnvelope,
  decodeCtR0InboxEnvelope,
  decodeCtR0InboxQuery,
  decodeCtR0MessagesEnvelope,
  decodeCtR0MessageQuery,
  decodeCtR0ParentSafeIncidentEnvelope,
  decodeCtR0Service360Envelope,
  decodeCtR0SessionEnvelope,
  decodeCtR0TimelineEnvelope,
  decodeCtR0TimelineQuery,
  mapCtR0DeniedEnvelope,
  mapCtR0TransportError,
  malformedCtR0ResponseError,
  uuidSchema,
  type CtR0AuditCursor,
  type CtR0CaseAction,
  type CtR0ClientError,
  type CtR0Collection,
  type CtR0CollectionPage,
  type CtR0DecodeResult,
  type CtR0InboxCursor,
  type CtR0InboxItem,
  type CtR0Message,
  type CtR0MessageCursor,
  type CtR0Page,
  type CtR0RpcEnvelope,
  type CtR0SuccessEnvelope,
  type CtR0TimelineCursor,
  type CtR0TimelineEvent,
} from "../decoders";
import type {
  CtR0ActionCollection,
  CtR0AuditCollection,
  CtR0ClientOptions,
  CtR0ClientResult,
  CtR0InboxCollection,
  CtR0MessageCollection,
  CtR0ReadOnlyClientContract,
  CtR0ReadRpcName,
  CtR0ResponseMeta,
  CtR0RpcArguments,
  CtR0RpcExecutor,
  CtR0TimelineCollection,
} from "./contracts";

type EnvelopeDecoder<TData, TPage extends CtR0Page | null> = (
  value: unknown,
) => CtR0DecodeResult<CtR0RpcEnvelope<TData, TPage>>;

type InternalResult<TData, TPage extends CtR0Page | null> =
  | {
      readonly ok: true;
      readonly data: TData;
      readonly page: TPage;
      readonly meta: CtR0ResponseMeta;
    }
  | { readonly ok: false; readonly error: CtR0ClientError };

function clientFailure(error: CtR0ClientError): { readonly ok: false; readonly error: CtR0ClientError } {
  return { ok: false, error };
}

function validationFailure(): { readonly ok: false; readonly error: CtR0ClientError } {
  return clientFailure({
    code: "VALIDATION_FAILED",
    safeMessage: "The Control Tower request is invalid.",
    retryable: false,
    backendReasonCode: null,
  });
}

function policyFailure(
  code: "MFA_REQUIRED" | "FORBIDDEN" | "FIXTURE_PERMISSION_REQUIRED",
  safeMessage: string,
): { readonly ok: false; readonly error: CtR0ClientError } {
  return clientFailure({
    code,
    safeMessage,
    retryable: false,
    backendReasonCode: null,
  });
}

function sourceModeFailure(): { readonly ok: false; readonly error: CtR0ClientError } {
  return clientFailure({
    code: "SOURCE_MODE_MISMATCH",
    safeMessage: "Control Tower returned data from an unexpected source mode.",
    retryable: false,
    backendReasonCode: null,
  });
}

function pageFailure(): { readonly ok: false; readonly error: CtR0ClientError } {
  return clientFailure(
    malformedCtR0ResponseError([{ path: "$.page.limit", code: "unexpected_page_limit" }]),
  );
}

function decodeUuid(value: unknown): string | null {
  const decoded = uuidSchema.safeParse(value);
  return decoded.success ? decoded.data : null;
}

function responseMeta<TData, TPage extends CtR0Page | null>(
  envelope: CtR0SuccessEnvelope<TData, TPage>,
): CtR0ResponseMeta {
  return {
    schemaVersion: envelope.schema_version,
    generatedAt: envelope.generated_at,
    sourceMode: envelope.source_mode,
    auditEventId: envelope.audit_event_id,
  };
}

function collectionPage<TCursor>(
  limit: number,
  itemCount: number,
  nextCursor: TCursor | null,
  cursorUnavailable = false,
): CtR0CollectionPage<TCursor> {
  return {
    limit,
    nextCursor,
    cursorState:
      itemCount < limit ? "END" : cursorUnavailable ? "UNAVAILABLE_CT_R0_GAP" : "AVAILABLE",
  };
}

export class CtR0ReadOnlyClient implements CtR0ReadOnlyClientContract {
  readonly sourceMode;

  constructor(
    private readonly executeRpc: CtR0RpcExecutor,
    options: CtR0ClientOptions,
  ) {
    const sourceMode = ctR0SourceModeSchema.safeParse(options?.sourceMode);
    if (!sourceMode.success || typeof executeRpc !== "function") {
      throw new TypeError("Invalid CT-R0 read client configuration.");
    }
    this.sourceMode = sourceMode.data;
  }

  private async read<TData, TPage extends CtR0Page | null>(
    rpcName: CtR0ReadRpcName,
    arguments_: CtR0RpcArguments,
    decoder: EnvelopeDecoder<TData, TPage>,
    signal: AbortSignal | undefined,
    expectedSourceMode = this.sourceMode,
  ): Promise<InternalResult<TData, TPage>> {
    if (signal?.aborted) {
      return clientFailure(mapCtR0TransportError({}, signal));
    }

    let execution;
    try {
      execution = await this.executeRpc(rpcName, arguments_, signal);
    } catch (error: unknown) {
      return clientFailure(mapCtR0TransportError(error, signal));
    }

    if (execution.error !== null) {
      return clientFailure(mapCtR0TransportError(execution.error, signal));
    }

    const decoded = decoder(execution.data);
    if (decoded.ok === false) return clientFailure(malformedCtR0ResponseError(decoded.issues));
    if (decoded.value.kind === "DENIED") {
      return clientFailure(mapCtR0DeniedEnvelope(decoded.value.envelope));
    }

    const envelope = decoded.value.envelope;
    if (envelope.source_mode !== expectedSourceMode) return sourceModeFailure();

    return {
      ok: true,
      data: envelope.data,
      page: envelope.page,
      meta: responseMeta(envelope),
    };
  }

  async getSession(signal?: AbortSignal) {
    const result = await this.read(
      "v2_admin_get_session",
      {},
      decodeCtR0SessionEnvelope,
      signal,
      "staging",
    );
    if (result.ok === false) return result;
    if (result.data.aal !== "aal2") {
      return policyFailure("MFA_REQUIRED", "Multi-factor authentication is required.");
    }
    if (result.data.status !== "active") {
      return policyFailure("FORBIDDEN", "The staff account is not active.");
    }
    if (!result.data.permissions.includes("control.session.read")) {
      return policyFailure("FORBIDDEN", "The staff session permission is missing.");
    }
    if (this.sourceMode === "fixture" && !result.data.permissions.includes("fixture.read")) {
      return policyFailure(
        "FIXTURE_PERMISSION_REQUIRED",
        "Fixture access is not permitted for this staff session.",
      );
    }
    return { ok: true as const, data: result.data, meta: result.meta };
  }

  async listInbox(query = {}, signal?: AbortSignal): Promise<CtR0ClientResult<CtR0InboxCollection>> {
    const decodedQuery = decodeCtR0InboxQuery(query);
    if (decodedQuery.ok === false) return validationFailure();
    const { queueKey, caseStatus, cursor, limit } = decodedQuery.value;
    const result = await this.read(
      "v2_admin_list_inbox",
      {
        target_source_mode: this.sourceMode,
        target_queue_key: queueKey,
        target_case_status: caseStatus,
        target_before_last_activity_at: cursor?.beforeLastActivityAt ?? null,
        target_before_conversation_id: cursor?.beforeConversationId ?? null,
        target_limit: limit,
      },
      decodeCtR0InboxEnvelope,
      signal,
    );
    if (result.ok === false) return result;
    if (result.page.limit !== limit) return pageFailure();

    const last = result.data[result.data.length - 1];
    const nextCursor: CtR0InboxCursor | null =
      result.data.length === limit && last
        ? {
            beforeLastActivityAt: last.last_activity_at,
            beforeConversationId: last.conversation_id,
          }
        : null;
    return {
      ok: true,
      data: {
        items: result.data,
        page: collectionPage(limit, result.data.length, nextCursor),
      },
      meta: result.meta,
    };
  }

  async getConversation(conversationId: string, signal?: AbortSignal) {
    const id = decodeUuid(conversationId);
    if (!id) return validationFailure();
    const result = await this.read(
      "v2_admin_get_conversation",
      { target_conversation_id: id },
      decodeCtR0ConversationEnvelope,
      signal,
    );
    if (result.ok === false) return result;
    if (result.data.source_mode !== this.sourceMode) return sourceModeFailure();
    return { ok: true as const, data: result.data, meta: result.meta };
  }

  async getCase(caseId: string, signal?: AbortSignal) {
    const id = decodeUuid(caseId);
    if (!id) return validationFailure();
    const result = await this.read(
      "v2_admin_get_case",
      { target_case_id: id },
      decodeCtR0CaseEnvelope,
      signal,
    );
    if (result.ok === false) return result;
    if (result.data.source_mode !== this.sourceMode) return sourceModeFailure();
    return { ok: true as const, data: result.data, meta: result.meta };
  }

  async listCaseMessages(
    caseId: string,
    query = {},
    signal?: AbortSignal,
  ): Promise<CtR0ClientResult<CtR0MessageCollection>> {
    const id = decodeUuid(caseId);
    const decodedQuery = decodeCtR0MessageQuery(query);
    if (!id || decodedQuery.ok === false) return validationFailure();
    const { cursor, limit } = decodedQuery.value;
    const result = await this.read(
      "v2_admin_list_case_messages",
      {
        target_case_id: id,
        target_before_server_received_at: cursor?.beforeServerReceivedAt ?? null,
        target_before_message_id: cursor?.beforeMessageId ?? null,
        target_limit: limit,
      },
      decodeCtR0MessagesEnvelope,
      signal,
    );
    if (result.ok === false) return result;
    if (result.page.limit !== limit) return pageFailure();

    const last = result.data[result.data.length - 1];
    const nextCursor: CtR0MessageCursor | null =
      result.data.length === limit && last
        ? { beforeServerReceivedAt: last.server_received_at, beforeMessageId: last.message_id }
        : null;
    return {
      ok: true,
      data: {
        items: result.data,
        page: collectionPage(limit, result.data.length, nextCursor),
      },
      meta: result.meta,
    };
  }

  async listCaseTimeline(
    caseId: string,
    query = {},
    signal?: AbortSignal,
  ): Promise<CtR0ClientResult<CtR0TimelineCollection>> {
    const id = decodeUuid(caseId);
    const decodedQuery = decodeCtR0TimelineQuery(query);
    if (!id || decodedQuery.ok === false) return validationFailure();
    const { cursor, limit } = decodedQuery.value;
    const result = await this.read(
      "v2_admin_list_case_timeline",
      {
        target_case_id: id,
        target_before_occurred_at: cursor?.beforeOccurredAt ?? null,
        target_before_event_id: cursor?.beforeEventId ?? null,
        target_limit: limit,
      },
      decodeCtR0TimelineEnvelope,
      signal,
    );
    if (result.ok === false) return result;
    if (result.page.limit !== limit) return pageFailure();

    return {
      ok: true,
      data: {
        items: result.data,
        page: collectionPage<CtR0TimelineCursor>(
          limit,
          result.data.length,
          null,
          result.data.length === limit,
        ),
      },
      meta: result.meta,
    };
  }

  async getService360(caseId: string, signal?: AbortSignal) {
    const id = decodeUuid(caseId);
    if (!id) return validationFailure();
    const result = await this.read(
      "v2_admin_get_service360",
      { target_case_id: id },
      decodeCtR0Service360Envelope,
      signal,
    );
    if (result.ok === false) return result;
    return { ok: true as const, data: result.data, meta: result.meta };
  }

  async getParentSafeIncident(caseId: string, signal?: AbortSignal) {
    const id = decodeUuid(caseId);
    if (!id) return validationFailure();
    const result = await this.read(
      "v2_admin_get_parent_safe_incident",
      { target_case_id: id },
      decodeCtR0ParentSafeIncidentEnvelope,
      signal,
    );
    if (result.ok === false) return result;
    return { ok: true as const, data: result.data, meta: result.meta };
  }

  async listCaseActions(
    caseId: string,
    signal?: AbortSignal,
  ): Promise<CtR0ClientResult<CtR0ActionCollection>> {
    const id = decodeUuid(caseId);
    if (!id) return validationFailure();
    const result = await this.read(
      "v2_admin_list_case_actions",
      { target_case_id: id },
      decodeCtR0CaseActionsEnvelope,
      signal,
    );
    if (result.ok === false) return result;
    if (result.page.limit !== 100) return pageFailure();

    const page: CtR0CollectionPage<{ readonly unsupported: true }> = collectionPage<{
      readonly unsupported: true;
    }>(
      100,
      result.data.length,
      null,
      result.data.length === 100,
    );
    return {
      ok: true,
      data: { items: result.data, page },
      meta: result.meta,
    };
  }

  async listAuditEvents(query = {}, signal?: AbortSignal): Promise<CtR0ClientResult<CtR0AuditCollection>> {
    const decodedQuery = decodeCtR0AuditQuery(query);
    if (decodedQuery.ok === false) return validationFailure();
    const { caseId, cursor, limit } = decodedQuery.value;
    const result = await this.read(
      "v2_admin_list_audit_events",
      {
        target_case_id: caseId,
        target_before_created_at: cursor?.beforeCreatedAt ?? null,
        target_before_event_id: cursor?.beforeEventId ?? null,
        target_limit: limit,
      },
      decodeCtR0AuditEventsEnvelope,
      signal,
      "staging",
    );
    if (result.ok === false) return result;
    if (result.page.limit !== limit) return pageFailure();

    const last = result.data[result.data.length - 1];
    const nextCursor: CtR0AuditCursor | null =
      result.data.length === limit && last
        ? { beforeCreatedAt: last.created_at, beforeEventId: last.audit_event_id }
        : null;
    return {
      ok: true,
      data: {
        items: result.data,
        page: collectionPage(limit, result.data.length, nextCursor),
      },
      meta: result.meta,
    };
  }
}

export function createCtR0ReadOnlyClient(
  executeRpc: CtR0RpcExecutor,
  options: CtR0ClientOptions,
): CtR0ReadOnlyClient {
  return new CtR0ReadOnlyClient(executeRpc, options);
}
