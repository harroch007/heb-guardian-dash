import { useState } from "react";
import { adminSupabase } from "@/integrations/supabase/admin-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Brain, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface OverviewStats {
  totalParents: number;
  totalWaitlist: number;
  totalDevices: number;
  totalAlertsToday: number;
  criticalAlertsToday: number;
  activeUsersToday: number;
  conversionRate: number;
  activeChildrenToday: number;
  activeParentsThisWeek: number;
  messagesScannedToday: number;
  alertsSentToday: number;
  feedbackEngagementRate: number;
  totalAlertsLast7Days: number;
  alertsWithFeedbackLast7Days: number;
  alertsCreatedToday: number;
  alertsAnalyzedToday: number;
  alertsNotifiedToday: number;
  systemAlertsToday: number;
  queuePending: number;
  queueFailed: number;
  oldestPendingMinutes: number;
  funnel: { stage: string; count: number }[];
  alertsTrend: { date: string; safe: number; review: number; notify: number; notified: number }[];
  alertsByVerdict: { name: string; value: number; color: string }[];
  feedbackTrend: { date: string; total: number; important: number; not_relevant: number }[];
}

interface UserData {
  id: string;
  full_name: string;
  email: string | null;
  device_status: 'online' | 'today' | 'offline' | 'no_device';
  children: { id: string; name: string }[];
  devices: { device_id: string }[];
}

interface WaitlistEntry {
  id: string;
  status: string | null;
  device_os: string;
  region: string | null;
}

interface AdminAIAnalystProps {
  overviewStats: OverviewStats | null;
  users: UserData[];
  waitlist: WaitlistEntry[];
}

export function AdminAIAnalyst({ overviewStats, users, waitlist }: AdminAIAnalystProps) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const runAnalysis = async () => {
    if (!overviewStats) {
      toast.error("הנתונים עדיין נטענים, נסה שוב");
      return;
    }

    setLoading(true);
    try {
      // Build metrics object for AI
      const usersWithoutDevice = users.filter(u => u.device_status === "no_device").length;
      const usersOnline = users.filter(u => u.device_status === "online").length;
      const usersOffline = users.filter(u => u.device_status === "offline").length;

      const waitlistApproved = waitlist.filter(w => w.status === "approved").length;
      const waitlistPending = waitlist.filter(w => w.status === "pending" || !w.status).length;

      const osByType: Record<string, number> = {};
      waitlist.forEach(w => {
        osByType[w.device_os] = (osByType[w.device_os] || 0) + 1;
      });

      const metrics = {
        summary: {
          totalParents: overviewStats.totalParents,
          totalWaitlist: overviewStats.totalWaitlist,
          totalDevices: overviewStats.totalDevices,
          conversionRate: `${overviewStats.conversionRate.toFixed(1)}%`,
        },
        funnel: overviewStats.funnel,
        activity: {
          activeChildrenToday: overviewStats.activeChildrenToday,
          activeParentsThisWeek: overviewStats.activeParentsThisWeek,
          activeDevicesToday: overviewStats.activeUsersToday,
          messagesScannedToday: overviewStats.messagesScannedToday,
        },
        alerts: {
          totalToday: overviewStats.totalAlertsToday,
          createdToday: overviewStats.alertsCreatedToday,
          analyzedByAI: overviewStats.alertsAnalyzedToday,
          sentToParents: overviewStats.alertsNotifiedToday,
          systemAlerts: overviewStats.systemAlertsToday,
          criticalToday: overviewStats.criticalAlertsToday,
          byVerdict: overviewStats.alertsByVerdict,
          trend14Days: overviewStats.alertsTrend,
        },
        engagement: {
          feedbackEngagementRate: `${overviewStats.feedbackEngagementRate.toFixed(1)}%`,
          totalAlertsLast7Days: overviewStats.totalAlertsLast7Days,
          alertsWithFeedback: overviewStats.alertsWithFeedbackLast7Days,
          feedbackTrend: overviewStats.feedbackTrend,
        },
        queueHealth: {
          pending: overviewStats.queuePending,
          failed: overviewStats.queueFailed,
          oldestPendingMinutes: overviewStats.oldestPendingMinutes,
        },
        users: {
          total: users.length,
          withoutDevice: usersWithoutDevice,
          online: usersOnline,
          offline: usersOffline,
        },
        waitlist: {
          total: waitlist.length,
          approved: waitlistApproved,
          pending: waitlistPending,
          byOS: osByType,
        },
      };

      const { data, error } = await adminSupabase.functions.invoke("admin-ai-analyst", {
        body: { metrics },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setAnalysis(data.analysis);
      toast.success("הניתוח הושלם");
    } catch (err: any) {
      console.error("Analysis error:", err);
      toast.error(err.message || "שגיאה בניתוח הנתונים");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            אנליסט AI
          </h2>
          <p className="text-sm text-muted-foreground">
            ניתוח אוטומטי של כל הנתונים במערכת עם תובנות עסקיות
          </p>
        </div>
        <Button
          onClick={runAnalysis}
          disabled={loading || !overviewStats}
          className="gap-2"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              מנתח...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              נתח את הנתונים
            </>
          )}
        </Button>
      </div>

      {/* Results */}
      {!analysis && !loading && (
        <Card className="border-dashed border-2 border-muted-foreground/20">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Brain className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              מוכן לניתוח
            </h3>
            <p className="text-sm text-muted-foreground/70 max-w-md">
              לחץ על "נתח את הנתונים" כדי לקבל תובנות עסקיות מבוססות על כל הנתונים במערכת.
              הניתוח כולל: Funnel, התראות, מעורבות משתמשים, בריאות תור, ועוד.
            </p>
          </CardContent>
        </Card>
      )}

      {loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">מנתח את כל הנתונים...</p>
            <p className="text-xs text-muted-foreground/60 mt-1">זה עשוי לקחת מספר שניות</p>
          </CardContent>
        </Card>
      )}

      {analysis && !loading && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              תוצאות הניתוח
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap leading-relaxed">
              {analysis}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
