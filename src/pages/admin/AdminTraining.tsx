import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Users, TrendingUp, AlertTriangle } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface TrainingStats {
  total: number;
  byGender: { name: string; value: number }[];
  byAge: { age: string; count: number }[];
  byVerdict: { name: string; value: number; color: string }[];
  byRiskLevel: { level: string; count: number }[];
  classificationCounts: { name: string; count: number }[];
}

interface AdminTrainingProps {
  stats: TrainingStats | null;
  loading: boolean;
}

export function AdminTraining({ stats, loading }: AdminTrainingProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">טוען נתוני אימון...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              סה"כ רשומות
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats?.total || 0}</p>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              התפלגות מגדר
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2 flex-wrap">
            {stats?.byGender.map((g) => (
              <Badge key={g.name} variant="secondary">
                {g.name}: {g.value}
              </Badge>
            ))}
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              ממוצע גילאים
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2 flex-wrap">
            {stats?.byAge.slice(0, 3).map((a) => (
              <Badge key={a.age} variant="outline">
                {a.age}: {a.count}
              </Badge>
            ))}
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              סוגי סיכון
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2 flex-wrap">
            {stats?.classificationCounts.slice(0, 3).map((c) => (
              <Badge key={c.name} variant="destructive">
                {c.name}: {c.count}
              </Badge>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Verdict Distribution */}
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">התפלגות לפי Verdict</CardTitle>
            <CardDescription>safe / review / notify / monitor</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats?.byVerdict || []}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {stats?.byVerdict.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Age Distribution */}
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">התפלגות לפי גיל</CardTitle>
            <CardDescription>קבוצות גיל של ילדים</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.byAge || []}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="age" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Risk Classifications */}
        <Card className="border-primary/20 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">סוגי סיכון מזוהים</CardTitle>
            <CardDescription>התפלגות לפי סוג איום (ציון מעל 50)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.classificationCounts || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={80} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Risk Levels */}
        <Card className="border-primary/20 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">רמות סיכון</CardTitle>
            <CardDescription>התפלגות לפי Risk Score</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              {stats?.byRiskLevel.map((level) => (
                <div
                  key={level.level}
                  className={`p-4 rounded-lg text-center ${
                    level.level === "low"
                      ? "bg-green-500/10 border border-green-500/20"
                      : level.level === "medium"
                      ? "bg-yellow-500/10 border border-yellow-500/20"
                      : level.level === "high"
                      ? "bg-orange-500/10 border border-orange-500/20"
                      : "bg-red-500/10 border border-red-500/20"
                  }`}
                >
                  <p className="text-2xl font-bold">{level.count}</p>
                  <p className="text-sm text-muted-foreground capitalize">{level.level}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
