import { AlertTriangle, BadgeCheck, ShieldQuestion } from "lucide-react";
import type { ConversationListItem } from "../domain/types";
import { verificationLabels } from "./presentation";

export function VerificationBanner({ conversation }: { conversation: ConversationListItem }) {
  const ambiguous = conversation.identityMatch === "AMBIGUOUS";
  const verified = conversation.identityMatch === "VERIFIED";
  const Icon = ambiguous ? AlertTriangle : verified ? BadgeCheck : ShieldQuestion;

  return (
    <div className={`ct-verification ct-verification-${ambiguous ? "warning" : verified ? "verified" : "neutral"}`} role={ambiguous ? "alert" : "status"}>
      <Icon size={18} aria-hidden="true" />
      <div>
        <strong>{verificationLabels[conversation.verificationLevel]}</strong>
        <span>
          {ambiguous
            ? "נמצאו כמה התאמות אפשריות. Customer 360 ופעולות בחשבון חסומים עד לאימות."
            : verified
              ? "הזהות והקשר המשפחתי אומתו לשיחה הזו."
              : "יש להימנע מחשיפת מידע חשבוני עד להשלמת אימות."}
        </span>
      </div>
    </div>
  );
}
