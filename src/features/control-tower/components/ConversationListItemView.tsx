import { AlertCircle, CheckCircle2, Clock3, MessageCircle } from "lucide-react";
import type { ConversationListItem } from "../domain/types";
import { conversationStateLabels, deliveryLabels, domainLabels, formatFixtureTime, priorityLabels } from "./presentation";

export function ConversationListItemView({
  conversation,
  selected,
  onSelect,
}: {
  conversation: ConversationListItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const SlaIcon = conversation.sla.status === "BREACHED" ? AlertCircle : conversation.sla.status === "ON_TRACK" ? CheckCircle2 : Clock3;

  return (
    <li>
      <button
        type="button"
        className="ct-conversation-row"
        aria-current={selected ? "true" : undefined}
        onClick={onSelect}
        data-conversation-id={conversation.conversationId}
      >
        <span className="ct-row-topline">
          <strong>{conversation.maskedContactLabel}</strong>
          <time dateTime={conversation.lastMessageAt}>{formatFixtureTime(conversation.lastMessageAt)}</time>
        </span>
        <span className="ct-row-tags">
          <span className={`ct-priority ct-priority-${conversation.priority.toLowerCase()}`}>
            {conversation.priority} · {priorityLabels[conversation.priority]}
          </span>
          <span>{domainLabels[conversation.domains[0]]}</span>
          {conversation.unreadCount !== null && conversation.unreadCount > 0 ? <b aria-label={`${conversation.unreadCount} הודעות שלא נקראו`}>{conversation.unreadCount}</b> : null}
        </span>
        <span className="ct-row-preview">{conversation.lastMessagePreview ?? "הנתון אינו זמין בחוזה הקריאה"}</span>
        <span className="ct-row-footer">
          <span><MessageCircle size={14} aria-hidden="true" /> {conversationStateLabels[conversation.state]}</span>
          {conversation.lastDeliveryState === "FAILED" ? (
            <span className="ct-delivery-failed"><AlertCircle size={14} aria-hidden="true" /> {deliveryLabels.FAILED}</span>
          ) : null}
          <span className={`ct-sla ct-sla-${conversation.sla.status.toLowerCase()}`}><SlaIcon size={14} aria-hidden="true" /> {conversation.sla.status}</span>
        </span>
      </button>
    </li>
  );
}
