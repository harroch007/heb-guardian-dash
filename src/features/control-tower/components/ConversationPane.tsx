import { ArrowRight, BriefcaseBusiness, PanelLeftOpen, RefreshCcw, UserRoundCheck } from "lucide-react";
import type { ConversationWorkspace } from "../domain/types";
import { conversationStateLabels, domainLabels, priorityLabels } from "./presentation";
import { ReplyComposer } from "./ReplyComposer";
import { SupportMessageTimeline } from "./SupportMessageTimeline";
import { VerificationBanner } from "./VerificationBanner";

interface ConversationPaneProps {
  workspace: ConversationWorkspace | null;
  loading: boolean;
  error: string | null;
  commandBusy: boolean;
  onBack: () => void;
  onCustomer: () => void;
  onRetry: () => void;
  onTakeover: () => Promise<boolean>;
  onReply: (body: string) => Promise<boolean>;
  onNote: (body: string) => Promise<boolean>;
}

export function ConversationPane({
  workspace,
  loading,
  error,
  commandBusy,
  onBack,
  onCustomer,
  onRetry,
  onTakeover,
  onReply,
  onNote,
}: ConversationPaneProps) {
  if (loading) return <div className="ct-pane-state" role="status">טוענים את השיחה…</div>;
  if (error) {
    return (
      <div className="ct-pane-state" role="alert">
        <p>{error}</p>
        <button type="button" className="ct-button ct-button-secondary" onClick={onRetry}><RefreshCcw size={16} aria-hidden="true" /> נסו שוב</button>
      </div>
    );
  }
  if (!workspace) {
    return (
      <div className="ct-empty-pane">
        <BriefcaseBusiness size={30} aria-hidden="true" />
        <h2>בחרו פנייה לעבודה</h2>
        <p>השיחה, האימות והפעולות הבטוחות יוצגו כאן.</p>
      </div>
    );
  }

  const { conversation } = workspace;
  const customerAvailable = conversation.identityMatch === "VERIFIED" && workspace.customer360 !== null;

  return (
    <div className="ct-conversation-view">
      <header className="ct-conversation-header">
        <button type="button" className="ct-icon-button ct-mobile-only" aria-label="חזרה לרשימת הפניות" onClick={onBack}>
          <ArrowRight size={20} aria-hidden="true" />
        </button>
        <div className="ct-conversation-title">
          <p className="ct-eyebrow">{conversation.maskedChannelAddress}</p>
          <h2>{conversation.maskedContactLabel}</h2>
          <div className="ct-meta-line">
            <span className={`ct-priority ct-priority-${conversation.priority.toLowerCase()}`}>{conversation.priority} · {priorityLabels[conversation.priority]}</span>
            <span>{conversationStateLabels[conversation.state]}</span>
            <span>{domainLabels[conversation.domains[0]]}</span>
            <span>{workspace.cases.length > 0 ? `Case ${workspace.cases[0].caseId.replace("case_fixture_", "#")}` : "ללא Case"}</span>
          </div>
        </div>
        <div className="ct-header-actions">
          <button
            type="button"
            className="ct-button ct-button-secondary"
            onClick={() => void onTakeover()}
            disabled={commandBusy}
            data-testid="takeover-button"
          >
            <UserRoundCheck size={16} aria-hidden="true" /> לקיחת טיפול
          </button>
          <button
            type="button"
            className="ct-button ct-button-secondary ct-customer-toggle"
            onClick={onCustomer}
            disabled={!customerAvailable}
            aria-disabled={!customerAvailable}
          >
            <PanelLeftOpen size={16} aria-hidden="true" /> Customer 360
          </button>
        </div>
      </header>
      <VerificationBanner conversation={conversation} />
      <div className="ct-conversation-scroll">
        <SupportMessageTimeline messages={workspace.messages} />
      </div>
      <ReplyComposer
        disabled={conversation.identityMatch === "AMBIGUOUS" || conversation.sensitive}
        busy={commandBusy}
        onReply={onReply}
        onNote={onNote}
      />
    </div>
  );
}
