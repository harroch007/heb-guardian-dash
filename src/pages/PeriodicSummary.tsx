import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, TrendingUp, Star, BarChart3, Users, Smartphone, Calendar, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PeriodicSummary {
  id: string;
  period_type: string;
  period_start: string;
  period_end: string;
  headline: string;
  insights: string[];
  suggested_action: string | null;
  severity_summary: string | null;
  data_quality: string | null;
  positive_highlights: string[];
  stats_snapshot: any;
  created_at: string;
}

const getSeverityLabel = (severity: string | null): string => {
  switch (severity) {
    case 'calm': return 'שקט';
    case 'mixed': return 'מעורב';
    case 'intense': return 'אינטנסיבי';
    default: return 'לא ידוע';
  }
};

const getSeverityVariant = (severity: string | null): "default" | "secondary" | "destructive" => {
  switch (severity) {
    case 'calm': return 'default';
    case 'mixed': return 'secondary';
    case 'intense': return 'destructive';
    default: return 'secondary';
  }
};

const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('he-IL');
};

const PeriodicSummaryPage = () => {
  const navigate = useNavigate();
  const { childId, type } = useParams<{ childId: string; type: string }>();
  const [summary, setSummary] = useState<PeriodicSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [childName, setChildName] = useState<string>("");

  const periodLabel = type === 'weekly' ? 'שבועי' : 'חודשי';

  useEffect(() => {
    if (!childId || !type) return;
    fetchSummary();
    fetchChildName();
  }, [childId, type]);

  const fetchChildName = async () => {
    const { data } = await supabase
      .from('children')
      .select('name')
      .eq('id', childId)
      .single();
    if (data) setChildName(data.name);
  };

  const fetchSummary = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('child_periodic_summaries' as any)
      .select('*')
      .eq('child_id', childId)
      .eq('period_type', type)
      .order('period_start', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching summary:', error);
    }
    setSummary(data as unknown as PeriodicSummary | null);
    setLoading(false);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-periodic-summary', {
        body: { child_id: childId, period_type: type, trigger: 'manual' },
      });

      if (error) throw error;
      if (data?.success) {
        toast.success(`הסיכום ה${periodLabel} נוצר בהצלחה`);
        await fetchSummary();
      } else if (data?.reason === 'insufficient_data') {
        toast.error('אין מספיק נתונים ליצירת סיכום');
      } else {
        toast.error('שגיאה ביצירת הסיכום');
      }
    } catch (err) {
      console.error('Generate error:', err);
      toast.error('שגיאה ביצירת הסיכום');
    }
    setGenerating(false);
  };

  if (!childId || !type) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto p-8 text-center" dir="rtl">
          <p className="text-muted-foreground">פרמטרים חסרים</p>
          <Button onClick={() => navigate("/dashboard")} className="mt-4">חזרה לדשבורד</Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">
              סיכום {periodLabel}
            </h1>
            <p className="text-muted-foreground text-sm">
              {childName && `${childName} • `}מגמות ותובנות לתקופה
            </p>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            חזרה
          </button>
        </div>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ) : summary ? (
          <>
            {/* Period info */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(summary.period_start)} — {formatDate(summary.period_end)}</span>
              <Badge variant={getSeverityVariant(summary.severity_summary)} className="mr-2">
                {getSeverityLabel(summary.severity_summary)}
              </Badge>
            </div>

            {/* Headline card */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  סיכום
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium text-foreground text-lg">{summary.headline}</p>
                {summary.suggested_action && (
                  <p className="text-sm text-muted-foreground mt-3 pt-3 border-t border-border/50">
                    {summary.suggested_action}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Insights */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <BarChart3 className="h-5 w-5 text-muted-foreground" />
                  תובנות מרכזיות
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {summary.insights.map((insight, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Positive highlights */}
            {summary.positive_highlights && summary.positive_highlights.length > 0 && (
              <Card className="border-emerald-500/30 bg-emerald-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold text-emerald-400">
                    <Star className="h-5 w-5 fill-emerald-400 text-emerald-400" />
                    רגעים חיוביים
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5">
                    {summary.positive_highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                        <span className="text-emerald-400 mt-0.5">✦</span>
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Stats snapshot */}
            {summary.stats_snapshot && (
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-semibold">נתונים מצטברים</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <div className="text-xl font-bold text-foreground">{summary.stats_snapshot.total_messages ?? 0}</div>
                      <div className="text-xs text-muted-foreground">הודעות נסרקו</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <div className="text-xl font-bold text-foreground">{summary.stats_snapshot.total_alerts ?? 0}</div>
                      <div className="text-xs text-muted-foreground">התראות</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <div className="text-xl font-bold text-foreground">{summary.stats_snapshot.total_positive ?? 0}</div>
                      <div className="text-xs text-muted-foreground">אירועים חיוביים</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <div className="text-xl font-bold text-foreground">{summary.stats_snapshot.days_with_data ?? 0}</div>
                      <div className="text-xs text-muted-foreground">ימים עם נתונים</div>
                    </div>
                  </div>

                  {/* Top apps */}
                  {summary.stats_snapshot.top_apps?.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                        <Smartphone className="h-4 w-4 text-muted-foreground" />
                        אפליקציות מובילות
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {summary.stats_snapshot.top_apps.map((app: any, i: number) => (
                          <span key={i} className="px-2.5 py-1 rounded-full bg-muted text-xs text-foreground">
                            {app.name} ({app.minutes} דק׳)
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Top contacts */}
                  {summary.stats_snapshot.top_contacts?.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        קשרים מובילים
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {summary.stats_snapshot.top_contacts.map((c: any, i: number) => (
                          <span key={i} className="px-2.5 py-1 rounded-full bg-muted text-xs text-foreground">
                            {c.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Regenerate button */}
            <div className="flex justify-center pt-2 pb-8">
              <Button variant="outline" onClick={handleGenerate} disabled={generating} className="gap-2">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
                {generating ? 'מייצר סיכום...' : 'צור סיכום מחדש'}
              </Button>
            </div>
          </>
        ) : (
          /* No summary yet */
          <Card className="bg-card border-border">
            <CardContent className="p-8 text-center space-y-4">
              <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto opacity-50" />
              <p className="text-muted-foreground">אין עדיין סיכום {periodLabel}</p>
              <p className="text-sm text-muted-foreground">
                {type === 'weekly'
                  ? 'הסיכום השבועי נוצר אוטומטית כל יום חמישי בערב'
                  : 'הסיכום החודשי נוצר אוטומטית ביום האחרון של כל חודש'}
              </p>
              <Button onClick={handleGenerate} disabled={generating} className="gap-2">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
                {generating ? 'מייצר...' : `צור סיכום ${periodLabel} עכשיו`}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PeriodicSummaryPage;
