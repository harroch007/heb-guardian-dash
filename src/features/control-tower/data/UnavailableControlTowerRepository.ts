import type { SafeActionId, StaffAccess } from "../domain/types";
import type {
  CommandBase,
  CommandReceipt,
  ControlTowerRepository,
  InboxQuery,
  InboxResult,
  RepositoryResult,
} from "./ControlTowerRepository";

export class UnavailableControlTowerRepository implements ControlTowerRepository {
  readonly mode = "UNAVAILABLE" as const;

  constructor(
    private readonly reasonCode: "STAFF_BACKEND_NOT_CONFIGURED" | "SOURCE_UNAVAILABLE",
  ) {}

  async getStaffAccess(): Promise<StaffAccess> {
    return { kind: "UNAVAILABLE", reasonCode: this.reasonCode };
  }

  private unavailable<T>(): Promise<RepositoryResult<T>> {
    return Promise.resolve({
      ok: false,
      error: {
        code: "SOURCE_UNAVAILABLE",
        safeMessage: "מקור המידע לצוות אינו זמין כעת.",
        requestId: "ct-unavailable",
        retryable: false,
      },
    });
  }

  listInbox(_query: InboxQuery): Promise<RepositoryResult<InboxResult>> {
    return this.unavailable();
  }

  getWorkspace(): Promise<RepositoryResult<never>> {
    return this.unavailable();
  }

  requestTakeover(_command: CommandBase): Promise<RepositoryResult<CommandReceipt>> {
    return this.unavailable();
  }

  acceptConversationLease(_command: CommandBase): Promise<RepositoryResult<CommandReceipt>> {
    return this.unavailable();
  }

  releaseConversationLease(_command: CommandBase): Promise<RepositoryResult<CommandReceipt>> {
    return this.unavailable();
  }

  addInternalNote(_command: CommandBase & { body: string }): Promise<RepositoryResult<CommandReceipt>> {
    return this.unavailable();
  }

  sendReply(
    _command: CommandBase & { body: string; replyKind: "PUBLIC" | "ACCOUNT_SPECIFIC" },
  ): Promise<RepositoryResult<CommandReceipt>> {
    return this.unavailable();
  }

  executeSafeAction(
    _command: CommandBase & { actionId: SafeActionId },
  ): Promise<RepositoryResult<CommandReceipt>> {
    return this.unavailable();
  }
}
