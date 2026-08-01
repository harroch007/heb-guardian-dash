import {
  AlertTriangle,
  ArrowRight,
  Battery,
  Bell,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BottomNavigationV2 } from "@/components/BottomNavigationV2";
import { ReconnectChildV2Modal } from "@/components/ReconnectChildV2Modal";
import { TopNavigationV2 } from "@/components/TopNavigationV2";
import {
  activeProtectionCount,
  monitoringStateCopy,
  relativeReportTime,
  toneClasses,
} from "@/components/monitoring-v2/monitoringPresentation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useV2GuardianMonitoring } from "@/hooks/useV2GuardianMonitoring";

export default function GuardianChildV2() {
  const { childId } = useParams();
  const navigate = useNavigate();
  const { children, loading, error, refresh } = useV2GuardianMonitoring();
  const [showReconnectModal, setShowReconnectModal] = useState(false);
  const child = children.find((candidate) => candidate.id === childId);

  if (loading) {
    return (
      <div
        className="v2-dark flex min-h-screen items-center justify-center"
        dir="rtl"
        role="status"
        aria-label="טוען את פרטי הניטור"
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !child) {
    return (
      <div className="v2-dark min-h-screen" dir="rtl">
        <TopNavigationV2 />
        <main className="mx-auto max-w-lg px-4 py-10">
          <Card className="border-warning/30 bg-card">
            <CardContent className="space-y-4 py-10 text-center">
              <AlertTriangle className="mx-auto h-9 w-9 text-warning" />
              <h1 className="font-semibold text-foreground">
                לא הצלחנו להציג את פרטי הניטור
              </h1>
              <div className="flex justify-center gap-2">
                <Button variant="outline" onClick={() => navigate("/home-v2")}>
                  חזרה למרכז ההגנה
                </Button>
                {error && (
                  <Button onClick={() => void refresh()}>
                    <RefreshCw className="ml-2 h-4 w-4" />
                    ניסיון נוסף
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const device = child.device;
  const presentation = device
    ? monitoringStateCopy(device.monitoringState)
    : {
        label: "טרם חובר מכשיר",
        description: "חברו את מכשיר הילד כדי להתחיל בניטור.",
        tone: "muted" as const,
      };
  const requirements = [
    {
      label: "גישה למסך WhatsApp",
      description: "מאפשרת לזהות את ההודעות שהילד רואה.",
      active: device?.accessibilityEnabled ?? false,
    },
    {
      label: "גישה להתראות",
      description: "משמשת כערוץ גיבוי והשלמת הקשר.",
      active: device?.notificationListenerEnabled ?? false,
    },
    {
      label: "התראה קבועה של Kippy",
      description: "מאשרת שמערכת ההפעלה מאפשרת פעילות שקופה ברקע.",
      active: device?.appNotificationsAllowed ?? false,
    },
    {
      label: "פעילות רציפה בסוללה",
      description: "מונעת מ־Android לעצור את הניטור כדי לחסוך בסוללה.",
      active: device?.batteryOptimizationExempt ?? false,
    },
  ];

  return (
    <div className="v2-dark min-h-screen pb-24" dir="rtl">
      <TopNavigationV2 />
      <main className="mx-auto max-w-lg space-y-5 px-4 py-6">
        <Button
          type="button"
          variant="ghost"
          className="h-11 px-2"
          onClick={() => navigate(-1)}
        >
          <ArrowRight className="ml-2 h-4 w-4" />
          חזרה
        </Button>

        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-primary">פרטי הניטור</p>
            <h1 className="mt-1 text-2xl font-bold text-foreground">
              {child.displayName}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge
              variant="outline"
              className={toneClasses[presentation.tone]}
            >
              {presentation.label}
            </Badge>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-11 w-11"
              title="צור קישור חיבור חדש"
              aria-label={`צור קישור חיבור חדש עבור ${child.displayName}`}
              onClick={() => setShowReconnectModal(true)}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Card className={`border ${toneClasses[presentation.tone]}`}>
          <CardContent className="flex items-start gap-3 p-5">
            {device?.monitoringState === "healthy" ? (
              <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0" />
            ) : (
              <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0" />
            )}
            <div>
              <p className="font-semibold">{presentation.label}</p>
              <p className="mt-1 text-sm leading-relaxed opacity-90">
                {presentation.description}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">מצב המכשיר</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Metric
              icon={<ShieldCheck className="h-4 w-4 text-primary" />}
              label="רכיבי הגנה"
              value={`${device ? activeProtectionCount(device) : 0}/4`}
            />
            <Metric
              icon={<Battery className="h-4 w-4 text-primary" />}
              label="סוללה"
              value={
                device?.batteryLevel != null ? `${device.batteryLevel}%` : "—"
              }
            />
            <Metric
              icon={<RefreshCw className="h-4 w-4 text-primary" />}
              label="דיווח אחרון"
              value={relativeReportTime(device?.lastSeenAt ?? null)}
            />
            <Metric
              icon={<Bell className="h-4 w-4 text-primary" />}
              label="התראות חדשות"
              value={String(child.newIncidentCount)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">הרשאות הניטור</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {requirements.map((requirement) => (
              <div
                key={requirement.label}
                className="flex items-start gap-3 rounded-xl border border-border/70 p-3"
              >
                {requirement.active ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                ) : (
                  <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {requirement.label}
                    </p>
                    <span
                      className={`text-xs font-semibold ${
                        requirement.active ? "text-success" : "text-destructive"
                      }`}
                    >
                      {requirement.active ? "פעילה" : "חסרה"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {requirement.description}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {device && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">פרטי התקנה</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">מכשיר</span>
                <span className="text-left font-medium text-foreground" dir="ltr">
                  {[device.manufacturer, device.model].filter(Boolean).join(" ") || "Android"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">גרסת Kippy</span>
                <span className="font-medium text-foreground" dir="ltr">
                  {device.appVersion}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {!device && (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center">
              <Smartphone className="mx-auto mb-3 h-9 w-9 text-muted-foreground/50" />
              <p className="font-medium text-foreground">
                מכשיר הילד עדיין לא חובר
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                חזרו למסך המשפחה כדי ליצור קוד QR להתקנה.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-4 h-11"
                onClick={() => setShowReconnectModal(true)}
              >
                חיבור מכשיר
              </Button>
            </CardContent>
          </Card>
        )}

        {child.newIncidentCount > 0 && (
          <Button
            type="button"
            className="h-12 w-full"
            onClick={() => navigate("/alerts-v2")}
          >
            <Bell className="ml-2 h-4 w-4" />
            צפייה בהתראות שאומתו
          </Button>
        )}
      </main>
      <ReconnectChildV2Modal
        childId={showReconnectModal ? child.id : null}
        childName={child.displayName}
        onClose={() => setShowReconnectModal(false)}
        onConnected={() => void refresh()}
      />
      <BottomNavigationV2 />
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/25 p-3">
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}
