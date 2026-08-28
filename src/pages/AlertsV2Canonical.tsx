import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArchiveRestore,
  Bookmark,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getV2GuardianAlerts,
  setV2GuardianIncidentState,
  type V2GuardianAlert,
  type V2GuardianIncidentState,
} from "@/lib/v2/guardianAlertsService";
import { BottomNavigationV2 } from "@/components/BottomNavigationV2";
import { TopNavigationV2 } from "@/components/TopNavigationV2";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

const categoryLabels: Record<string, string> = {
  bullying: "בריונות",
  exclusion: "חרם והדרה",
  sexual_content: "תוכן מיני",
  violence: "אלימות ואיומים",
  grooming: "גרומינג",
  manipulation: "מניפולציה",
  stranger_contact: "פנייה מזר",
  self_harm: "פגיעה עצמית",
  other: "בטיחות אחרת",
};

const roleLabels: Record<string, string> = {
  target: "הילד/ה יעד לפגיעה",
  participant: "הילד/ה משתתף/ת",
  initiator: "הילד/ה יזם/ה",
  unknown: "תפקיד הילד/ה עדיין לא ודאי",
};

const severityClasses: Record<string, string> = {
  critical: "border-red-500/40 bg-red-500/10 text-red-400",
  high: "border-orange-500/40 bg-orange-500/10 text-orange-400",
  medium: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  low: "border-blue-500/40 bg-blue-500/10 text-blue-400",
};

const tabLabels: Array<{ state: V2GuardianIncidentState; label: string }> = [
  { state: "new", label: "חדשות" },
  { state: "saved", label: "שמורות" },
  { state: "acknowledged", label: "טופלו" },
];

const confidenceCopy = (confidence: number) => {
  if (confidence >= 0.85) return "ודאות גבוהה";
  if (confidence >= 0.65) return "ודאות בינונית";
  return "נדרשת זהירות בפרשנות";
};

const evidenceSenderLabels: Record<string, string> = {
  child: "הילד/ה",
  peer: "משתתף/ת בשיחה",
  unknown: "שולח לא מזוהה",
};

const activeEvidence = (alert: V2GuardianAlert, nowMs: number) =>
  alert.evidence.filter((message) => Date.parse(message.expiresAt) > nowMs);

export default function AlertsV2Canonical() {
  const { familyId } = useAuth();
  const [children, setChildren] = useState<
    Array<{ id: string; displayName: string }>
  >([]);
  const [alerts, setAlerts] = useState<V2GuardianAlert[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<V2GuardianIncidentState>("new");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [evidenceNowMs, setEvidenceNowMs] = useState(Date.now());

  const load = useCallback(async () => {
    if (!familyId) {
      setChildren([]);
      setAlerts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await getV2GuardianAlerts({
        familyId,
        childId: selectedChildId,
      });
      setChildren(result.children);
      setAlerts(result.alerts);
      setEvidenceNowMs(Date.now());
    } catch (error) {
      console.error("[alerts-v2] Failed to load confirmed incidents", error);
      toast.error("לא ניתן לטעון את ההתראות כרגע");
    } finally {
      setLoading(false);
    }
  }, [familyId, selectedChildId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const nextExpiryMs = alerts
      .flatMap((alert) => alert.evidence)
      .map((message) => Date.parse(message.expiresAt))
      .filter((expiresAtMs) => Number.isFinite(expiresAtMs) && expiresAtMs > evidenceNowMs)
      .sort((left, right) => left - right)[0];
    if (nextExpiryMs === undefined) return;
    const timer = window.setTimeout(
      () => setEvidenceNowMs(Date.now()),
      Math.min(Math.max(nextExpiryMs - Date.now() + 25, 0), 2_147_483_647),
    );
    return () => window.clearTimeout(timer);
  }, [alerts, evidenceNowMs]);

  useEffect(() => {
    const refreshExpiryBoundary = () => {
      if (document.visibilityState === "visible") setEvidenceNowMs(Date.now());
    };
    document.addEventListener("visibilitychange", refreshExpiryBoundary);
    return () =>
      document.removeEventListener("visibilitychange", refreshExpiryBoundary);
  }, []);

  const counts = useMemo(
    () => ({
      new: alerts.filter((alert) => alert.state === "new").length,
      saved: alerts.filter((alert) => alert.state === "saved").length,
      acknowledged: alerts.filter((alert) => alert.state === "acknowledged").length,
    }),
    [alerts],
  );
  const visibleAlerts = alerts.filter((alert) => alert.state === activeTab);

  const updateState = async (
    alert: V2GuardianAlert,
    state: V2GuardianIncidentState,
  ) => {
    setUpdatingId(alert.id);
    try {
      await setV2GuardianIncidentState(alert.id, state);
      setAlerts((current) =>
        current.map((item) =>
          item.id === alert.id ? { ...item, state } : item,
        ),
      );
      toast.success(
        state === "saved"
          ? "ההתראה נשמרה"
          : state === "acknowledged"
            ? "ההתראה סומנה כטופלה"
            : "ההתראה הוחזרה לחדשות",
      );
    } catch (error) {
      console.error("[alerts-v2] Failed to update incident state", error);
      toast.error("לא ניתן לעדכן את ההתראה כרגע");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="v2-dark min-h-screen bg-background pb-24" dir="rtl">
      <TopNavigationV2 />
      <main className="mx-auto max-w-2xl space-y-5 px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">התראות בטיחות</h1>
            <p className="text-sm text-muted-foreground">
              רק אירועים שאומתו לאחר ניתוח ההקשר המלא
            </p>
          </div>
          <Button variant="outline" size="icon" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {children.length > 1 && (
          <select
            value={selectedChildId ?? ""}
            onChange={(event) => setSelectedChildId(event.target.value || null)}
            className="w-full rounded-xl border border-border/50 bg-card p-3 text-sm text-foreground"
          >
            <option value="">כל הילדים</option>
            {children.map((child) => (
              <option key={child.id} value={child.id}>
                {child.displayName}
              </option>
            ))}
          </select>
        )}

        <div className="grid grid-cols-3 gap-2">
          {tabLabels.map((tab) => (
            <button
              type="button"
              key={tab.state}
              onClick={() => setActiveTab(tab.state)}
              className={`rounded-xl border p-3 text-center transition-colors ${
                activeTab === tab.state
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border/50 bg-card text-muted-foreground"
              }`}
            >
              <p className="text-xl font-bold">{counts[tab.state]}</p>
              <p className="text-xs">{tab.label}</p>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        ) : visibleAlerts.length === 0 ? (
          <Card className="border-dashed border-border bg-card">
            <CardContent className="py-14 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-success" />
              <p className="font-semibold text-foreground">
                {activeTab === "new"
                  ? "אין התראות חדשות"
                  : activeTab === "saved"
                    ? "לא נשמרו התראות"
                    : "אין התראות שסומנו כטופלו"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Kippy מציג כאן רק אירועים שאומתו ודורשים תשומת לב הורית.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {visibleAlerts.map((alert) => (
              <Card key={alert.id} className="border-border bg-card">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                        <ShieldAlert className="h-5 w-5 text-destructive" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground">
                          {categoryLabels[alert.category] ?? "אירוע בטיחות"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {alert.childName} · {alert.sourcePlatform === "whatsapp" ? "WhatsApp" : alert.sourcePlatform}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={severityClasses[alert.severity] ?? severityClasses.medium}
                    >
                      {confidenceCopy(alert.confidence)}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium leading-relaxed text-foreground">
                      {alert.summary}
                    </p>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {alert.reason}
                    </p>
                  </div>

                  {activeEvidence(alert, evidenceNowMs).length > 0 && (
                    <section
                      aria-label="הודעות רלוונטיות לאירוע"
                      className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3"
                    >
                      <p className="text-xs font-semibold text-foreground">
                        הודעות רלוונטיות
                      </p>
                      {activeEvidence(alert, evidenceNowMs).map((message) => (
                        <blockquote
                          key={message.segmentRef}
                          className="rounded-lg border border-border/50 bg-card p-3"
                        >
                          <p className="mb-1 text-xs font-semibold text-muted-foreground">
                            {evidenceSenderLabels[message.senderRole] ??
                              evidenceSenderLabels.unknown}
                          </p>
                          <p
                            className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground"
                            dir="auto"
                          >
                            {message.text}
                          </p>
                        </blockquote>
                      ))}
                    </section>
                  )}

                  {alert.evidenceStatus === "unavailable" && (
                    <p
                      role="status"
                      className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-foreground"
                    >
                      תוכן ההודעה אינו זמין כרגע. אפשר לנסות לרענן בעוד רגע.
                    </p>
                  )}

                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                    <p className="mb-1 text-xs font-semibold text-primary">מה מומלץ לעשות</p>
                    <p className="text-sm leading-relaxed text-foreground">
                      {alert.recommendedAction}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{roleLabels[alert.childRole] ?? roleLabels.unknown}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Clock3 className="h-3 w-3" />
                      {new Intl.DateTimeFormat("he-IL", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(alert.occurredAt))}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    {activeTab === "new" && (
                      <Button
                        variant="outline"
                        className="flex-1"
                        disabled={updatingId === alert.id}
                        onClick={() => void updateState(alert, "saved")}
                      >
                        <Bookmark className="ml-1 h-4 w-4" />
                        שמור
                      </Button>
                    )}
                    {activeTab !== "acknowledged" ? (
                      <Button
                        className="flex-1"
                        disabled={updatingId === alert.id}
                        onClick={() => void updateState(alert, "acknowledged")}
                      >
                        {updatingId === alert.id ? (
                          <Loader2 className="ml-1 h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="ml-1 h-4 w-4" />
                        )}
                        סמן כטופל
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="flex-1"
                        disabled={updatingId === alert.id}
                        onClick={() => void updateState(alert, "new")}
                      >
                        <ArchiveRestore className="ml-1 h-4 w-4" />
                        החזר לחדשות
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <BottomNavigationV2 />
    </div>
  );
}
