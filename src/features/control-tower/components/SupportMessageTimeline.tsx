import { Bot, CheckCheck, CircleAlert, Headset, UserRound } from "lucide-react";
import type { SupportMessage } from "../domain/types";
import { deliveryLabels, formatFixtureTime, valueStateLabels } from "./presentation";

function senderLabel(message: SupportMessage) {
  if (message.senderKind === "CUSTOMER") return "לקוח/ה";
  if (message.senderKind === "AI") return "Kippy AI";
  if (message.senderKind === "STAFF") return "צוות Kippy";
  return "מערכת";
}

function SenderIcon({ kind }: { kind: SupportMessage["senderKind"] }) {
  if (kind === "CUSTOMER") return <UserRound size={15} aria-hidden="true" />;
  if (kind === "AI") return <Bot size={15} aria-hidden="true" />;
  if (kind === "STAFF") return <Headset size={15} aria-hidden="true" />;
  return <CircleAlert size={15} aria-hidden="true" />;
}

export function SupportMessageTimeline({ messages }: { messages: readonly SupportMessage[] }) {
  return (
    <ol className="ct-message-timeline" aria-label="הודעות בשיחה" aria-live="polite">
      {messages.map((message) => {
        const unavailable = message.body.valueState !== "AVAILABLE";
        return (
          <li key={message.messageId} className={`ct-message ct-message-${message.direction.toLowerCase()}`}>
            <div className="ct-message-meta">
              <span><SenderIcon kind={message.senderKind} /> {senderLabel(message)}</span>
              <time dateTime={message.providerObservedAt}>{formatFixtureTime(message.providerObservedAt)}</time>
            </div>
            <div className={`ct-message-bubble ${unavailable ? "ct-message-redacted" : ""}`}>
              {unavailable ? valueStateLabels[message.body.valueState] : message.body.value}
            </div>
            {message.direction === "OUTBOUND" ? (
              <span className={`ct-delivery ct-delivery-${message.deliveryState.toLowerCase()}`}>
                <CheckCheck size={13} aria-hidden="true" /> {deliveryLabels[message.deliveryState]}
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
