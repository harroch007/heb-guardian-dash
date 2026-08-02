import { useState } from "react";
import { Activity, Ban, Check, RotateCcw, X } from "lucide-react";
import type { AllowedAction, SafeActionId } from "../domain/types";

export function AllowedActionsPanel({
  actions,
  busy,
  onAction,
}: {
  actions: readonly AllowedAction[];
  busy: boolean;
  onAction: (actionId: SafeActionId) => Promise<boolean>;
}) {
  const [confirming, setConfirming] = useState<SafeActionId | null>(null);
  const operational = actions.filter(
    (action) =>
      action.uiState !== "HIDDEN" &&
      action.actionId !== "ADD_INTERNAL_NOTE" &&
      action.actionId !== "SEND_PUBLIC_REPLY",
  );

  async function execute(actionId: SafeActionId) {
    const succeeded = await onAction(actionId);
    if (succeeded) setConfirming(null);
  }

  if (operational.length === 0) {
    return <p className="ct-muted-copy">אין פעולות תפעוליות זמינות להרשאה הנוכחית.</p>;
  }

  return (
    <div className="ct-actions-list">
      {operational.map((action) => {
        const enabled = action.uiState === "ENABLED";
        const isConfirming = confirming === action.actionId;
        return (
          <div className="ct-action-card" key={action.actionId} data-action-id={action.actionId}>
            <div>
              <span className="ct-action-icon" aria-hidden="true">
                {action.actionId === "REPORT_HEARTBEAT" ? <Activity size={17} /> : action.actionId === "REFRESH_SETTINGS" ? <RotateCcw size={17} /> : <Ban size={17} />}
              </span>
              <div>
                <strong>{action.label}</strong>
                <span>{action.risk} · {enabled ? "זמין לפי מדיניות" : "לא זמין כעת"}</span>
              </div>
            </div>
            {isConfirming ? (
              <div className="ct-action-confirm" role="group" aria-label={`אישור ${action.label}`}>
                <p>הפעולה תירשם בביקורת ותישלח רק לחוזה הפעולה המאושר.</p>
                <button type="button" className="ct-button ct-button-primary" disabled={busy} onClick={() => void execute(action.actionId)} data-testid={`confirm-${action.actionId}`}>
                  <Check size={15} aria-hidden="true" /> אישור
                </button>
                <button type="button" className="ct-button ct-button-quiet" disabled={busy} onClick={() => setConfirming(null)}>
                  <X size={15} aria-hidden="true" /> ביטול
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="ct-button ct-button-secondary"
                disabled={!enabled || busy}
                onClick={() => action.requiresConfirmation ? setConfirming(action.actionId) : void execute(action.actionId)}
                aria-describedby={action.reasonCodes.length > 0 ? `ct-action-reason-${action.actionId}` : undefined}
              >
                הפעלה
              </button>
            )}
            {action.reasonCodes.length > 0 ? <small id={`ct-action-reason-${action.actionId}`}>{action.reasonCodes.join(" · ")}</small> : null}
          </div>
        );
      })}
    </div>
  );
}
