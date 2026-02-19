import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Smartphone, Bell, UserPlus, TrendingUp, AlertTriangle, Activity, CheckCircle, MessageSquare, Baby, ThumbsUp, ChevronLeft, Loader2, Zap, Clock, XCircle, Cpu, Send } from "lucide-react";
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  queuePending: number;
  queueFailed: number;
  oldestPendingMinutes: number;
}

interface AdminOverviewProps {
  stats: OverviewStats | null;
  loading: boolean;
  onNavigate: (tab: string, filter?: string) => void;
}

const VERDICT_COLORS: Record<string, string> = {
  safe: "#22c55e",
  review: "#f59e0b",
  notify: "#ef4444",
};

const clickableCardClass = "cursor-pointer hover:shadow-md hover:border-primary/40 transition-all duration-200";

function ClickableIndicator() {
  return <ChevronLeft className="w-4 h-4 text-muted-foreground/50 absolute top-3 left-3" />;
}

// Funnel stage to tab mapping
const FUNNEL_TAB_MAP: Record<string, { tab: string; filter?: string }> = {
  "Waitlist": { tab: "waitlist" },
  "נרשמו": { tab: "users" },
  "הוסיפו ילד": { tab: "users" },
  "חיברו מכשיר": { tab: "users", filter: "online" },
  "פעילים היום": { tab: "users", filter: "online" },
};

function QueueHealthCard({ stats }: { stats: OverviewStats }) {
  const [processing, setProcessing] = useState(false);
  const [processingAll, setProcessingAll] = useState(false);

  const hasIssues = stats.queuePending > 0 || stats.queueFailed > 0;
  const isStuck = stats.queuePending > 0 && stats.oldestPendingMinutes > 5;

  if (!hasIssues) return null;

  const handleProcessOne = async () => {
    setProcessing(true);
    try {
      const { error } = await supabase.functions.invoke('analyze-alert', { body: {} });
      if (error) throw error;
      toast.success("עיבוד התראה אחת הושלם");
    } catch (e: any) {
      toast.error("שגיאה בעיבוד: " + e.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleProcessAll = async () => {
    setProcessingAll(true);
    let processed = 0;
    try {
      for (let i = 0; i < stats.queuePending; i++) {
        const { error } = await supabase.functions.invoke('analyze-alert', { body: {} });
        if (error) throw error;
        processed++;
      }
      toast.success(`עובדו ${processed} התראות בהצלחה`);
    } catch (e: any) {
      toast.error(`עובדו ${processed}, שגיאה: ${e.message}`);
    } finally {
      setProcessingAll(false);
    }
  };

  return (
    <Card className={`border-2 ${isStuck ? 'border-red-500/50 bg-red-500/5' : 'border-orange-500/50 bg-orange-500/5'}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertTriangle className={`w-5 h-5 ${isStuck ? 'text-red-500' : 'text-orange-500'}`} />
          בריאות תור עיבוד
        </CardTitle>
        <CardDescription>
          {isStuck ? 'התור תקוע! התראות ממתינות מעל 5 דקות' : 'יש פריטים בתור'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-6 mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-orange-500" />
            <span className="text-sm">ממתינות: <strong className="text-orange-500">{stats.queuePending}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-500" />
            <span className="text-sm">נכשלו: <strong className="text-red-500">{stats.queueFailed}</strong></span>
          </div>
          {stats.oldestPendingMinutes > 0 && (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">הישנה ביותר: <strong>{stats.oldestPendingMinutes} דק׳</strong></span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleProcessOne} disabled={processing || processingAll || stats.queuePending === 0}>
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            עבד התראה אחת
          </Button>
          <Button size="sm" onClick={handleProcessAll} disabled={processing || processingAll || stats.queuePending === 0}>
            {processingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cpu className="w-4 h-4" />}
            עבד את כולם ({stats.queuePending})
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminOverview({ stats, loading, onNavigate }: AdminOverviewProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">טוען נתונים...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Queue Health - only shown when there are issues */}
      {stats && <QueueHealthCard stats={stats} />}

      {/* Beta KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={`border-cyan-500/20 relative ${clickableCardClass}`} onClick={() => onNavigate("users", "today")}>
          <ClickableIndicator />
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <Baby className="w-3 h-3" />
              ילדים פעילים היום
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-cyan-500">{stats?.activeChildrenToday || 0}</p>
          </CardContent>
        </Card>

        <Card className={`border-violet-500/20 relative ${clickableCardClass}`} onClick={() => onNavigate("users")}>
          <ClickableIndicator />
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <Users className="w-3 h-3" />
              הורים פעילים השבוע
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-violet-500">{stats?.activeParentsThisWeek || 0}</p>
          </CardContent>
        </Card>

        <Card className={`border-blue-500/20 relative ${clickableCardClass}`} onClick={() => onNavigate("insights")}>
          <ClickableIndicator />
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <MessageSquare className="w-3 h-3" />
              הודעות שנסרקו היום
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-500">{stats?.messagesScannedToday?.toLocaleString() || 0}</p>
          </CardContent>
        </Card>

        {/* Replaced single "alerts sent" with 3 separate KPIs */}
        <Card className="border-blue-400/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <Bell className="w-3 h-3" />
              התראות שנוצרו היום
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-400">{stats?.alertsCreatedToday || 0}</p>
          </CardContent>
        </Card>

        <Card className="border-violet-500/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <Cpu className="w-3 h-3" />
              עובדו ע"י AI
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-violet-500">{stats?.alertsAnalyzedToday || 0}</p>
          </CardContent>
        </Card>

        <Card className={`border-orange-500/20 relative ${clickableCardClass}`} onClick={() => onNavigate("training")}>
          <ClickableIndicator />
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <Send className="w-3 h-3" />
              נשלחו להורים
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-500">{stats?.alertsNotifiedToday || 0}</p>
          </CardContent>
        </Card>

        <Card className="border-green-500/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <CheckCircle className="w-3 h-3" />
              אחוז התראות עם משוב (7 ימים)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-500">{stats?.feedbackEngagementRate?.toFixed(1) || '0.0'}%</p>
            <p className="text-xs text-muted-foreground mt-1">{stats?.alertsWithFeedbackLast7Days || 0} / {stats?.totalAlertsLast7Days || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Existing KPIs Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className={`border-primary/20 relative ${clickableCardClass}`} onClick={() => onNavigate("users")}>
          <ClickableIndicator />
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <Users className="w-3 h-3" />
              הורים רשומים
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">{stats?.totalParents || 0}</p>
          </CardContent>
        </Card>

        <Card className={`border-yellow-500/20 relative ${clickableCardClass}`} onClick={() => onNavigate("waitlist")}>
          <ClickableIndicator />
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <UserPlus className="w-3 h-3" />
              רשימת המתנה
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-500">{stats?.totalWaitlist || 0}</p>
          </CardContent>
        </Card>

        <Card className={`border-green-500/20 relative ${clickableCardClass}`} onClick={() => onNavigate("users", "online")}>
          <ClickableIndicator />
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <Smartphone className="w-3 h-3" />
              מכשירים מחוברים
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-500">{stats?.totalDevices || 0}</p>
          </CardContent>
        </Card>

        <Card className={`border-blue-500/20 relative ${clickableCardClass}`} onClick={() => onNavigate("training")}>
          <ClickableIndicator />
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <Bell className="w-3 h-3" />
              התראות היום
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-500">{stats?.totalAlertsToday || 0}</p>
          </CardContent>
        </Card>

        <Card className={`border-red-500/20 relative ${clickableCardClass}`} onClick={() => onNavigate("training")}>
          <ClickableIndicator />
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <AlertTriangle className="w-3 h-3" />
              התראות קריטיות
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-500">{stats?.criticalAlertsToday || 0}</p>
          </CardContent>
        </Card>

        <Card className={`border-emerald-500/20 relative ${clickableCardClass}`} onClick={() => onNavigate("users", "online")}>
          <ClickableIndicator />
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <Activity className="w-3 h-3" />
              פעילים היום
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-500">{stats?.activeUsersToday || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Conversion Funnel */}
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
            {stats?.funnel.map((stage, index) => {
              const mapping = FUNNEL_TAB_MAP[stage.stage];
              return (
                <div key={stage.stage} className="flex items-center">
                  <div
                    className={`flex flex-col items-center min-w-[100px] ${mapping ? 'cursor-pointer group' : ''}`}
                    onClick={() => mapping && onNavigate(mapping.tab, mapping.filter)}
                  >
                    <div 
                      className={`w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold transition-all duration-200 ${mapping ? 'group-hover:shadow-md group-hover:scale-105' : ''}`}
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
                  {index < (stats?.funnel.length || 0) - 1 && (
                    <div className="w-8 h-0.5 bg-primary/30 mx-2" />
                  )}
                </div>
              );
            })}
          </div>
          {stats && stats.funnel.length > 1 && (
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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">התפלגות התראות</CardTitle>
            <CardDescription>לפי סוג verdict</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats?.alertsByVerdict || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {stats?.alertsByVerdict.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">מגמת התראות</CardTitle>
            <CardDescription>14 ימים אחרונים</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats?.alertsTrend || []}>
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
      </div>

      {/* Feedback Trend Chart */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ThumbsUp className="w-5 h-5" />
            משוב הורים על התראות
          </CardTitle>
          <CardDescription>14 ימים אחרונים – סה"כ התראות מול משוב רלוונטי / לא רלוונטי</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.feedbackTrend || []}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" fill="hsl(var(--muted-foreground))" name="סה״כ התראות" opacity={0.3} />
                <Bar dataKey="important" fill="#22c55e" name="רלוונטי" />
                <Bar dataKey="not_relevant" fill="#ef4444" name="לא רלוונטי" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
