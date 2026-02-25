import { useState, useEffect, useMemo } from "react";
import { adminSupabase } from "@/integrations/supabase/admin-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ThumbsUp, ThumbsDown, Filter, Eye } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { subDays, format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface FeedbackWithAlert {
  id: string;
  alert_id: number;
  feedback_type: string;
  created_at: string;
  parent_id: string;
  // from alert
  ai_title?: string | null;
  category?: string | null;
  ai_risk_score?: number | null;
  ai_verdict?: string | null;
  ai_summary?: string | null;
  ai_explanation?: string | null;
  ai_recommendation?: string | null;
  chat_type?: string | null;
  chat_name?: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  violence: "אלימות",
  bullying: "בריונות",
  sexual: "תוכן מיני",
  drugs: "סמים",
  self_harm: "פגיעה עצמית",
  hate: "שנאה",
  profanity: "גסות רוח",
  危険: "סכנה",
};

const RISK_RANGES = [
  { label: "0-40", min: 0, max: 40 },
  { label: "40-60", min: 40, max: 60 },
  { label: "60-80", min: 60, max: 80 },
  { label: "80-100", min: 80, max: 100 },
];

export function AdminFeedback() {
  const [loading, setLoading] = useState(true);
  const [feedbackData, setFeedbackData] = useState<FeedbackWithAlert[]>([]);
  const [showOnlyIrrelevant, setShowOnlyIrrelevant] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<FeedbackWithAlert | null>(null);

  useEffect(() => {
    fetchFeedbackData();
  }, []);

  const fetchFeedbackData = async () => {
    setLoading(true);
    try {
      // Fetch all feedback (last 30 days for analysis)
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      const { data: feedback, error: fbError } = await adminSupabase
        .from("alert_feedback")
        .select("*")
        .gte("created_at", thirtyDaysAgo)
        .order("created_at", { ascending: false });

      if (fbError) throw fbError;
      if (!feedback || feedback.length === 0) {
        setFeedbackData([]);
        setLoading(false);
        return;
      }

      // Fetch corresponding alerts
      const alertIds = [...new Set(feedback.map(f => f.alert_id))];
      const { data: alerts, error: alertsError } = await adminSupabase
        .from("alerts")
        .select("id, ai_title, category, ai_risk_score, ai_verdict, ai_summary, ai_explanation, ai_recommendation, chat_type, chat_name")
        .in("id", alertIds);

      if (alertsError) throw alertsError;

      const alertMap = new Map(alerts?.map(a => [a.id, a]) || []);

      const merged: FeedbackWithAlert[] = feedback.map(f => {
        const alert = alertMap.get(f.alert_id);
        return {
          ...f,
          ai_title: alert?.ai_title,
          category: alert?.category,
          ai_risk_score: alert?.ai_risk_score,
          ai_verdict: alert?.ai_verdict,
          ai_summary: alert?.ai_summary,
          ai_explanation: alert?.ai_explanation,
          ai_recommendation: alert?.ai_recommendation,
          chat_type: alert?.chat_type,
          chat_name: alert?.chat_name,
        };
      });

      setFeedbackData(merged);
    } catch (error) {
      console.error("Error fetching feedback data:", error);
    }
    setLoading(false);
  };

  // KPIs (7 days)
  const kpis = useMemo(() => {
    const sevenDaysAgo = subDays(new Date(), 7);
    const recent = feedbackData.filter(f => new Date(f.created_at) >= sevenDaysAgo);
    const total = recent.length;
    const notRelevant = recent.filter(f => f.feedback_type === "not_relevant").length;
    const important = recent.filter(f => f.feedback_type === "important").length;
    return {
      total,
      notRelevantPct: total > 0 ? Math.round((notRelevant / total) * 100) : 0,
      importantPct: total > 0 ? Math.round((important / total) * 100) : 0,
      notRelevant,
      important,
    };
  }, [feedbackData]);

  // By category chart
  const categoryData = useMemo(() => {
    const catMap: Record<string, { total: number; notRelevant: number }> = {};
    feedbackData.forEach(f => {
      const cat = f.category || "unknown";
      if (!catMap[cat]) catMap[cat] = { total: 0, notRelevant: 0 };
      catMap[cat].total++;
      if (f.feedback_type === "not_relevant") catMap[cat].notRelevant++;
    });
    return Object.entries(catMap)
      .map(([cat, data]) => ({
        category: CATEGORY_LABELS[cat] || cat,
        pctNotRelevant: data.total > 0 ? Math.round((data.notRelevant / data.total) * 100) : 0,
        total: data.total,
        notRelevant: data.notRelevant,
      }))
      .sort((a, b) => b.pctNotRelevant - a.pctNotRelevant);
  }, [feedbackData]);

  // By risk_score chart
  const riskData = useMemo(() => {
    return RISK_RANGES.map(range => {
      const inRange = feedbackData.filter(f => {
        const score = f.ai_risk_score ?? 0;
        return score >= range.min && score < (range.max === 100 ? 101 : range.max);
      });
      return {
        range: range.label,
        relevant: inRange.filter(f => f.feedback_type === "important").length,
        notRelevant: inRange.filter(f => f.feedback_type === "not_relevant").length,
      };
    });
  }, [feedbackData]);

  // Table data
  const tableData = useMemo(() => {
    let data = feedbackData.slice(0, 50);
    if (showOnlyIrrelevant) {
      data = feedbackData.filter(f => f.feedback_type === "not_relevant").slice(0, 50);
    }
    return data;
  }, [feedbackData, showOnlyIrrelevant]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat("he-IL", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jerusalem",
    }).format(d);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (feedbackData.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          אין נתוני משוב עדיין. כשהורים ידרגו התראות, הנתונים יופיעו כאן.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-primary">{kpis.total}</div>
            <p className="text-sm text-muted-foreground mt-1">סה"כ משובים (7 ימים)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="flex items-center justify-center gap-2">
              <ThumbsUp className="w-5 h-5 text-green-500" />
              <span className="text-3xl font-bold text-green-500">{kpis.importantPct}%</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">רלוונטי ({kpis.important})</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="flex items-center justify-center gap-2">
              <ThumbsDown className="w-5 h-5 text-red-500" />
              <span className="text-3xl font-bold text-red-500">{kpis.notRelevantPct}%</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">לא רלוונטי ({kpis.notRelevant})</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Category */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">"לא רלוונטי" לפי קטגוריה</CardTitle>
            <p className="text-xs text-muted-foreground">קטגוריות עם אחוז גבוה = ה-AI טועה שם</p>
          </CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={categoryData} layout="vertical" margin={{ right: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} />
                  <YAxis type="category" dataKey="category" width={80} tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number, _name: string, item: any) =>
                      [`${value}% (${item.payload.notRelevant}/${item.payload.total})`, "לא רלוונטי"]
                    }
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                  />
                  <Bar dataKey="pctNotRelevant" radius={[0, 4, 4, 0]}>
                    {categoryData.map((entry, index) => (
                      <Cell key={index} fill={entry.pctNotRelevant > 50 ? "hsl(0 84% 60%)" : "hsl(var(--primary))"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">אין נתונים</p>
            )}
          </CardContent>
        </Card>

        {/* By Risk Score */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">משוב לפי טווח Risk Score</CardTitle>
            <p className="text-xs text-muted-foreground">בודק אם הסף מכויל נכון</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={riskData} margin={{ right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="relevant" name="רלוונטי" fill="hsl(142 71% 45%)" stackId="a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="notRelevant" name="לא רלוונטי" fill="hsl(0 84% 60%)" stackId="a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detail Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">פירוט משובים אחרונים</CardTitle>
          <Button
            variant={showOnlyIrrelevant ? "default" : "outline"}
            size="sm"
            onClick={() => setShowOnlyIrrelevant(!showOnlyIrrelevant)}
            className="gap-2"
          >
            <Filter className="w-4 h-4" />
            {showOnlyIrrelevant ? "מציג: לא רלוונטי בלבד" : "הצג לא רלוונטי בלבד"}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>תאריך</TableHead>
                  <TableHead>כותרת</TableHead>
                  <TableHead>קטגוריה</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Verdict</TableHead>
                  <TableHead>משוב</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableData.map(row => (
                  <TableRow key={row.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedAlert(row)}>
                    <TableCell className="text-xs whitespace-nowrap">{formatDate(row.created_at)}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">{row.ai_title || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {CATEGORY_LABELS[row.category || ""] || row.category || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{row.ai_risk_score ?? "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={row.ai_verdict === "notify" ? "destructive" : "secondary"}
                        className="text-xs"
                      >
                        {row.ai_verdict || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {row.feedback_type === "important" ? (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">רלוונטי</Badge>
                      ) : (
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">לא רלוונטי</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Eye className="w-4 h-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Alert Detail Dialog */}
      <Dialog open={!!selectedAlert} onOpenChange={() => setSelectedAlert(null)}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>{selectedAlert?.ai_title || "פרטי התראה"}</DialogTitle>
          </DialogHeader>
          {selectedAlert && (
            <div className="space-y-3 text-sm">
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline">{CATEGORY_LABELS[selectedAlert.category || ""] || selectedAlert.category || "—"}</Badge>
                <Badge variant={selectedAlert.ai_verdict === "notify" ? "destructive" : "secondary"}>
                  {selectedAlert.ai_verdict}
                </Badge>
                <Badge variant="outline">Risk: {selectedAlert.ai_risk_score ?? "—"}</Badge>
                {selectedAlert.feedback_type === "important" ? (
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">רלוונטי ✓</Badge>
                ) : (
                  <Badge className="bg-red-500/20 text-red-400 border-red-500/30">לא רלוונטי ✗</Badge>
                )}
              </div>
              {selectedAlert.ai_summary && (
                <div>
                  <p className="font-medium text-muted-foreground">סיכום:</p>
                  <p>{selectedAlert.ai_summary}</p>
                </div>
              )}
              {selectedAlert.ai_explanation && (
                <div>
                  <p className="font-medium text-muted-foreground">הסבר:</p>
                  <p>{selectedAlert.ai_explanation}</p>
                </div>
              )}
              {selectedAlert.ai_recommendation && (
                <div>
                  <p className="font-medium text-muted-foreground">המלצה:</p>
                  <p>{selectedAlert.ai_recommendation}</p>
                </div>
              )}
              <div className="text-xs text-muted-foreground pt-2 border-t border-border">
                שיחה: {selectedAlert.chat_name || "—"} ({selectedAlert.chat_type || "—"}) · {formatDate(selectedAlert.created_at)}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
