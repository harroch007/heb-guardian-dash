import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, LogOut, Shield, Users, BarChart3, TrendingUp, AlertTriangle } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import kippyLogo from "@/assets/kippy-logo.svg";

interface TrainingRecord {
  id: string;
  raw_text: string;
  age_at_incident: number | null;
  gender: string | null;
  ai_verdict: {
    verdict?: string;
    risk_score?: number;
    classification?: {
      bullying?: number;
      violence?: number;
      sexual?: number;
      drugs?: number;
      self_harm?: number;
      hate?: number;
    };
  } | null;
  created_at: string;
}

interface Stats {
  total: number;
  byGender: { name: string; value: number }[];
  byAge: { age: string; count: number }[];
  byVerdict: { name: string; value: number; color: string }[];
  byRiskLevel: { level: string; count: number }[];
  classificationCounts: { name: string; count: number }[];
}

const VERDICT_COLORS: Record<string, string> = {
  safe: "#22c55e",
  review: "#f59e0b",
  notify: "#ef4444",
  monitor: "#8b5cf6",
};

const GENDER_LABELS: Record<string, string> = {
  male: "זכר",
  female: "נקבה",
  unknown: "לא ידוע",
};

export default function Admin() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase
        .from("training_dataset")
        .select("*");

      if (error) {
        console.error("Error fetching training data:", error);
        return;
      }

      const records = data as TrainingRecord[];
      
      // Process statistics
      const genderCounts: Record<string, number> = {};
      const ageCounts: Record<string, number> = {};
      const verdictCounts: Record<string, number> = {};
      const riskLevelCounts: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
      const classificationCounts: Record<string, number> = {
        bullying: 0,
        violence: 0,
        sexual: 0,
        drugs: 0,
        self_harm: 0,
        hate: 0,
      };

      records.forEach((record) => {
        // Gender
        const gender = record.gender || "unknown";
        genderCounts[gender] = (genderCounts[gender] || 0) + 1;

        // Age groups
        if (record.age_at_incident) {
          const ageGroup = getAgeGroup(record.age_at_incident);
          ageCounts[ageGroup] = (ageCounts[ageGroup] || 0) + 1;
        }

        // Verdict
        if (record.ai_verdict?.verdict) {
          const verdict = record.ai_verdict.verdict;
          verdictCounts[verdict] = (verdictCounts[verdict] || 0) + 1;
        }

        // Risk level
        if (record.ai_verdict?.risk_score !== undefined) {
          const level = getRiskLevel(record.ai_verdict.risk_score);
          riskLevelCounts[level]++;
        }

        // Classifications
        if (record.ai_verdict?.classification) {
          const cls = record.ai_verdict.classification;
          Object.entries(cls).forEach(([key, value]) => {
            if (value && value > 50) {
              classificationCounts[key] = (classificationCounts[key] || 0) + 1;
            }
          });
        }
      });

      setStats({
        total: records.length,
        byGender: Object.entries(genderCounts).map(([name, value]) => ({
          name: GENDER_LABELS[name] || name,
          value,
        })),
        byAge: Object.entries(ageCounts)
          .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
          .map(([age, count]) => ({ age, count })),
        byVerdict: Object.entries(verdictCounts).map(([name, value]) => ({
          name,
          value,
          color: VERDICT_COLORS[name] || "#6b7280",
        })),
        byRiskLevel: Object.entries(riskLevelCounts).map(([level, count]) => ({
          level,
          count,
        })),
        classificationCounts: Object.entries(classificationCounts)
          .filter(([_, count]) => count > 0)
          .sort((a, b) => b[1] - a[1])
          .map(([name, count]) => ({ name: getClassificationLabel(name), count })),
      });
    } catch (err) {
      console.error("Error processing stats:", err);
    } finally {
      setLoading(false);
    }
  };

  const getAgeGroup = (age: number): string => {
    if (age <= 8) return "6-8";
    if (age <= 10) return "9-10";
    if (age <= 12) return "11-12";
    if (age <= 14) return "13-14";
    if (age <= 16) return "15-16";
    return "17+";
  };

  const getRiskLevel = (score: number): string => {
    if (score < 30) return "low";
    if (score < 60) return "medium";
    if (score < 80) return "high";
    return "critical";
  };

  const getClassificationLabel = (key: string): string => {
    const labels: Record<string, string> = {
      bullying: "בריונות",
      violence: "אלימות",
      sexual: "תוכן מיני",
      drugs: "סמים",
      self_harm: "פגיעה עצמית",
      hate: "שנאה",
    };
    return labels[key] || key;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin-login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 md:p-8">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
            <img src={kippyLogo} alt="Kippy" className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              דשבורד ניהול
            </h1>
            <p className="text-sm text-muted-foreground">סטטיסטיקות Training Dataset</p>
          </div>
        </div>
        <Button variant="outline" onClick={handleLogout} className="gap-2">
          <LogOut className="w-4 h-4" />
          התנתק
        </Button>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
