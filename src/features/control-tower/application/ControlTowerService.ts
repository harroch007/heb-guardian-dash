import type { ConversationId, ConversationWorkspace, SafeActionId, StaffAccess } from "../domain/types";
import type {
  CommandBase,
  CommandReceipt,
  ControlTowerRepository,
  InboxQuery,
  InboxResult,
  RepositoryResult,
} from "../data/ControlTowerRepository";

export interface ControlTowerService {
  readonly mode: ControlTowerRepository["mode"];
  access(signal?: AbortSignal): Promise<StaffAccess>;
  inbox(query: InboxQuery, signal?: AbortSignal): Promise<RepositoryResult<InboxResult>>;
  workspace(id: ConversationId, signal?: AbortSignal): Promise<RepositoryResult<ConversationWorkspace>>;
  requestTakeover(command: CommandBase): Promise<RepositoryResult<CommandReceipt>>;
  acceptLease(command: CommandBase): Promise<RepositoryResult<CommandReceipt>>;
  releaseLease(command: CommandBase): Promise<RepositoryResult<CommandReceipt>>;
  addNote(command: CommandBase & { body: string }): Promise<RepositoryResult<CommandReceipt>>;
  sendReply(
    command: CommandBase & { body: string; replyKind: "PUBLIC" | "ACCOUNT_SPECIFIC" },
  ): Promise<RepositoryResult<CommandReceipt>>;
  executeAction(
    command: CommandBase & { actionId: SafeActionId },
  ): Promise<RepositoryResult<CommandReceipt>>;
}

function validationFailure<T>(requestId: string, safeMessage: string): RepositoryResult<T> {
  return {
    ok: false,
    error: {
      code: "VALIDATION_FAILED",
      safeMessage,
      requestId,
      retryable: false,
    },
  };
}

export function createControlTowerService(repository: ControlTowerRepository): ControlTowerService {
  return {
    mode: repository.mode,
    access: (signal) => repository.getStaffAccess(signal),
    inbox: (query, signal) => repository.listInbox(query, signal),
    workspace: (id, signal) => repository.getWorkspace(id, signal),
    requestTakeover: (command) => repository.requestTakeover(command),
    acceptLease: (command) => repository.acceptConversationLease(command),
    releaseLease: (command) => repository.releaseConversationLease(command),
    addNote: (command) => {
      const body = command.body.trim();
      return body
        ? repository.addInternalNote({ ...command, body })
        : Promise.resolve(validationFailure(command.requestId, "יש לכתוב הערה לפני השמירה."));
    },
    sendReply: (command) => {
      const body = command.body.trim();
      return body
        ? repository.sendReply({ ...command, body })
        : Promise.resolve(validationFailure(command.requestId, "יש לכתוב הודעה לפני השליחה."));
    },
    executeAction: (command) => repository.executeSafeAction(command),
  };
}

