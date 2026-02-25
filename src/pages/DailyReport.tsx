import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, BarChart3, Brain, Users, Smartphone, Calendar, Mail, Bot, AlertTriangle, Moon, PartyPopper } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getAppIconInfo } from "@/lib/appIcons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DailyMetrics {
  metric_date: string;
  messages_scanned: number;
  stacks_sent_to_ai: number;
  alerts_sent: number;
}

interface TopContact {
  chat_name: string;
  chat_type: string;
  message_count: number;
}

interface TopApp {
  app_name: string;
  package_name: string;
  usage_minutes: number;
}

interface DailyInsights {
  headline: string;
  insights: string[];
  suggested_action: string;
  severity_band: 'calm' | 'watch' | 'intense';
  data_quality: 'good' | 'partial' | 'insufficient';
}

// Timezone-safe helper for Israel time
const getIsraelISO = (offsetDays: number): string => {
  const now = new Date();
  const israelNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
  israelNow.setDate(israelNow.getDate() + offsetDays);
  return israelNow.toISOString().split("T")[0];
};

// Generate date options for today and the last 7 days
const getDateOptions = () => {
  const labels = ["היום", "אתמול", "לפני יומיים", "לפני 3 ימים", "לפני 4 ימים", "לפני 5 ימים", "לפני 6 ימים", "לפני שבוע"];
  
  return labels.map((label, index) => {
    const date = getIsraelISO(-index);
    const formatted = new Date(date).toLocaleDateString('he-IL');
    return {
      value: date,
      label: `${label} (${formatted})`
    };
  });
};

// Format minutes to readable format (same as Dashboard)
const formatMinutes = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')} שעות`;
  }
  return `${mins} דקות`;
};

const DailyReport = () => {
  const navigate = useNavigate();
  const { childId } = useParams<{ childId: string }>();

  const dateOptions = getDateOptions();
  const todayDate = getIsraelISO(0);
  const [selectedDate, setSelectedDate] = useState<string>(getIsraelISO(-1));

  const handleDateChange = (newDate: string) => {
    if (newDate === todayDate) {
      navigate('/dashboard');
    } else {
      setSelectedDate(newDate);
    }
  };
  const [metrics, setMetrics] = useState<DailyMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topContacts, setTopContacts] = useState<TopContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [topApps, setTopApps] = useState<TopApp[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [insights, setInsights] = useState<DailyInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [nightlyReport, setNightlyReport] = useState<{ total_minutes: number; top_app_name: string | null; top_app_package: string | null; top_app_minutes: number | null } | null>(null);
  const [nightlyLoading, setNightlyLoading] = useState(false);

  const fetchMetrics = async () => {
    if (!childId) return;
    
    setLoading(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc('get_child_daily_metrics', {
      p_child_id: childId,
      p_date: selectedDate
    });

    if (rpcError) {
      console.error("Error fetching metrics:", rpcError);
      setError("שגיאה בטעינת הנתונים");
      setLoading(false);
      return;
    }

    setMetrics(data && data.length > 0 ? data[0] : null);
    setLoading(false);
  };

  const fetchTopContacts = async () => {
    if (!childId) return;
    
    setContactsLoading(true);

    const { data, error: rpcError } = await supabase.rpc('get_child_top_contacts', {
      p_child_id: childId,
      p_date: selectedDate,
      p_limit: 3
    });

    if (!rpcError && data) {
      setTopContacts(data);
    } else {
      console.error("Error fetching top contacts:", rpcError);
      setTopContacts([]);
    }
    
    setContactsLoading(false);
  };

  const fetchTopApps = async () => {
    if (!childId) return;
    
    setAppsLoading(true);

    const { data, error: rpcError } = await supabase.rpc('get_child_top_apps', {
      p_child_id: childId,
      p_date: selectedDate,
      p_limit: 3
    });

    if (!rpcError && data) {
      setTopApps(data);
    } else {
      console.error("Error fetching top apps:", rpcError);
      setTopApps([]);
    }
    
    setAppsLoading(false);
  };

  const fetchInsights = async () => {
    if (!childId) return;
    
    const cacheKey = `daily-insights-${childId}-${selectedDate}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsedCache = JSON.parse(cached);
        // Validate cached data has proper insights array
        if (parsedCache && Array.isArray(parsedCache.insights)) {
          console.log('Daily insights: cache hit for', cacheKey);
          setInsights(parsedCache);
          return;
        } else {
          console.log('Daily insights: clearing corrupted cache for', cacheKey);
          sessionStorage.removeItem(cacheKey);
        }
      } catch {
        console.log('Daily insights: clearing invalid cache for', cacheKey);
        sessionStorage.removeItem(cacheKey);
      }
    }
    
    console.log('Daily insights: cache miss, fetching from API for', cacheKey);
    setInsightsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-daily-insights', {
        body: { child_id: childId, date: selectedDate }
      });
      
      if (!error && data) {
        // Validate insights is an array before using
        if (data.insights && !Array.isArray(data.insights)) {
          data.insights = [String(data.insights)];
        }
        setInsights(data);
        sessionStorage.setItem(cacheKey, JSON.stringify(data));
      }
    } catch (err) {
      console.error('Error fetching insights:', err);
    }
    setInsightsLoading(false);
  };

  const fetchNightlyReport = async () => {
    if (!childId) return;
    setNightlyLoading(true);
    const { data, error } = await supabase
      .from("nightly_usage_reports")
      .select("total_minutes, top_app_name, top_app_package, top_app_minutes")
      .eq("child_id", childId)
      .eq("report_date", selectedDate)
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      setNightlyReport(data);
    } else {
      setNightlyReport(null);
    }
    setNightlyLoading(false);
  };

  useEffect(() => {
    fetchMetrics();
    fetchTopContacts();
    fetchTopApps();
    fetchInsights();
    fetchNightlyReport();
  }, [childId, selectedDate]);

  // No child guard
  if (!childId) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto p-8 text-center" dir="rtl">
          <p className="text-muted-foreground">לא נבחר ילד</p>
          <Button onClick={() => navigate("/dashboard")} className="mt-4">
            חזרה לדשבורד
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6" dir="rtl">
        {/* Header with back button */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">
              הדוח היומי
            </h1>
            <p className="text-muted-foreground text-sm">
              סיכום פעילות לתאריך הנבחר
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

        {/* Date Selector */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">מציג נתונים עבור:</span>
          <Select value={selectedDate} onValueChange={handleDateChange}>
            <SelectTrigger className="w-auto min-w-[200px] h-9 px-3 rounded-full bg-card border-border/50 text-sm font-medium">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <SelectValue placeholder="בחר תאריך" />
              </div>
            </SelectTrigger>
            <SelectContent className="bg-popover border-border z-50">
              {dateOptions.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-sm">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Card 1 - Digital Activity (same as Dashboard) */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              פעילות דיגיטלית
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 rounded-lg" />
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-4">
                <p className="text-destructive mb-3">{error}</p>
                <Button variant="outline" size="sm" onClick={fetchMetrics}>
                  נסה שוב
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-2xl font-bold text-foreground">{metrics?.messages_scanned ?? 0}</div>
                  <div className="text-xs text-muted-foreground">הודעות נסרקו</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Bot className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-2xl font-bold text-foreground">{metrics?.stacks_sent_to_ai ?? 0}</div>
                  <div className="text-xs text-muted-foreground">הועברו לניתוח AI</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-2xl font-bold text-foreground">{metrics?.alerts_sent ?? 0}</div>
                  <div className="text-xs text-muted-foreground">התראות נשלחו</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Nightly Usage Card */}
        <Card className={`bg-card border-border ${nightlyReport && nightlyReport.total_minutes > 0 ? 'border-blue-500/30 bg-blue-500/5' : 'border-green-500/30 bg-green-500/5'}`}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <Moon className={`h-5 w-5 ${nightlyReport && nightlyReport.total_minutes > 0 ? 'text-blue-400' : 'text-green-400'}`} />
              שימוש לילי
            </CardTitle>
          </CardHeader>
          <CardContent>
            {nightlyLoading ? (
              <Skeleton className="h-8 w-full" />
            ) : nightlyReport && nightlyReport.total_minutes > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">סה״כ שימוש (00:00–05:00)</span>
                  <span className="font-bold text-foreground">{nightlyReport.total_minutes} דקות</span>
                </div>
                {nightlyReport.top_app_name && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">האפליקציה המובילה</span>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const iconInfo = getAppIconInfo(nightlyReport.top_app_package);
                        const IconComp = iconInfo.icon;
                        return (
                          <>
                            <span className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: iconInfo.bgColor }}>
                              <IconComp className="w-3.5 h-3.5" style={{ color: iconInfo.color }} />
                            </span>
                            <span className="text-sm font-medium text-foreground">{nightlyReport.top_app_name}</span>
                            {nightlyReport.top_app_minutes && (
                              <span className="text-xs text-muted-foreground">({nightlyReport.top_app_minutes} דק׳)</span>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 text-green-400">
                  <PartyPopper className="h-5 w-5" />
                  <span className="font-medium">לא זוהה שימוש לילי 🎉</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">לא נצפה שימוש במכשיר בין 00:00–05:00</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 2 - AI Insights */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <Brain className="h-5 w-5 text-muted-foreground" />
              תובנות AI
              {insights?.severity_band && (
                <Badge 
                  variant={
                    insights.severity_band === 'calm' ? 'default' :
                    insights.severity_band === 'watch' ? 'secondary' : 'destructive'
                  }
                  className="mr-2"
                >
                  {insights.severity_band === 'calm' ? 'שקט' :
                   insights.severity_band === 'watch' ? 'מעקב' : 'אינטנסיבי'}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {insightsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
              </div>
            ) : insights ? (
              <div className="space-y-3">
                <p className="font-medium text-foreground">{insights.headline}</p>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {Array.isArray(insights.insights) && insights.insights.map((insight, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      {insight}
                    </li>
                  ))}
                </ul>
                {insights.suggested_action && (
                  <p className="text-xs text-muted-foreground/80 border-t border-border/50 pt-2 mt-3">
                    {insights.suggested_action}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-2">
                אין מספיק נתונים לתובנות
              </p>
            )}
          </CardContent>
        </Card>

        {/* Card 3 - Top Friends/Chats (same as Dashboard) */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <Users className="h-5 w-5 text-muted-foreground" />
              הקשרים הפעילים ביותר היום
            </CardTitle>
          </CardHeader>
          <CardContent>
            {contactsLoading ? (
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-8 w-24 rounded-full" />
                ))}
              </div>
            ) : topContacts.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-2 mb-3">
                  {topContacts.map((contact, index) => (
                    <span
                      key={index}
                      className="px-3 py-1.5 rounded-full bg-muted text-sm font-medium text-foreground"
                    >
                      {contact.chat_name}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  אלו הקשרים איתם התקיימה מרבית האינטראקציה ביום זה.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-2">
                אין נתונים להיום
              </p>
            )}
          </CardContent>
        </Card>

        {/* Card 4 - App Usage (same as Dashboard) */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <Smartphone className="h-5 w-5 text-muted-foreground" />
              האפליקציות המרכזיות היום
            </CardTitle>
          </CardHeader>
          <CardContent>
            {appsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : topApps.length > 0 ? (
              <div className="space-y-3">
                {topApps.map((app, index) => {
                  const iconInfo = getAppIconInfo(app.package_name);
                  const IconComponent = iconInfo.icon;
                  return (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span 
                          className="w-7 h-7 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: iconInfo.bgColor }}
                        >
                          <IconComponent className="w-4 h-4" style={{ color: iconInfo.color }} />
                        </span>
                        <span className="font-medium text-foreground">{app.app_name}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">{formatMinutes(app.usage_minutes)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-2">
                אין נתונים להיום
              </p>
            )}
          </CardContent>
        </Card>

      </div>
    </DashboardLayout>
  );
};

export default DailyReport;
