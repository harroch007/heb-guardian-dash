import { AlertTriangle, ShieldCheck, Smartphone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { GuardianMonitoringChild } from "@/lib/v2/guardianMonitoringService";

interface Props {
  children: GuardianMonitoringChild[];
}

export function MonitoringSummaryCard({ children }: Props) {
  const activeCount = children.filter(
    (child) => child.device?.monitoringState === "healthy",
  ).length;
  const newIncidentCount = children.reduce(
    (total, child) => total + child.newIncidentCount,
    0,
  );
  const allActive = children.length > 0 && activeCount === children.length;

  return (
    <Card className="border-primary/25 bg-gradient-to-bl from-primary/10 via-card to-card">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
            {allActive ? (
              <ShieldCheck className="h-6 w-6 text-success" />
            ) : (
              <AlertTriangle className="h-6 w-6 text-warning" />
            )}
          </span>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {children.length === 0
                ? "עדיין אין מכשיר מנוטר"
                : allActive
                  ? "הניטור פעיל"
                  : "יש מכשיר שדורש בדיקה"}
            </h1>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {children.length === 0
                ? "הוסיפו ילד וחברו את מכשיר ה־Android כדי להתחיל."
                : `${activeCount} מתוך ${children.length} מכשירים מדווחים באופן תקין.`}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border/70 bg-background/60 p-3 text-center">
            <Smartphone className="mx-auto mb-1 h-4 w-4 text-primary" />
            <p className="text-lg font-bold text-foreground">
              {activeCount}/{children.length}
            </p>
            <p className="text-xs text-muted-foreground">מכשירים פעילים</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-background/60 p-3 text-center">
            <AlertTriangle
              className={`mx-auto mb-1 h-4 w-4 ${
                newIncidentCount > 0 ? "text-warning" : "text-muted-foreground"
              }`}
            />
            <p className="text-lg font-bold text-foreground">
              {newIncidentCount}
            </p>
            <p className="text-xs text-muted-foreground">התראות חדשות</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
