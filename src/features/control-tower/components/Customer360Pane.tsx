import {
  Activity,
  ArrowRight,
  BatteryCharging,
  BellRing,
  Clock3,
  DatabaseZap,
  Link2,
  RefreshCcw,
  Settings2,
  ShieldCheck,
  Smartphone,
  UserRound,
} from "lucide-react";
import type {
  ConversationWorkspace,
  InstalledAppsSnapshotCompleteness,
  ParentalSyncState,
  SafeActionId,
} from "../domain/types";
import { AllowedActionsPanel } from "./AllowedActionsPanel";
import { CapabilityList } from "./CapabilityList";
import { DiagnosticSection } from "./DiagnosticSection";
import { FieldValue } from "./FieldValue";
import { OperationalTimeline } from "./OperationalTimeline";
import { formatFixtureTime, monitoringLabels } from "./presentation";

const parentalSyncLabels: Record<ParentalSyncState, string> = {
  IN_SYNC: "מסונכרן",
  DEVICE_BEHIND: "המכשיר טרם החיל את הגרסה הרצויה",
  DEVICE_AHEAD: "המכשיר מדווח על גרסה מתקדמת מהשרת",
  UNKNOWN: "לא ידוע",
};

const installedSnapshotCompletenessLabels: Record<InstalledAppsSnapshotCompleteness, string> = {
  COMPLETE: "מלא",
  PARTIAL: "חלקי",
  UNKNOWN: "לא ידוע",
};

export function Customer360Pane({
  workspace,
  loading,
  commandBusy,
  onBack,
  onAction,
}: {
  workspace: ConversationWorkspace | null;
  loading: boolean;
  commandBusy: boolean;
  onBack: () => void;
  onAction: (actionId: SafeActionId) => Promise<boolean>;
}) {
  if (loading) return <div className="ct-pane-state" role="status">טוענים תמונת לקוח…</div>;
  if (!workspace) {
    return (
      <div className="ct-empty-pane ct-empty-pane-compact">
        <UserRound size={28} aria-hidden="true" />
        <h2>Customer 360</h2>
        <p>בחירת פנייה מאומתת תציג כאן הקשר ונתוני אבחון.</p>
      </div>
    );
  }
  if (!workspace.customer360 || workspace.conversation.identityMatch !== "VERIFIED") {
    return (
      <div className="ct-customer-view">
        <header className="ct-customer-header">
          <button type="button" className="ct-icon-button ct-customer-back" onClick={onBack} aria-label="חזרה לשיחה"><ArrowRight size={20} aria-hidden="true" /></button>
          <div><p className="ct-eyebrow">Customer 360</p><h2>מידע לא זמין</h2></div>
        </header>
        <div className="ct-customer-blocked" role="status">
          <ShieldCheck size={25} aria-hidden="true" />
          <h3>{workspace.conversation.identityMatch === "AMBIGUOUS" ? "נדרש בירור זהות" : "אין רשומת לקוח מקושרת"}</h3>
          <p>
            {workspace.conversation.identityMatch === "AMBIGUOUS"
              ? "המידע נשאר חסום עד לבחירת התאמה ואימות Guardian."
              : "אפשר לטפל בשיחת pre-sales בלי ליצור Case ובלי לחשוף נתוני לקוח."}
          </p>
        </div>
      </div>
    );
  }

  const snapshot = workspace.customer360;
  const sourceUnavailable = snapshot.monitoring.state.valueState === "SOURCE_UNAVAILABLE";

  return (
    <div className="ct-customer-view" data-testid="customer-360">
      <header className="ct-customer-header">
        <button type="button" className="ct-icon-button ct-customer-back" onClick={onBack} aria-label="חזרה לשיחה"><ArrowRight size={20} aria-hidden="true" /></button>
        <div>
          <p className="ct-eyebrow">Customer 360</p>
          <h2>תמונת מצב מאומתת</h2>
          <span><Clock3 size={13} aria-hidden="true" /> צילום {formatFixtureTime(snapshot.snapshotAt)}</span>
        </div>
      </header>

      {sourceUnavailable ? (
        <div className="ct-source-alert" role="alert" data-testid="source-unavailable">
          <DatabaseZap size={18} aria-hidden="true" />
          <div><strong>מקור האבחון אינו זמין</strong><span>הערכים החסרים מסומנים במפורש; לא הושלמו נתונים בניחוש.</span></div>
        </div>
      ) : null}

      <div className="ct-customer-scroll">
        <DiagnosticSection title="משפחה וזכאות" summary="מידע מוסווה לפי הרשאה" icon={<UserRound size={17} />} defaultOpen>
          <dl className="ct-fields-grid">
            <FieldValue label="משפחה" field={snapshot.familyLabel} />
            <FieldValue label="ילד/ה" field={snapshot.childLabel} />
            <FieldValue label="זכאות" field={snapshot.entitlement} />
          </dl>
        </DiagnosticSection>

        <DiagnosticSection title="התקנה וצימוד" summary="מסלול V2" icon={<Link2 size={17} />}>
          <dl className="ct-fields-grid">
            <FieldValue label="מצב התקנה" field={snapshot.installation.status} />
            <FieldValue label="שלב הקמה" field={snapshot.installation.setupStep} />
            <FieldValue label="מועד צימוד" field={snapshot.installation.pairedAt} />
            <FieldValue label="בקשות OTP" field={snapshot.installation.otpRequestCount} />
          </dl>
        </DiagnosticSection>

        <DiagnosticSection title="מכשיר מוגן" summary="מצב טכני" icon={<Smartphone size={17} />} defaultOpen>
          <dl className="ct-fields-grid">
            <FieldValue label="יצרן" field={snapshot.device.manufacturer} />
            <FieldValue label="דגם" field={snapshot.device.model} />
            <FieldValue label="Android" field={snapshot.device.androidVersion} />
            <FieldValue label="גרסת אפליקציה" field={snapshot.device.appVersion} />
            <FieldValue label="Build" field={snapshot.device.build} />
            <FieldValue label="נראה לאחרונה" field={snapshot.device.lastSeenAt} />
            <FieldValue label="סוללה" field={snapshot.device.batteryPercent} suffix="%" />
            <FieldValue label="חוזה Capture" field={snapshot.device.captureContractVersion} />
          </dl>
        </DiagnosticSection>

        <DiagnosticSection
          title="ניטור"
          summary={snapshot.monitoring.state.value ? monitoringLabels[snapshot.monitoring.state.value] : "מצב לא זמין"}
          icon={<Activity size={17} />}
          defaultOpen
        >
          <dl className="ct-fields-grid">
            <FieldValue label="מצב" field={snapshot.monitoring.state} format={(value) => monitoringLabels[value]} />
            <FieldValue label="תקין לאחרונה" field={snapshot.monitoring.lastHealthyAt} />
            <FieldValue label="סף איחור" field={snapshot.monitoring.lateAfterAt} />
            <FieldValue label="סף ניתוק" field={snapshot.monitoring.interruptedAfterAt} />
          </dl>
          {snapshot.monitoring.reasonCodes.length > 0 ? <p className="ct-reason-codes">{snapshot.monitoring.reasonCodes.join(" · ")}</p> : null}
        </DiagnosticSection>

        <DiagnosticSection title="יכולות והרשאות מכשיר" summary="השפעה ודרך תיקון" icon={<BatteryCharging size={17} />}>
          <CapabilityList capabilities={snapshot.capabilities} />
        </DiagnosticSection>

        <DiagnosticSection title="סנכרון בקרת הורים" summary="רצוי מול מיושם" icon={<Settings2 size={17} />}>
          <dl className="ct-fields-grid" data-testid="parental-sync">
            <FieldValue label="גרסה רצויה" field={snapshot.parentalSync.desiredRevision} />
            <FieldValue label="גרסה שיושמה" field={snapshot.parentalSync.appliedRevision} />
            <FieldValue
              label="מצב סנכרון"
              field={snapshot.parentalSync.syncState}
              format={(value) => parentalSyncLabels[value]}
            />
            <FieldValue label="פער גרסאות" field={snapshot.parentalSync.revisionDelta} />
            <FieldValue label="משך הפער" field={snapshot.parentalSync.driftDurationSeconds} suffix="שניות" />
            <FieldValue label="דוח מצב נצפה" field={snapshot.parentalSync.stateReport.observedAt} />
            <FieldValue label="מועד צילום מלאי" field={snapshot.parentalSync.installedAppsSnapshot.observedAt} />
            <FieldValue
              label="שלמות צילום המלאי"
              field={snapshot.parentalSync.installedAppsSnapshot.completeness}
              format={(value) => installedSnapshotCompletenessLabels[value]}
            />
          </dl>
        </DiagnosticSection>

        <DiagnosticSection title="Push" summary="בריאות מסירה" icon={<BellRing size={17} />}>
          <dl className="ct-fields-grid">
            <FieldValue label="רישום Push" field={snapshot.push.registrationHealth} />
            <FieldValue label="מסירה אחרונה" field={snapshot.push.lastDeliveryAt} />
            <FieldValue label="כשל אחרון" field={snapshot.push.lastFailureCode} />
          </dl>
        </DiagnosticSection>

        <DiagnosticSection title="פעולות מותרות" summary="לפי אימות, תפקיד ומדיניות" icon={<RefreshCcw size={17} />} defaultOpen>
          <AllowedActionsPanel actions={workspace.allowedActions} busy={commandBusy} onAction={onAction} />
        </DiagnosticSection>

        <DiagnosticSection title="ציר זמן תפעולי" summary={`${workspace.timeline.length} אירועים`} icon={<Activity size={17} />}>
          <OperationalTimeline events={workspace.timeline} />
        </DiagnosticSection>
      </div>
    </div>
  );
}
