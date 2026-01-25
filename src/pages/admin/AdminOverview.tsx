import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Smartphone, Bell, UserPlus, TrendingUp, AlertTriangle, Activity, CheckCircle } from "lucide-react";
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from "recharts";

interface OverviewStats {
  totalParents: number;
  totalWaitlist: number;
  totalDevices: number;
  totalAlertsToday: number;
  criticalAlertsToday: number;
  activeUsersToday: number;
  conversionRate: number;
  alertsByVerdict: { name: string; value: number; color: string }[];
  alertsTrend: { date: string; safe: number; review: number; notify: number }[];
  funnel: { stage: string; count: number }[];
}

interface AdminOverviewProps {
  stats: OverviewStats | null;
  loading: boolean;
}

const VERDICT_COLORS: Record<string, string> = {
  safe: "#22c55e",
  review: "#f59e0b",
  notify: "#ef4444",
};

export function AdminOverview({ stats, loading }: AdminOverviewProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">טוען נתונים...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="border-primary/20">
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

        <Card className="border-yellow-500/20">
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

        <Card className="border-green-500/20">
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

        <Card className="border-blue-500/20">
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

        <Card className="border-red-500/20">
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

        <Card className="border-emerald-500/20">
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
            {stats?.funnel.map((stage, index) => (
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
                {index < (stats?.funnel.length || 0) - 1 && (
                  <div className="w-8 h-0.5 bg-primary/30 mx-2" />
                )}
              </div>
            ))}
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
        {/* Alerts by Verdict Pie Chart */}
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

        {/* Alerts Trend Line Chart */}
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">מגמת התראות</CardTitle>
            <CardDescription>7 ימים אחרונים</CardDescription>
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
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
