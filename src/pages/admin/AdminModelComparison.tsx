import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Loader2, Plus, Trash2, RefreshCw, Star } from "lucide-react";
import { toast } from "sonner";

interface ModelConfig {
  id: string;
  model_name: string;
  is_default: boolean;
  weight: number;
  description: string | null;
}

interface ChildWithOverride {
  id: string;
  name: string;
  parent_name: string;
  override_model: string | null;
}

interface ModelKPI {
  model: string;
  count: number;
  avg_risk: number;
  avg_confidence: number;
  avg_summary_len: number;
  verdicts: Record<string, number>;
}

export function AdminModelComparison() {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [children, setChildren] = useState<ChildWithOverride[]>([]);
  const [kpis, setKpis] = useState<ModelKPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [newModelName, setNewModelName] = useState("");
  const [newModelDesc, setNewModelDesc] = useState("");
  const [savingWeight, setSavingWeight] = useState<string | null>(null);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchModels(), fetchChildren(), fetchKPIs()]);
    setLoading(false);
  };

  const fetchModels = async () => {
    const { data } = await supabase
      .from("ai_model_config")
      .select("*")
      .order("created_at");
    if (data) setModels(data as unknown as ModelConfig[]);
  };

  const fetchChildren = async () => {
    const { data: childrenData } = await supabase
      .from("children")
      .select("id, name, parent_id")
      .order("name");

    if (!childrenData) return;

    const { data: parents } = await supabase
      .from("parents")
      .select("id, full_name");

    const { data: overrides } = await supabase
      .from("child_model_override")
      .select("child_id, model_name");

    const parentMap = new Map((parents || []).map((p: any) => [p.id, p.full_name]));
    const overrideMap = new Map((overrides || []).map((o: any) => [o.child_id, o.model_name]));

    setChildren(
      childrenData.map((c: any) => ({
        id: c.id,
        name: c.name,
        parent_name: parentMap.get(c.parent_id) || "—",
        override_model: overrideMap.get(c.id) || null,
      }))
    );
  };

  const fetchKPIs = async () => {
    const { data: alerts } = await supabase
      .from("alerts")
      .select("ai_analysis, ai_risk_score, ai_confidence, ai_summary, ai_verdict")
      .not("ai_verdict", "is", null)
      .order("id", { ascending: false })
      .limit(500);

    if (!alerts) return;

    const byModel: Record<string, { scores: number[]; confidences: number[]; summaryLens: number[]; verdicts: Record<string, number> }> = {};

    for (const a of alerts) {
      const analysis = a.ai_analysis as Record<string, unknown> | null;
      const modelUsed = (analysis?.model_used as string) || "gpt-4o-mini (legacy)";

      if (!byModel[modelUsed]) {
        byModel[modelUsed] = { scores: [], confidences: [], summaryLens: [], verdicts: {} };
      }
      const m = byModel[modelUsed];
      if (typeof a.ai_risk_score === "number") m.scores.push(a.ai_risk_score);
      if (typeof a.ai_confidence === "number") m.confidences.push(a.ai_confidence);
      if (a.ai_summary) m.summaryLens.push(a.ai_summary.length);
      if (a.ai_verdict) m.verdicts[a.ai_verdict] = (m.verdicts[a.ai_verdict] || 0) + 1;
    }

    const kpiList: ModelKPI[] = Object.entries(byModel).map(([model, data]) => ({
      model,
      count: data.scores.length || Object.values(data.verdicts).reduce((s, v) => s + v, 0),
      avg_risk: data.scores.length ? Math.round(data.scores.reduce((s, v) => s + v, 0) / data.scores.length) : 0,
      avg_confidence: data.confidences.length ? +(data.confidences.reduce((s, v) => s + v, 0) / data.confidences.length).toFixed(2) : 0,
      avg_summary_len: data.summaryLens.length ? Math.round(data.summaryLens.reduce((s, v) => s + v, 0) / data.summaryLens.length) : 0,
      verdicts: data.verdicts,
    }));

    setKpis(kpiList.sort((a, b) => b.count - a.count));
  };

  const addModel = async () => {
    if (!newModelName.trim()) return;
    const { error } = await supabase.from("ai_model_config").insert({
      model_name: newModelName.trim(),
      description: newModelDesc.trim() || null,
      weight: 0,
      is_default: false,
    } as any);
    if (error) {
      toast.error("שגיאה בהוספת מודל: " + error.message);
    } else {
      toast.success("מודל נוסף");
      setNewModelName("");
      setNewModelDesc("");
      await fetchModels();
    }
  };

  const updateWeight = async (id: string, weight: number) => {
    setSavingWeight(id);
    await supabase.from("ai_model_config").update({ weight } as any).eq("id", id);
    setSavingWeight(null);
    await fetchModels();
  };

  const setDefault = async (id: string) => {
    await supabase.from("ai_model_config").update({ is_default: false } as any).neq("id", id);
    await supabase.from("ai_model_config").update({ is_default: true } as any).eq("id", id);
    toast.success("ברירת מחדל עודכנה");
    await fetchModels();
  };

  const deleteModel = async (id: string) => {
    await supabase.from("ai_model_config").delete().eq("id", id);
    toast.success("מודל נמחק");
    await fetchModels();
  };

  const setChildOverride = async (childId: string, modelName: string | null) => {
    if (modelName === null || modelName === "auto") {
      await supabase.from("child_model_override").delete().eq("child_id", childId);
    } else {
      await supabase.from("child_model_override").upsert(
        { child_id: childId, model_name: modelName } as any,
        { onConflict: "child_id" }
      );
    }
    toast.success("שיוך עודכן");
    await fetchChildren();
  };

  const clearAllOverrides = async () => {
    const { error } = await supabase.from("child_model_override").delete().neq("child_id", "00000000-0000-0000-0000-000000000000");
    if (!error) {
      toast.success("כל השיוכים נוקו");
      await fetchChildren();
    }
  };

  const VERDICT_COLORS: Record<string, string> = {
    safe: "bg-green-500/20 text-green-400",
    monitor: "bg-purple-500/20 text-purple-400",
    review: "bg-yellow-500/20 text-yellow-400",
    notify: "bg-red-500/20 text-red-400",
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Model Management */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">ניהול מודלים</CardTitle>
            <Button variant="outline" size="sm" onClick={fetchAll}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">מודל</TableHead>
                <TableHead className="text-right">תיאור</TableHead>
                <TableHead className="text-right">Weight</TableHead>
                <TableHead className="text-right">ברירת מחדל</TableHead>
                <TableHead className="text-right">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {models.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-sm">{m.model_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{m.description || "—"}</TableCell>
                  <TableCell className="w-48">
                    <div className="flex items-center gap-2" dir="ltr">
                      <Slider
                        value={[m.weight]}
                        max={100}
                        step={5}
                        onValueCommit={(v) => updateWeight(m.id, v[0])}
                        className="flex-1"
                      />
                      <span className="text-xs font-mono w-8 text-center">
                        {savingWeight === m.id ? "..." : m.weight}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {m.is_default ? (
                      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    ) : (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDefault(m.id)}>
                        <Star className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    {!m.is_default && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteModel(m.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center gap-2 flex-wrap">
            <Input
              className="w-40"
              placeholder="שם מודל (e.g. gpt-4o)"
              value={newModelName}
              onChange={(e) => setNewModelName(e.target.value)}
            />
            <Input
              className="w-48"
              placeholder="תיאור (אופציונלי)"
              value={newModelDesc}
              onChange={(e) => setNewModelDesc(e.target.value)}
            />
            <Button size="sm" onClick={addModel} disabled={!newModelName.trim()}>
              <Plus className="w-4 h-4 ml-1" />
              הוסף מודל
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Child Assignment */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">שיוך ילדים למודלים</CardTitle>
            <Button variant="outline" size="sm" onClick={clearAllOverrides}>
              נקה כל שיוכים
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">ילד</TableHead>
                <TableHead className="text-right">הורה</TableHead>
                <TableHead className="text-right">מודל נוכחי</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {children.map((child) => (
                <TableRow key={child.id}>
                  <TableCell className="font-medium">{child.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{child.parent_name}</TableCell>
                  <TableCell>
                    <Select
                      value={child.override_model || "auto"}
                      onValueChange={(v) => setChildOverride(child.id, v === "auto" ? null : v)}
                    >
                      <SelectTrigger className="w-44 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">🔄 אוטומטי (weights)</SelectItem>
                        {models.map((m) => (
                          <SelectItem key={m.model_name} value={m.model_name}>
                            {m.model_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Performance Comparison */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">השוואת ביצועים (500 התראות אחרונות)</CardTitle>
        </CardHeader>
        <CardContent>
          {kpis.length === 0 ? (
            <p className="text-sm text-muted-foreground">אין עדיין נתוני מודלים</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {kpis.map((kpi) => (
                <Card key={kpi.model} className="bg-muted/30">
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-mono text-sm font-semibold">{kpi.model}</h4>
                      <Badge variant="outline">{kpi.count} התראות</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div>
                        <div className="text-muted-foreground">ציון ממוצע</div>
                        <div className="text-lg font-bold">{kpi.avg_risk}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Confidence</div>
                        <div className="text-lg font-bold">{kpi.avg_confidence}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">אורך סיכום</div>
                        <div className="text-lg font-bold">{kpi.avg_summary_len}</div>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {Object.entries(kpi.verdicts).map(([v, count]) => (
                        <Badge key={v} className={`text-xs ${VERDICT_COLORS[v] || ""}`}>
                          {v}: {count}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
