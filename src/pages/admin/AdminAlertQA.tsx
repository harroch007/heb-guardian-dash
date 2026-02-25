import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, RefreshCw, Eye, RotateCcw, Play } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { AdminModelComparison } from "./AdminModelComparison";

interface AlertQARow {
  id: number;
  created_at: string;
  chat_name: string | null;
  chat_type: string | null;
  ai_verdict: string | null;
  ai_risk_score: number | null;
  child_role: string | null;
  ai_analysis: Record<string, unknown> | null;
  ai_social_context: Record<string, unknown> | null;
  ai_title: string | null;
  ai_summary: string | null;
  ai_recommendation: string | null;
  ai_patterns: string[] | null;
  ai_classification: Record<string, unknown> | null;
  ai_confidence: number | null;
  ai_meaning: string | null;
  ai_context: string | null;
}

const VERDICT_COLORS: Record<string, string> = {
  safe: "bg-green-500/20 text-green-400",
  monitor: "bg-purple-500/20 text-purple-400",
  review: "bg-yellow-500/20 text-yellow-400",
  notify: "bg-red-500/20 text-red-400",
};

export function AdminAlertQA() {
  const [alerts, setAlerts] = useState<AlertQARow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<AlertQARow | null>(null);
  const [reanalyzing, setReanalyzing] = useState<number | null>(null);
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [rangeRunning, setRangeRunning] = useState(false);
  const [rangeProgress, setRangeProgress] = useState("");

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("alerts")
        .select("id, created_at, chat_name, chat_type, ai_verdict, ai_risk_score, child_role, ai_analysis, ai_social_context, ai_title, ai_summary, ai_recommendation, ai_patterns, ai_classification, ai_confidence, ai_meaning, ai_context")
        .order("id", { ascending: false })
        .limit(50);

      if (error) throw error;
      setAlerts((data as unknown as AlertQARow[]) || []);
    } catch (err) {
      console.error("Error fetching alerts for QA:", err);
      toast.error("שגיאה בטעינת התראות");
    } finally {
      setLoading(false);
    }
  };

  const reanalyzeAlert = async (alertId: number) => {
    setReanalyzing(alertId);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-alert", {
        body: { alert_id: alertId, force: true },
      });
      if (error) throw error;
      toast.success(`התראה ${alertId} נותחה מחדש`);
      await fetchAlerts();
    } catch (err) {
      console.error("Re-analyze error:", err);
      toast.error(`שגיאה בניתוח מחדש של התראה ${alertId}`);
    } finally {
      setReanalyzing(null);
    }
  };

  const reanalyzeRange = async () => {
    const fromId = parseInt(rangeFrom);
    const toId = parseInt(rangeTo);
    if (isNaN(fromId) || isNaN(toId) || fromId > toId) {
      toast.error("טווח לא תקין");
      return;
    }

    setRangeRunning(true);
    let success = 0;
    let fail = 0;
    const total = toId - fromId + 1;

    for (let id = fromId; id <= toId; id++) {
      setRangeProgress(`${id - fromId + 1}/${total}`);
      try {
        await supabase.functions.invoke("analyze-alert", {
          body: { alert_id: id, force: true },
        });
        success++;
      } catch {
        fail++;
      }
    }

    setRangeRunning(false);
    setRangeProgress("");
    toast.success(`סיום: ${success} הצליחו, ${fail} נכשלו`);
    await fetchAlerts();
  };

  return (
    <div className="space-y-4" dir="rtl">
      <Tabs defaultValue="alerts" dir="rtl">
        <TabsList>
          <TabsTrigger value="alerts">התראות</TabsTrigger>
          <TabsTrigger value="models">מודלים</TabsTrigger>
        </TabsList>
        <TabsContent value="models">
          <AdminModelComparison />
        </TabsContent>
        <TabsContent value="alerts">
      {/* Re-analyze Range */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">ניתוח מחדש לפי טווח</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">מ-ID:</span>
              <Input
                className="w-24"
                value={rangeFrom}
                onChange={(e) => setRangeFrom(e.target.value)}
                placeholder="880"
                type="number"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">עד-ID:</span>
              <Input
                className="w-24"
                value={rangeTo}
                onChange={(e) => setRangeTo(e.target.value)}
                placeholder="900"
                type="number"
              />
            </div>
            <Button
              onClick={reanalyzeRange}
              disabled={rangeRunning}
              variant="default"
              size="sm"
            >
              {rangeRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {rangeProgress}
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  הרץ טווח
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Alerts Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">QA התראות (50 אחרונות)</CardTitle>
            <Button variant="outline" size="sm" onClick={fetchAlerts} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">ID</TableHead>
                  <TableHead className="text-right">תאריך</TableHead>
                  <TableHead className="text-right">צ׳אט</TableHead>
                  <TableHead className="text-right">סוג</TableHead>
                  <TableHead className="text-right">Verdict</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="text-right">Role</TableHead>
                  <TableHead className="text-right">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((alert) => (
                  <TableRow key={alert.id}>
                    <TableCell className="font-mono text-xs">{alert.id}</TableCell>
                    <TableCell className="text-xs">
                      {format(new Date(alert.created_at), "dd/MM HH:mm")}
                    </TableCell>
                    <TableCell className="text-xs max-w-[120px] truncate">
                      {alert.chat_name || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {alert.chat_type || "?"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {alert.ai_verdict ? (
                        <Badge className={`text-xs ${VERDICT_COLORS[alert.ai_verdict] || ""}`}>
                          {alert.ai_verdict}
                        </Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {alert.ai_risk_score ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">{alert.child_role || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setSelectedAlert(alert)}
                          title="הצג JSON"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => reanalyzeAlert(alert.id)}
                          disabled={reanalyzing === alert.id}
                          title="ניתוח מחדש"
                        >
                          {reanalyzing === alert.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog open={!!selectedAlert} onOpenChange={() => setSelectedAlert(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              התראה #{selectedAlert?.id} — {selectedAlert?.ai_title || "ללא כותרת"}
            </DialogTitle>
          </DialogHeader>
          {selectedAlert && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Verdict:</span> {selectedAlert.ai_verdict}</div>
                <div><span className="text-muted-foreground">Risk Score:</span> {selectedAlert.ai_risk_score}</div>
                <div><span className="text-muted-foreground">Child Role:</span> {selectedAlert.child_role}</div>
                <div><span className="text-muted-foreground">Confidence:</span> {selectedAlert.ai_confidence}</div>
                <div><span className="text-muted-foreground">Chat Type:</span> {selectedAlert.chat_type}</div>
                <div><span className="text-muted-foreground">Chat Name:</span> {selectedAlert.chat_name}</div>
              </div>

              {selectedAlert.ai_summary && (
                <div>
                  <h4 className="text-sm font-semibold mb-1">סיכום</h4>
                  <p className="text-sm text-muted-foreground">{selectedAlert.ai_summary}</p>
                </div>
              )}

              {selectedAlert.ai_recommendation && (
                <div>
                  <h4 className="text-sm font-semibold mb-1">המלצה</h4>
                  <p className="text-sm text-muted-foreground">{selectedAlert.ai_recommendation}</p>
                </div>
              )}

              {selectedAlert.ai_meaning && (
                <div>
                  <h4 className="text-sm font-semibold mb-1">משמעות</h4>
                  <p className="text-sm text-muted-foreground">{selectedAlert.ai_meaning}</p>
                </div>
              )}

              {selectedAlert.ai_social_context && (
                <div>
                  <h4 className="text-sm font-semibold mb-1">Social Context</h4>
                  <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                    {JSON.stringify(selectedAlert.ai_social_context, null, 2)}
                  </pre>
                </div>
              )}

              <div>
                <h4 className="text-sm font-semibold mb-1">ai_analysis (Full JSON)</h4>
                <pre className="text-xs bg-muted p-3 rounded overflow-x-auto max-h-[300px] overflow-y-auto">
                  {selectedAlert.ai_analysis
                    ? JSON.stringify(selectedAlert.ai_analysis, null, 2)
                    : "אין נתונים (ההתראה נותחה לפני שמירת ai_analysis)"}
                </pre>
              </div>

              {selectedAlert.ai_patterns && selectedAlert.ai_patterns.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-1">Patterns</h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedAlert.ai_patterns.map((p, i) => (
                      <Badge key={i} variant="outline" className="text-xs">{p}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedAlert.ai_classification && (
                <div>
                  <h4 className="text-sm font-semibold mb-1">Classification</h4>
                  <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                    {JSON.stringify(selectedAlert.ai_classification, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}
