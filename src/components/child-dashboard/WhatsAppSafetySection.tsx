import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Loader2,
  MessageCircle,
  RefreshCw,
  XCircle,
} from "lucide-react";
import {
  activeProtectionCount,
  monitoringStateCopy,
  toneClasses,
} from "@/components/monitoring-v2/monitoringPresentation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { GuardianMonitoringDevice } from "@/lib/v2/guardianMonitoringService";

interface WhatsAppSafetySectionProps {
  device: GuardianMonitoringDevice | null;
  newIncidentCount: number;
  todayIncidentCount: number;
  loading: boolean;
  error: boolean;
  onRefresh: () => void;
  onOpenAlerts: () => void;
}

const permissionRows = (device: GuardianMonitoringDevice) => [
  {
    label: "גישה למסך WhatsApp",
    active: device.accessibilityEnabled,
  },
  {
    label: "גישה להתראות",
    active: device.notificationListenerEnabled,
  },
  {
    label: "התראות Kippy פעילות",
    active: device.appNotificationsAllowed,
  },
  {
    label: "פעילות רציפה בסוללה",
    active: device.batteryOptimizationExempt,
  },
];

export function WhatsAppSafetySection({
  device,
  newIncidentCount,
  todayIncidentCount,
  loading,
  error,
  onRefresh,
  onOpenAlerts,
}: WhatsAppSafetySectionProps) {
  if (loading) {
    return (
      <Card id="whatsapp-safety" className="border-border bg-card shadow-sm">
        <CardContent
          className="flex min-h-32 items-center justify-center p-4"
          role="status"
          aria-label="טוען את מצב ניטור WhatsApp"
        >
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card
        id="whatsapp-safety"
        className="border-warning/30 bg-warning/5 shadow-sm"
      >
        <CardContent className="flex items-start gap-3 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">
              לא הצלחנו לעדכן את מצב ניטור WhatsApp
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              בקרות ההורים עדיין זמינות. אפשר לנסות לרענן את מצב הניטור.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 shrink-0"
            onClick={onRefresh}
          >
            <RefreshCw className="ml-1 h-4 w-4" />
            רענון
          </Button>
        </CardContent>
      </Card>
    );
  }

  const presentation = device
    ? monitoringStateCopy(device.monitoringState)
    : {
        label: "טרם חובר מכשיר",
        description: "חברו את מכשיר הילד כדי להפעיל את ניטור WhatsApp.",
        tone: "muted" as const,
      };
  const requirements = device ? permissionRows(device) : [];

  return (
    <Card
      id="whatsapp-safety"
      className="scroll-mt-20 border-border bg-card shadow-sm"
    >
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <MessageCircle className="h-5 w-5 text-primary" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                בטיחות ב־WhatsApp
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {presentation.description}
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={`shrink-0 ${toneClasses[presentation.tone]}`}
          >
            {presentation.label}
          </Badge>
        </div>

        {device && (
          <div className="grid grid-cols-2 gap-2">
            {requirements.map((requirement) => (
              <div
                key={requirement.label}
                className="flex min-h-11 items-center gap-2 rounded-lg border border-border/70 bg-background/40 px-2.5 py-2"
              >
                {requirement.active ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                )}
                <span className="text-[11px] leading-4 text-foreground">
                  {requirement.label}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-muted/35 px-2 py-2.5">
            <p className="text-base font-bold text-foreground">
              {device ? `${activeProtectionCount(device)}/4` : "0/4"}
            </p>
            <p className="text-[10px] text-muted-foreground">רכיבי ניטור</p>
          </div>
          <div className="rounded-lg bg-muted/35 px-2 py-2.5">
            <p className="text-base font-bold text-foreground">
              {newIncidentCount}
            </p>
            <p className="text-[10px] text-muted-foreground">התראות חדשות</p>
          </div>
          <div className="rounded-lg bg-muted/35 px-2 py-2.5">
            <p className="text-base font-bold text-foreground">
              {todayIncidentCount}
            </p>
            <p className="text-[10px] text-muted-foreground">היום</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            מוצגות להורה רק התראות בטיחות שאומתו — ללא שיחות או הודעות גולמיות.
          </p>
          <Button
            type="button"
            variant={newIncidentCount > 0 ? "default" : "outline"}
            size="sm"
            className="h-10 shrink-0"
            onClick={onOpenAlerts}
          >
            <Bell className="ml-1 h-4 w-4" />
            התראות
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
