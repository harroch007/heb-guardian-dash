import { useState, useEffect } from "react";
import { adminSupabase } from "@/integrations/supabase/admin-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Database, Zap, Clock, Moon, TrendingUp, RefreshCw } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Button } from "@/components/ui/button";
import { format, subDays } from "date-fns";

interface InsightStats {
  total: number;
  cached_conclusive: number;
  cached_recent: number;
  cached_late_night: number;
  generated_new: number;
  generated_upgrade: number;
  cacheHitRate: number;
  dailyBreakdown: { date: string; cached: number; generated: number }[];
}

const REQUEST_TYPE_LABELS: Record<string, string> = {
  cached_conclusive: "Cache (סופי)",
  cached_recent: "Cache (< שעה)",
  cached_late_night: "Cache (לילה)",
  generated_new: "חדש",
  generated_upgrade: "שדרוג",
};

const REQUEST_TYPE_COLORS: Record<string, string> = {
  cached_conclusive: "#22c55e",
  cached_recent: "#10b981",
  cached_late_night: "#6366f1",
  generated_new: "#f59e0b",
  generated_upgrade: "#ef4444",
};

export function AdminInsightStats() {
  const [stats, setStats] = useState<InsightStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      // Fetch logs from last 7 days
      const sevenDaysAgo = subDays(new Date(), 7).toISOString();
      
      const { data: logs, error } = await adminSupabase
        .from('insight_logs')
        .select('request_type, created_at')
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Count by type
      const counts: Record<string, number> = {
        cached_conclusive: 0,
        cached_recent: 0,
        cached_late_night: 0,
        generated_new: 0,
        generated_upgrade: 0,
      };

      // Daily breakdown
      const dailyMap: Record<string, { cached: number; generated: number }> = {};
      
      for (let i = 6; i >= 0; i--) {
        const date = format(subDays(new Date(), i), 'dd/MM');
        dailyMap[date] = { cached: 0, generated: 0 };
      }

      logs?.forEach(log => {
        if (counts[log.request_type] !== undefined) {
          counts[log.request_type]++;
        }
        
        const logDate = format(new Date(log.created_at), 'dd/MM');
        if (dailyMap[logDate]) {
          if (log.request_type.startsWith('cached')) {
            dailyMap[logDate].cached++;
          } else {
            dailyMap[logDate].generated++;
          }
        }
      });

      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      const cachedTotal = counts.cached_conclusive + counts.cached_recent + counts.cached_late_night;
      const cacheHitRate = total > 0 ? (cachedTotal / total) * 100 : 0;

      setStats({
        total,
        cached_conclusive: counts.cached_conclusive,
        cached_recent: counts.cached_recent,
        cached_late_night: counts.cached_late_night,
        generated_new: counts.generated_new,
        generated_upgrade: counts.generated_upgrade,
        cacheHitRate,
        dailyBreakdown: Object.entries(dailyMap).map(([date, data]) => ({
          date,
          ...data
        }))
      });
    } catch (err) {
      console.error('Error fetching insight stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center text-muted-foreground p-8">
        לא נמצאו נתונים
      </div>
    );
  }

  const pieData = [
    { name: REQUEST_TYPE_LABELS.cached_conclusive, value: stats.cached_conclusive, color: REQUEST_TYPE_COLORS.cached_conclusive },
    { name: REQUEST_TYPE_LABELS.cached_recent, value: stats.cached_recent, color: REQUEST_TYPE_COLORS.cached_recent },
    { name: REQUEST_TYPE_LABELS.cached_late_night, value: stats.cached_late_night, color: REQUEST_TYPE_COLORS.cached_late_night },
    { name: REQUEST_TYPE_LABELS.generated_new, value: stats.generated_new, color: REQUEST_TYPE_COLORS.generated_new },
    { name: REQUEST_TYPE_LABELS.generated_upgrade, value: stats.generated_upgrade, color: REQUEST_TYPE_COLORS.generated_upgrade },
  ].filter(d => d.value > 0);

  const cachedTotal = stats.cached_conclusive + stats.cached_recent + stats.cached_late_night;
  const generatedTotal = stats.generated_new + stats.generated_upgrade;

  return (
    <div className="space-y-6">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            סטטיסטיקות AI Insights
          </h2>
          <p className="text-sm text-muted-foreground">7 ימים אחרונים</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStats} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          רענן
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <TrendingUp className="w-3 h-3" />
              סה"כ בקשות
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">{stats.total}</p>
          </CardContent>
        </Card>

        <Card className="border-green-500/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <Zap className="w-3 h-3" />
              מ-Cache
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-500">{cachedTotal}</p>
            <p className="text-xs text-muted-foreground">
              {stats.cacheHitRate.toFixed(1)}% hit rate
            </p>
          </CardContent>
        </Card>

        <Card className="border-amber-500/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <Clock className="w-3 h-3" />
              נוצרו ע"י AI
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-500">{generatedTotal}</p>
            <p className="text-xs text-muted-foreground">
              קריאות OpenAI
            </p>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <Moon className="w-3 h-3" />
              חיסכון משוער
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-500">
              ${((cachedTotal * 0.002)).toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">
              ~$0.002 לקריאה
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart - Request Types */}
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">התפלגות סוגי בקשות</CardTitle>
            <CardDescription>Cache vs Generated</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [value, 'בקשות']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Bar Chart - Daily Breakdown */}
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">מגמה יומית</CardTitle>
            <CardDescription>Cache (ירוק) vs Generated (כתום)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.dailyBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="cached" name="Cache" fill="#22c55e" stackId="a" />
                  <Bar dataKey="generated" name="AI" fill="#f59e0b" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed breakdown */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg">פירוט מלא</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-xs text-muted-foreground">Cache (סופי)</span>
              </div>
              <p className="text-xl font-bold">{stats.cached_conclusive}</p>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-xs text-muted-foreground">Cache (&lt; שעה)</span>
              </div>
              <p className="text-xl font-bold">{stats.cached_recent}</p>
            </div>
            <div className="p-3 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full bg-indigo-500" />
                <span className="text-xs text-muted-foreground">Cache (לילה)</span>
              </div>
              <p className="text-xl font-bold">{stats.cached_late_night}</p>
            </div>
            <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="text-xs text-muted-foreground">יצירה חדשה</span>
              </div>
              <p className="text-xl font-bold">{stats.generated_new}</p>
            </div>
            <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-xs text-muted-foreground">שדרוג לסופי</span>
              </div>
              <p className="text-xl font-bold">{stats.generated_upgrade}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
