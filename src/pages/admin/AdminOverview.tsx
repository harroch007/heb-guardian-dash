import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, MessageSquare, Bell, Star, TrendingUp, AlertTriangle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface OverviewStats {
  totalParents: number;
  totalWaitlist: number;
  totalDevices: number;
  totalAlertsToday: number;
  criticalAlertsToday: number;
  activeUsersToday: number;
  conversionRate: number;
  alertsByVerdict: { name: string; value: number; color: string }[];
  alertsTrend: { date: string; safe: number; review: number; notify: number; notified: number }[];
  funnel: { stage: string; count: number }[];
  activeChildrenToday: number;
  activeParentsThisWeek: number;
  messagesScannedToday: number;
  alertsSentToday: number;
  feedbackTrend: { date: string; total: number; important: number; not_relevant: number }[];
  totalAlertsLast7Days: number;
  alertsWithFeedbackLast7Days: number;
  feedbackEngagementRate: number;
  alertsCreatedToday: number;
  alertsAnalyzedToday: number;
  alertsNotifiedToday: number;
  systemAlertsToday: number;
  queuePending: number;
  queueFailed: number;
  oldestPendingMinutes: number;
  pendingAlerts: { id: string; alert_id: number; status: string; attempt: number; created_at: string; last_error: string | null; is_processed: boolean }[];
  freeChildren: number;
  premiumChildren: number;
}

interface AdminOverviewProps {
  stats: OverviewStats | null;
  loading: boolean;
  onNavigate: (tab: string, filter?: string) => void;
  onRefresh?: () => void;
}

const VERDICT_COLORS: Record<string, string> = {
  safe: "#22c55e",
  review: "#f59e0b",
  notify: "#ef4444",
};

export function AdminOverview({ stats, loading, onNavigate }: AdminOverviewProps) {
  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">טוען נתונים...</div>
      </div>
    );
  }

  const hasQueueIssues = stats.queuePending > 0 || stats.queueFailed > 0;

  return (
    <div className="space-y-6">
      {/* Queue indicator - small alert if issues */}
      {hasQueueIssues && (
        <div 
          className="flex items-center gap-2 p-3 rounded-lg border border-orange-500/30 bg-orange-500/5 cursor-pointer hover:bg-orange-500/10 transition-colors"
          onClick={() => onNavigate("queue")}
        >
          <AlertTriangle className="w-4 h-4 text-orange-500" />
          <span className="text-sm">
            תור עיבוד: <strong className="text-orange-500">{stats.queuePending} ממתינות</strong>
            {stats.queueFailed > 0 && <>, <strong className="text-red-500">{stats.queueFailed} נכשלו</strong></>}
          </span>
          <Badge variant="outline" className="mr-auto text-xs">לחץ לצפייה</Badge>
        </div>
      )}

      {/* 4 CEO KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-cyan-500/20 cursor-pointer hover:shadow-md transition-all" onClick={() => onNavigate("users")}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <Users className="w-3 h-3" />
              משפחות פעילות
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-cyan-500">{stats.activeUsersToday}</p>
            <p className="text-xs text-muted-foreground mt-1">מכשירים פעילים היום</p>
          </CardContent>
        </Card>

        <Card className="border-blue-500/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <MessageSquare className="w-3 h-3" />
              הודעות שנסרקו היום
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-500">{stats.messagesScannedToday?.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card className="border-orange-500/20 cursor-pointer hover:shadow-md transition-all" onClick={() => onNavigate("alerts")}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <Bell className="w-3 h-3" />
              התראות שנשלחו להורים
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-500">{stats.alertsNotifiedToday}</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <Star className="w-3 h-3" />
              חינם / Premium
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-emerald-500">{stats.premiumChildren}</span>
              <span className="text-sm text-muted-foreground">/</span>
              <span className="text-xl font-semibold">{stats.freeChildren}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Premium / חינם</p>
          </CardContent>
        </Card>
      </div>

      {/* Alert Trend Chart - 14 days */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg">מגמת התראות — 14 ימים</CardTitle>
          <CardDescription>safe / review / notify / נשלחו להורים</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.alertsTrend || []}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="safe" stroke={VERDICT_COLORS.safe} strokeWidth={2} name="Safe" />
                <Line type="monotone" dataKey="review" stroke={VERDICT_COLORS.review} strokeWidth={2} name="Review" />
                <Line type="monotone" dataKey="notify" stroke={VERDICT_COLORS.notify} strokeWidth={2} name="Notify" />
                <Line type="monotone" dataKey="notified" stroke="#f97316" strokeWidth={2} strokeDasharray="5 5" name="נשלחו להורים" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Conversion Funnel */}
      {stats.funnel && stats.funnel.length > 0 && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              משפך המרה
            </CardTitle>
            <CardDescription>מרשימת המתנה ועד משתמש פעיל</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-4">
              {stats.funnel.map((stage, index) => (
                <div key={stage.stage} className="flex items-center">
                  <div className="flex flex-col items-center min-w-[100px]">
                    <div 
                      className="w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold"
                      style={{
                        backgroundColor: `hsl(var(--primary) / ${0.2 + (index * 0.2)})`,
                        borderColor: `hsl(var(--primary))`,
                        borderWidth: '2px'
                      }}
                    >
                      {stage.count}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 text-center">{stage.stage}</p>
                  </div>
                  {index < stats.funnel.length - 1 && (
                    <div className="w-8 h-0.5 bg-primary/30 mx-2" />
                  )}
                </div>
              ))}
            </div>
            {stats.funnel.length > 1 && (
              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  שיעור המרה מ-Waitlist להרשמה:{" "}
                  <span className="font-bold text-primary">
                    {stats.funnel[0].count > 0 
                      ? ((stats.funnel[1].count / stats.funnel[0].count) * 100).toFixed(1)
                      : 0}%
                  </span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
