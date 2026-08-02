import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { CommandBase, CommandReceipt, InboxResult, RepositoryResult } from "../data/ControlTowerRepository";
import type { ConversationWorkspace, QueueId, SafeActionId } from "../domain/types";
import { ConversationList } from "../components/ConversationList";
import { ConversationPane } from "../components/ConversationPane";
import { ControlTowerShell } from "../components/ControlTowerShell";
import { Customer360Pane } from "../components/Customer360Pane";
import { QueueRail } from "../components/QueueRail";
import { useControlTower } from "../context/ControlTowerContext";

function shortHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function ControlTowerInboxPage({ customerRoute = false }: { customerRoute?: boolean }) {
  const { service, access } = useControlTower();
  const { conversationId = null } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [inbox, setInbox] = useState<InboxResult | null>(null);
  const [inboxLoading, setInboxLoading] = useState(true);
  const [inboxError, setInboxError] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<ConversationWorkspace | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [commandBusy, setCommandBusy] = useState(false);
  const [commandMessage, setCommandMessage] = useState<string | null>(null);
  const requestSequence = useRef(1);

  const activeQueue = (searchParams.get("queue") || "all") as QueueId;
  const session = access?.kind === "GRANTED" ? access.session : null;

  const loadInbox = useCallback(async () => {
    if (!service) return;
    setInboxLoading(true);
    setInboxError(null);
    const result = await service.inbox({
      queueId: activeQueue,
      priorities: [],
      states: [],
      cursor: null,
      limit: 50,
    });
    if (result.ok === true) setInbox(result.data);
    else setInboxError(result.error.safeMessage);
    setInboxLoading(false);
  }, [activeQueue, service]);

  const loadWorkspace = useCallback(async () => {
    if (!service || !conversationId) {
      setWorkspace(null);
      setWorkspaceError(null);
      return;
    }
    setWorkspaceLoading(true);
    setWorkspaceError(null);
    const result = await service.workspace(conversationId);
    if (result.ok === true) setWorkspace(result.data);
    else {
      setWorkspace(null);
      setWorkspaceError(result.error.safeMessage);
    }
    setWorkspaceLoading(false);
  }, [conversationId, service]);

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const visibleConversations = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase("he");
    if (!normalized) return inbox?.conversations ?? [];
    return (inbox?.conversations ?? []).filter((conversation) =>
      [
        conversation.maskedContactLabel,
        conversation.maskedChannelAddress,
        conversation.lastMessagePreview,
        ...conversation.domains,
      ].some((value) => value.toLocaleLowerCase("he").includes(normalized)),
    );
  }, [inbox?.conversations, search]);

  function querySuffix() {
    const query = searchParams.toString();
    return query ? `?${query}` : "";
  }

  function selectConversation(id: string) {
    navigate(`/control-tower/inbox/${id}${querySuffix()}`);
  }

  function selectQueue(queueId: QueueId) {
    const next = new URLSearchParams(searchParams);
    next.set("queue", queueId);
    setSearchParams(next, { replace: true });
  }

  function backToInbox() {
    navigate(`/control-tower/inbox${querySuffix()}`);
  }

  function openCustomer() {
    if (conversationId) navigate(`/control-tower/inbox/${conversationId}/customer${querySuffix()}`);
  }

  function backToConversation() {
    if (conversationId) navigate(`/control-tower/inbox/${conversationId}${querySuffix()}`);
  }

  async function runCommand(
    label: string,
    actionKey: string,
    execute: (base: CommandBase) => Promise<RepositoryResult<CommandReceipt>>,
  ): Promise<boolean> {
    if (!workspace || !service || commandBusy) return false;
    setCommandBusy(true);
    setCommandMessage(null);
    const requestId = `ct-ui-${requestSequence.current++}`;
    const base: CommandBase = {
      requestId,
      idempotencyKey: `ct:${workspace.conversation.conversationId}:${shortHash(actionKey)}`,
      conversationId: workspace.conversation.conversationId,
      caseId: workspace.cases[0]?.caseId ?? null,
      expectedWorkspaceVersion: workspace.version,
      reason: "OPERATOR_INITIATED_FROM_CONTROL_TOWER",
    };
    const result = await execute(base);
    if (result.ok === true) {
      setCommandMessage(`${label} הושלמה ותועדה.`);
      await Promise.all([loadWorkspace(), loadInbox()]);
      setCommandBusy(false);
      return true;
    }
    setCommandMessage(result.error.safeMessage);
    setCommandBusy(false);
    return false;
  }

  const takeover = () => {
    if (!service) return Promise.resolve(false);
    return runCommand("לקיחת הטיפול", "takeover", (base) => service.requestTakeover(base));
  };

  const reply = (body: string) => {
    if (!service) return Promise.resolve(false);
    return runCommand("שליחת המענה", `reply:${body}`, (base) =>
      service.sendReply({ ...base, body, replyKind: "PUBLIC" }),
    );
  };

  const note = (body: string) => {
    if (!service) return Promise.resolve(false);
    return runCommand("שמירת ההערה", `note:${body}`, (base) => service.addNote({ ...base, body }));
  };

  const safeAction = (actionId: SafeActionId) => {
    if (!service) return Promise.resolve(false);
    return runCommand("הפעולה", `safe-action:${actionId}`, (base) => service.executeAction({ ...base, actionId }));
  };

  if (!session || access?.kind !== "GRANTED") return null;

  return (
    <>
      <a className="ct-skip-link" href="#ct-main-content">דלגו לשיחה</a>
      <ControlTowerShell
        session={session}
        fixture={access.fixture}
        hasSelection={Boolean(conversationId)}
        customerRoute={customerRoute}
        inbox={
          <div className="ct-inbox-layout">
            <QueueRail queues={inbox?.queues ?? []} activeQueueId={activeQueue} onSelect={selectQueue} />
            {inboxError ? <div className="ct-inline-alert" role="alert">{inboxError}</div> : null}
            <ConversationList
              conversations={visibleConversations}
              selectedId={conversationId}
              search={search}
              onSearch={setSearch}
              onSelect={selectConversation}
              loading={inboxLoading}
            />
          </div>
        }
        conversation={
          <ConversationPane
            workspace={workspace}
            loading={workspaceLoading}
            error={workspaceError}
            commandBusy={commandBusy}
            onBack={backToInbox}
            onCustomer={openCustomer}
            onRetry={loadWorkspace}
            onTakeover={takeover}
            onReply={reply}
            onNote={note}
          />
        }
        customer={
          <Customer360Pane
            workspace={workspace}
            loading={workspaceLoading}
            commandBusy={commandBusy}
            onBack={backToConversation}
            onAction={safeAction}
          />
        }
      />
      {commandMessage ? (
        <div className="ct-toast" role="status" data-testid="command-message">
          <CheckCircle2 size={18} aria-hidden="true" />
          <span>{commandMessage}</span>
          <button type="button" aria-label="סגירת הודעה" onClick={() => setCommandMessage(null)}><X size={16} aria-hidden="true" /></button>
        </div>
      ) : null}
      <span className="ct-visually-hidden" data-testid="current-path">{location.pathname}</span>
    </>
  );
}
