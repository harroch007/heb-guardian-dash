import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardGreeting } from "@/components/dashboard/DashboardGreeting";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Users, User, RefreshCw, BarChart3, Brain, Smartphone, TrendingUp, MapPin, Battery, Clock, Mail, Bot, AlertTriangle, Calendar, ChevronLeft } from "lucide-react";

// Auto-refresh interval: 2 hours in milliseconds
const AUTO_REFRESH_INTERVAL = 2 * 60 * 60 * 1000;
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getAppIconInfo } from "@/lib/appIcons";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Child {
  id: string;
  name: string;
  parent_id: string;
  date_of_birth: string;
}

interface TopApp {
  app_name: string;
  package_name?: string;
  usage_minutes: number;
}

interface TopChat {
  chat_name: string;
  message_count: number;
}

interface HomeSnapshot {
  child_id: string;
  child_name: string;
  device_id: string;
  messages_scanned: number | null;
  stacks_sent_to_ai: number | null;
  alerts_sent: number | null;
  notify_effective_today: number | null;
  top_apps: TopApp[] | null;
  top_chats: TopChat[] | null;
  address: string | null;
  battery_level: number | null;
  last_seen: string | null;
}

interface DailyInsights {
  headline: string;
  insights: string[];
  suggested_action: string;
  severity_band: "calm" | "watch" | "intense";
  data_quality: "good" | "partial" | "insufficient";
}

// Format minutes to readable format
const formatMinutes = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')} שעות`;
  }
  return `${mins} דקות`;
};

// Format last_seen timestamp to relative time
const formatLastSeen = (timestamp: string | null): string => {
  if (!timestamp) return "לא זמין";
  
  const now = new Date();
  const seen = new Date(timestamp);
  const diffMinutes = Math.floor((now.getTime() - seen.getTime()) / 60000);
  
  if (diffMinutes < 1) return "עכשיו";
  if (diffMinutes < 60) return `לפני ${diffMinutes} דקות`;
  const hours = Math.floor(diffMinutes / 60);
  if (hours < 24) return `לפני ${hours} שעות`;
  const days = Math.floor(hours / 24);
  return `לפני ${days} ימים`;
};

// Get Israel date in ISO format (YYYY-MM-DD)
const getIsraelISODate = (): string => {
  return new Intl.DateTimeFormat('en-CA', { 
    timeZone: 'Asia/Jerusalem' 
  }).format(new Date());
};

// Map severity_band to Hebrew label
const getSeverityLabel = (band: string): string => {
  switch (band) {
    case "calm": return "שקט";
    case "watch": return "מעקב";
    case "intense": return "אינטנסיבי";
    default: return band;
  }
};

const Index = () => {
  const navigate = useNavigate();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const [selectedChildId, setSelectedChildId] = useState<string>("");
  const [snapshot, setSnapshot] = useState<HomeSnapshot | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const autoRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [insights, setInsights] = useState<DailyInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  useEffect(() => {
    if (children.length > 0 && !selectedChildId) {
      setSelectedChildId(children[0].id);
    }
  }, [children, selectedChildId]);

  const selectedChild = children.find(c => c.id === selectedChildId);

  const calculateAge = (dateOfBirth: string): number => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const fetchChildren = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: childrenData, error: childrenError } = await supabase
        .from("children")
        .select("id, name, parent_id, date_of_birth")
        .eq("parent_id", user?.id)
        .order("created_at", { ascending: false });

      if (childrenError) throw childrenError;
      setChildren(childrenData || []);
    } catch (err: any) {
      console.error("Error fetching children:", err);
      setError(err.message || "שגיאה בטעינת נתונים");
    } finally {
      setLoading(false);
    }
  };

  const fetchSnapshot = useCallback(async (showLoadingState = true) => {
    if (!selectedChildId) return;
    
    try {
      if (showLoadingState) {
        setSnapshotLoading(true);
      }

      const { data, error: snapshotError } = await supabase
        .from("parent_home_snapshot")
        .select("*")
        .eq("child_id", selectedChildId)
        .maybeSingle();

      if (snapshotError) throw snapshotError;
      
      // Cast the data to our interface, handling the JSON fields
      if (data) {
        setSnapshot({
          ...data,
          top_apps: data.top_apps as unknown as TopApp[] | null,
          top_chats: data.top_chats as unknown as TopChat[] | null,
        });
      } else {
        setSnapshot(null);
      }
      
      // Update last refresh time
      setLastRefresh(new Date());
    } catch (err: any) {
      console.error("Error fetching snapshot:", err);
      // Don't set error for snapshot - just show no data
    } finally {
      if (showLoadingState) {
        setSnapshotLoading(false);
      }
    }
  }, [selectedChildId]);

  useEffect(() => {
    if (user?.id) {
      fetchChildren();
    }
  }, [user?.id]);

  useEffect(() => {
    if (selectedChildId) {
      fetchSnapshot();
    }
  }, [selectedChildId, fetchSnapshot]);

  const fetchInsights = useCallback(async () => {
    if (!selectedChildId) return;
    
    const todayDate = getIsraelISODate();
    const cacheKey = `daily-insights-${selectedChildId}-${todayDate}`;
    
    // Check cache first
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        console.log("[AI Insights] cache hit:", cacheKey);
        setInsights(JSON.parse(cached));
        return;
      } catch (e) {
        sessionStorage.removeItem(cacheKey);
      }
    }
    
    console.log("[AI Insights] cache miss:", cacheKey);
    setInsightsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        'generate-daily-insights',
        { body: { child_id: selectedChildId, date: todayDate } }
      );
      
      if (error) throw error;
      
      if (data) {
        setInsights(data);
        sessionStorage.setItem(cacheKey, JSON.stringify(data));
      }
    } catch (err) {
      console.error("[AI Insights] Error:", err);
      setInsights(null);
    } finally {
      setInsightsLoading(false);
    }
  }, [selectedChildId]);

  useEffect(() => {
    if (selectedChildId) {
      fetchInsights();
    }
  }, [selectedChildId, fetchInsights]);

  // Auto-refresh every 2 hours
  useEffect(() => {
    if (!selectedChildId) return;
    
    // Clear any existing interval
    if (autoRefreshIntervalRef.current) {
      clearInterval(autoRefreshIntervalRef.current);
    }
    
    // Set up new interval
    autoRefreshIntervalRef.current = setInterval(() => {
      console.log("Auto-refreshing dashboard data...");
      fetchSnapshot(false); // Don't show loading state for auto-refresh
    }, AUTO_REFRESH_INTERVAL);
    
    // Cleanup on unmount or when child changes
    return () => {
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current);
      }
    };
  }, [selectedChildId, fetchSnapshot]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchSnapshot(false); // Don't show full loading state
    toast.success("הנתונים עודכנו");
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Format last refresh time
  const formatLastRefresh = (): string => {
    if (!lastRefresh) return "";
    return formatLastSeen(lastRefresh.toISOString());
  };

  // Derived data from snapshot
  const topApps = snapshot?.top_apps?.slice(0, 3) || [];
  const topChats = snapshot?.top_chats?.slice(0, 3) || [];

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-start justify-between">
          <DashboardGreeting />
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive">
            <p className="font-medium">שגיאה בטעינת נתונים</p>
            <p className="text-sm opacity-80">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="h-48 rounded-2xl bg-card/50 animate-pulse border border-border/30" />
        ) : children.length > 0 ? (
          <div className="space-y-6 animate-fade-in">
            {/* Child Selector - shown only when more than 1 child */}
            {children.length > 1 && selectedChild && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">מציג נתונים עבור:</span>
                <Select value={selectedChildId} onValueChange={setSelectedChildId}>
                  <SelectTrigger className="w-auto min-w-[140px] h-9 px-3 rounded-full bg-card border-border/50 text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <Avatar className="w-6 h-6">
                        <AvatarFallback className="bg-muted">
                          <User className="w-3.5 h-3.5 text-muted-foreground" />
                        </AvatarFallback>
                      </Avatar>
                      <span>
                        {selectedChild.name}
                        {selectedChild.date_of_birth && ` (${calculateAge(selectedChild.date_of_birth)})`}
                      </span>
                    </div>
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border z-50">
                    {children.map((child) => (
                      <SelectItem key={child.id} value={child.id} className="text-sm">
                        <div className="flex items-center gap-2">
                          <Avatar className="w-6 h-6">
                            <AvatarFallback className="bg-muted">
                              <User className="w-3.5 h-3.5 text-muted-foreground" />
                            </AvatarFallback>
                          </Avatar>
                          <span>
                            {child.name}
                            {child.date_of_birth && ` (${calculateAge(child.date_of_birth)})`}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {snapshotLoading ? (
              <div className="space-y-4">
                <div className="h-32 rounded-xl bg-card/50 animate-pulse border border-border/30" />
                <div className="h-24 rounded-xl bg-card/50 animate-pulse border border-border/30" />
                <div className="h-24 rounded-xl bg-card/50 animate-pulse border border-border/30" />
              </div>
            ) : snapshot ? (
              <>
                {/* Card 1 - Digital Activity */}
                <Card className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                      <BarChart3 className="h-5 w-5 text-muted-foreground" />
                      פעילות דיגיטלית
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="text-2xl font-bold text-foreground">{snapshot.messages_scanned ?? 0}</div>
                        <div className="text-xs text-muted-foreground">הודעות נסרקו</div>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <Bot className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="text-2xl font-bold text-foreground">{snapshot.stacks_sent_to_ai ?? 0}</div>
                        <div className="text-xs text-muted-foreground">הועברו לניתוח AI</div>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="text-2xl font-bold text-foreground">{snapshot.notify_effective_today ?? 0}</div>
                        <div className="text-xs text-muted-foreground">התראות נשלחו</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Yesterday Summary Button */}
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => navigate(`/daily-report/${selectedChildId}`)}
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>צפה בסיכום של אתמול</span>
                  </div>
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                {/* Card 2 - AI Insights */}
                <Card className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-lg font-semibold">
                        <Brain className="h-5 w-5 text-muted-foreground" />
                        תובנות AI
                      </div>
                      {insights?.severity_band && (
                        <Badge variant="secondary">
                          {getSeverityLabel(insights.severity_band)}
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {insightsLoading ? (
                      <div className="space-y-2">
                        <div className="h-5 bg-muted/50 rounded animate-pulse w-3/4" />
                        <div className="h-4 bg-muted/50 rounded animate-pulse w-full" />
                        <div className="h-4 bg-muted/50 rounded animate-pulse w-5/6" />
                      </div>
                    ) : insights ? (
                      <div className="space-y-3">
                        <p className="font-medium text-foreground">{insights.headline}</p>
                        <ul className="space-y-1.5">
                          {insights.insights.map((insight, idx) => (
                            <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                              <span className="text-primary mt-1">•</span>
                              <span>{insight}</span>
                            </li>
                          ))}
                        </ul>
                        {insights.suggested_action && (
                          <p className="text-sm text-muted-foreground/80 pt-2 border-t border-border">
                            {insights.suggested_action}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-2">
                        <p className="font-medium text-muted-foreground">אין מספיק נתונים לתובנות להיום</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          המערכת תציג תובנות לאחר הצטברות פעילות מספקת.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Card 3 - Top Friends/Chats */}
                <Card className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                      <Users className="h-5 w-5 text-muted-foreground" />
                      הקשרים הפעילים ביותר היום
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {topChats.length > 0 ? (
                      <>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {topChats.map((chat, index) => (
                            <span
                              key={index}
                              className="px-3 py-1.5 rounded-full bg-muted text-sm font-medium text-foreground"
                            >
                              {chat.chat_name}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          אלו הקשרים איתם התקיימה מרבית האינטראקציה היום.
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        אין נתונים להיום
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Card 4 - App Usage */}
                <Card className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                      <Smartphone className="h-5 w-5 text-muted-foreground" />
                      האפליקציות המרכזיות היום
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {topApps.length > 0 ? (
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

                {/* Card 5 - Daily Context (static for now) */}
                <Card className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                      <TrendingUp className="h-5 w-5 text-muted-foreground" />
                      הקשר יומי
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground text-center py-2">
                      ההקשר היומי יופיע כאן בקרוב
                    </p>
                  </CardContent>
                </Card>

                {/* Card 6 - Device Status */}
                <Card className="bg-muted/30 border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                      <Smartphone className="h-5 w-5 text-muted-foreground" />
                      מצב המכשיר
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-foreground">מיקום אחרון: {snapshot.address || "לא זמין"}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Battery className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-foreground">סוללה: {snapshot.battery_level ?? "לא זמין"}%</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-foreground">עדכון אחרון: {formatLastSeen(snapshot.last_seen)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                      הנתונים משקפים את המצב האחרון שדווח מהמכשיר.
                    </p>
                  </CardContent>
                </Card>

                {/* Bottom CTA */}
                <div className="flex justify-center pt-4 pb-8">
                  <Button
                    variant="outline"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="gap-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                    רענון נתונים
                  </Button>
                </div>
              </>
            ) : (
              /* No snapshot data yet */
              <Card className="bg-card border-border">
                <CardContent className="p-8 text-center">
                  <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-muted-foreground mb-2">אין נתונים להיום עדיין</p>
                  <p className="text-sm text-muted-foreground">
                    הנתונים יופיעו כאן לאחר שהמכשיר יתחיל לשלוח מידע
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <div className="p-8 rounded-2xl bg-card border border-border/50 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground mb-4">אין ילדים רשומים</p>
            <Button onClick={() => navigate("/family")} className="gap-2">
              <Plus className="w-4 h-4" />
              הוסף ילד
            </Button>
          </div>
        )}
          </div>

          {/* Disclaimer */}
          <p className="text-xs text-muted-foreground text-center mt-8">
            הנתונים מתעדכנים אוטומטית כל ~15 דקות. התראות בטיחות מתקבלות באופן מיידי.
          </p>
    </DashboardLayout>
  );
};

export default Index;
