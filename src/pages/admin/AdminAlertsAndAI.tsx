import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, Cpu, Send, Shield, MessageSquare, Database, CheckCircle } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { AdminTraining } from "./AdminTraining";
import { AdminFeedback } from "./AdminFeedback";

interface OverviewStats {
  alertsCreatedToday: number;
  systemAlertsToday: number;
  alertsAnalyzedToday: number;
  alertsNotifiedToday: number;
  feedbackEngagementRate: number;
  alertsWithFeedbackLast7Days: number;
  totalAlertsLast7Days: number;
  alertsByVerdict: { name: string; value: number; color: string }[];
  feedbackTrend: { date: string; total: number; important: number; not_relevant: number }[];
}

interface TrainingStats {
  total: number;
  systemAlertCount: number;
  byGender: { name: string; value: number }[];
  byAge: { age: string; count: number }[];
  byVerdict: { name: string; value: number; color: string }[];
  byRiskLevel: { level: string; count: number }[];
  classificationCounts: { name: string; count: number }[];
}

interface TrainingRecord {
  id: string;
  alert_id: number | null;
  raw_text: string;
  age_at_incident: number | null;
  gender: string | null;
  ai_verdict: { verdict?: string; risk_score?: number } | null;
  created_at: string;
}

interface AdminAlertsAndAIProps {
  overviewStats: OverviewStats | null;
  trainingStats: TrainingStats | null;
  trainingRecords: TrainingRecord[];
  loading: boolean;
}

export function AdminAlertsAndAI({ overviewStats, trainingStats, trainingRecords, loading }: AdminAlertsAndAIProps) {
  const [subTab, setSubTab] = useState("overview");

  return (
    <div className="space-y-4">
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex">
          <TabsTrigger value="overview" className="gap-2">
            <Bell className="w-4 h-4" />
            סקירת התראות
          </TabsTrigger>
          <TabsTrigger value="training" className="gap-2">
            <Database className="w-4 h-4" />
            Training
          </TabsTrigger>
          <TabsTrigger value="feedback" className="gap-2">
            <MessageSquare className="w-4 h-4" />
            משוב
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <AlertsOverview stats={overviewStats} />
        </TabsContent>

        <TabsContent value="training">
          <AdminTraining stats={trainingStats} records={trainingRecords} loading={loading} />
        </TabsContent>

        <TabsContent value="feedback">
          <AdminFeedback />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AlertsOverview({ stats }: { stats: OverviewStats | null }) {
  if (!stats) {
    return <div className="text-center text-muted-foreground py-8">טוען נתונים...</div>;
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-blue-400/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <Bell className="w-3 h-3" />
              התראות אמיתיות היום
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-400">{stats.alertsCreatedToday}</p>
          </CardContent>
        </Card>

        <Card className="border-slate-400/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <Shield className="w-3 h-3" />
              התראות מערכת
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-400">{stats.systemAlertsToday}</p>
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
            <p className="text-2xl font-bold text-violet-500">{stats.alertsAnalyzedToday}</p>
          </CardContent>
        </Card>

        <Card className="border-orange-500/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <Send className="w-3 h-3" />
              נשלחו להורים
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-500">{stats.alertsNotifiedToday}</p>
          </CardContent>
        </Card>

        <Card className="border-green-500/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <CheckCircle className="w-3 h-3" />
              אחוז משוב (7 ימים)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-500">{stats.feedbackEngagementRate?.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground mt-1">{stats.alertsWithFeedbackLast7Days} / {stats.totalAlertsLast7Days}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">התפלגות Verdicts</CardTitle>
            <CardDescription>safe / review / notify</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.alertsByVerdict || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {stats.alertsByVerdict?.map((entry, index) => (
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
            <CardTitle className="text-lg">משוב הורים</CardTitle>
            <CardDescription>14 ימים אחרונים</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.feedbackTrend || []}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="total" fill="hsl(var(--muted-foreground))" name="סה״כ" opacity={0.3} />
                  <Bar dataKey="important" fill="#22c55e" name="רלוונטי" />
                  <Bar dataKey="not_relevant" fill="#ef4444" name="לא רלוונטי" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
