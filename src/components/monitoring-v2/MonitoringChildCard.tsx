import { AlertTriangle, Battery, Bell, ChevronLeft, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { GuardianMonitoringChild } from "@/lib/v2/guardianMonitoringService";
import {
  activeProtectionCount,
  monitoringStateCopy,
  relativeReportTime,
  toneClasses,
} from "./monitoringPresentation";

interface Props {
  child: GuardianMonitoringChild;
}

export function MonitoringChildCard({ child }: Props) {
  const navigate = useNavigate();
  const device = child.device;
  const presentation = device
    ? monitoringStateCopy(device.monitoringState)
    : {
        label: "טרם חובר מכשיר",
        description: "חברו את מכשיר הילד כדי להתחיל בניטור.",
        tone: "muted" as const,
      };

  return (
    <Card className="border-border bg-card">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
              {child.displayName.charAt(0)}
            </span>
            <div className="min-w-0">
              <h2 className="truncate font-semibold text-foreground">
                {child.displayName}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                דיווח אחרון: {relativeReportTime(device?.lastSeenAt ?? null)}
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

        <div className="flex items-start gap-2 rounded-xl border border-border/70 bg-muted/25 p-3">
          {device?.monitoringState === "healthy" ? (
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" />
          ) : (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          )}
          <p className="text-sm leading-relaxed text-muted-foreground">
            {presentation.description}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-muted/35 px-2 py-2.5">
            <ShieldCheck className="mx-auto mb-1 h-4 w-4 text-primary" />
            <p className="text-sm font-bold text-foreground">
              {device ? activeProtectionCount(device) : 0}/4
            </p>
            <p className="text-[11px] text-muted-foreground">רכיבי הגנה</p>
          </div>
          <div className="rounded-lg bg-muted/35 px-2 py-2.5">
            <Battery className="mx-auto mb-1 h-4 w-4 text-primary" />
            <p className="text-sm font-bold text-foreground">
              {device?.batteryLevel != null ? `${device.batteryLevel}%` : "—"}
            </p>
            <p className="text-[11px] text-muted-foreground">סוללה</p>
          </div>
          <div className="rounded-lg bg-muted/35 px-2 py-2.5">
            <Bell className="mx-auto mb-1 h-4 w-4 text-primary" />
            <p className="text-sm font-bold text-foreground">
              {child.newIncidentCount}
            </p>
            <p className="text-[11px] text-muted-foreground">חדשות</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1 justify-between"
            onClick={() => navigate(`/child-v2/${child.id}`)}
          >
            <span>פרטי הניטור</span>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {child.newIncidentCount > 0 && (
            <Button
              type="button"
              className="h-11 flex-1"
              onClick={() => navigate("/alerts-v2")}
            >
              צפייה בהתראות
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
