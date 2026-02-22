import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardGreeting } from "@/components/dashboard/DashboardGreeting";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Users, User, RefreshCw, BarChart3, Brain, Smartphone, MapPin, Battery, Clock, Mail, Bot, AlertTriangle, Calendar, ChevronLeft, Bell, X, Shield, Star } from "lucide-react";
import { NewAppsCard } from "@/components/dashboard/NewAppsCard";
import { NightlyUsageCard } from "@/components/dashboard/NightlyUsageCard";
import { motion } from "framer-motion";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useSubscription } from "@/hooks/useSubscription";
import { PremiumUpgradeCard } from "@/components/PremiumUpgradeCard";
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
  total_usage_minutes: number | null;
}

interface DailyInsights {
  headline: string;
  insights: string[];
  suggested_action: string;
  severity_band: "calm" | "watch" | "intense";
  data_quality: "good" | "partial" | "insufficient";
}

// Cached dashboard data - keyed by last_seen timestamp
interface CachedDashboardData {
  lastSeen: string;
  snapshot: HomeSnapshot;
  insights: DailyInsights | null;
  cachedAt: number;
}

const DASHBOARD_CACHE_PREFIX = 'dashboard-cache-';

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

// Import from utils for consistent timezone handling
import { getIsraelDate } from "@/lib/utils";

// Map severity_band to Hebrew label
const getSeverityLabel = (band: string): string => {
  switch (band) {
    case "calm": return "שקט";
    case "watch": return "מעקב";
    case "intense": return "אינטנסיבי";
    default: return band;
  }
};

// Push Notification Enrollment Banner Component
const PushNotificationBanner = () => {
  const { isSupported, isSubscribed, isLoading, permission, subscribe } = usePushNotifications();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  // Don't show if: not supported, already subscribed, permission denied, loading, or dismissed
  if (!isSupported || isSubscribed || permission === 'denied' || isLoading || isDismissed) {
    return null;
  }

  // Only show for first-time users (permission === 'default')
  if (permission !== 'default') {
    return null;
  }

  const handleSubscribe = async () => {
    setIsSubscribing(true);
    try {
      await subscribe();
    } finally {
      setIsSubscribing(false);
    }
  };

  return (
    <div className="relative p-4 rounded-xl bg-primary/10 border border-primary/20 animate-fade-in">
      <button
        onClick={() => setIsDismissed(true)}
        className="absolute top-2 left-2 p-1.5 rounded-full hover:bg-primary/10 transition-colors"
        aria-label="סגור"
      >
        <X className="h-4 w-4 text-muted-foreground" />
      </button>
      <div className="flex items-start gap-3 pr-1">
        <div className="p-2 rounded-full bg-primary/20">
          <Bell className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground text-sm">הפעל התראות Push</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            קבל התראות בזמן אמת גם כשהאפליקציה סגורה
          </p>
          <button
            onClick={handleSubscribe}
            disabled={isSubscribing}
            className="mt-2 px-4 py-1.5 text-xs font-medium rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isSubscribing ? 'מפעיל...' : 'הפעל עכשיו'}
          </button>
        </div>
      </div>
    </div>
  );
};

const Index = () => {
  const navigate = useNavigate();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const [selectedChildId, setSelectedChildId] = useState<string>("");
  const [snapshot, setSnapshot] = useState<HomeSnapshot | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(true); // Start with loading to prevent flash
  const [isRefreshing, setIsRefreshing] = useState(false);
  const autoRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [insights, setInsights] = useState<DailyInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [positiveAlert, setPositiveAlert] = useState<{id: number; ai_title: string; ai_summary: string} | null>(null);
  const { isPremium } = useSubscription(selectedChildId || undefined);
  // When child is selected, immediately try to load from cache (sync)
  useEffect(() => {
    if (children.length > 0 && !selectedChildId) {
      const firstChildId = children[0].id;
      setSelectedChildId(firstChildId);
      
      // Synchronously load cache to prevent flash
      const cacheKey = `${DASHBOARD_CACHE_PREFIX}${firstChildId}`;
      const cachedRaw = localStorage.getItem(cacheKey);
      if (cachedRaw) {
        try {
          const cached: CachedDashboardData = JSON.parse(cachedRaw);
          setSnapshot(cached.snapshot);
          setInsights(cached.insights);
          setSnapshotLoading(false);
        } catch (e) {
          // Continue with normal loading
        }
      }
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
      setSnapshotLoading(false); // No children = no snapshot loading
    } finally {
      setLoading(false);
    }
  };

  // Fetch fresh AI insights (no caching logic here - just calls the API)
  const fetchFreshInsights = useCallback(async (childId: string): Promise<DailyInsights | null> => {
    const todayDate = getIsraelDate();
    console.log("[AI Insights] Fetching fresh insights for child:", childId);
    
    try {
      const { data, error } = await supabase.functions.invoke(
        'generate-daily-insights',
        { body: { child_id: childId, date: todayDate } }
      );
      
      if (error) throw error;
      return data;
    } catch (err) {
      console.error("[AI Insights] Error:", err);
      return null;
    }
  }, []);

  // Main fetch function - checks last_seen before fetching all data
  const fetchSnapshot = useCallback(async (showLoadingState = true, forceRefresh = false) => {
    if (!selectedChildId) return;
    
    const cacheKey = `${DASHBOARD_CACHE_PREFIX}${selectedChildId}`;
    
    try {
      // Step 1: Fetch only last_seen to check if data changed
      const { data: currentData, error: checkError } = await supabase
        .from("parent_home_snapshot")
        .select("last_seen")
        .eq("child_id", selectedChildId)
        .maybeSingle();
      
      if (checkError) throw checkError;
      
      const currentLastSeen = currentData?.last_seen;
      
      // Step 2: Check cache
      if (!forceRefresh) {
        const cachedRaw = localStorage.getItem(cacheKey);
        if (cachedRaw && currentLastSeen) {
          try {
            const cached: CachedDashboardData = JSON.parse(cachedRaw);
            
            // If last_seen hasn't changed - use cache!
            if (cached.lastSeen === currentLastSeen) {
              console.log("[Dashboard] Cache hit - last_seen unchanged:", currentLastSeen);
              setSnapshot(cached.snapshot);
              setInsights(cached.insights);
              return { fromCache: true, hasNewData: false };
            }
            
            console.log("[Dashboard] Cache invalidated - last_seen changed:", 
              cached.lastSeen, "→", currentLastSeen);
          } catch (e) {
            console.error("[Dashboard] Cache parse error:", e);
            localStorage.removeItem(cacheKey);
          }
        }
      }
      
      // Step 3: last_seen changed (or no cache) - fetch full data
      if (showLoadingState) {
        setSnapshotLoading(true);
        setInsightsLoading(true);
      }

      // Fetch snapshot and positive alert in parallel
      const [snapshotResult, positiveResult] = await Promise.all([
        supabase
          .from("parent_home_snapshot")
          .select("*")
          .eq("child_id", selectedChildId)
          .maybeSingle(),
        supabase
          .from("alerts")
          .select("id, ai_title, ai_summary")
          .eq("child_id", selectedChildId)
          .eq("alert_type", "positive")
          .is("acknowledged_at", null)
          .eq("is_processed", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ]);

      const { data: fullData, error: snapshotError } = snapshotResult;
      
      if (positiveResult.data) {
        setPositiveAlert(positiveResult.data as any);
      } else {
        setPositiveAlert(null);
      }

      if (snapshotError) throw snapshotError;
      
      if (fullData) {
        const snapshotData: HomeSnapshot = {
          ...fullData,
          top_apps: fullData.top_apps as unknown as TopApp[] | null,
          top_chats: fullData.top_chats as unknown as TopChat[] | null,
        };
        setSnapshot(snapshotData);
        
        // Step 4: Fetch fresh AI insights (only when last_seen changed)
        console.log("[Dashboard] Fetching fresh AI insights...");
        const freshInsights = await fetchFreshInsights(selectedChildId);
        setInsights(freshInsights);
        
        // Step 5: Save to cache
        if (fullData.last_seen) {
          const cacheData: CachedDashboardData = {
            lastSeen: fullData.last_seen,
            snapshot: snapshotData,
            insights: freshInsights,
            cachedAt: Date.now()
          };
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
          console.log("[Dashboard] Cached new data with last_seen:", fullData.last_seen);
        }
        
        return { fromCache: false, hasNewData: true };
      } else {
        setSnapshot(null);
        setInsights(null);
        return { fromCache: false, hasNewData: false };
      }
    } catch (err: any) {
      console.error("Error fetching snapshot:", err);
      return { fromCache: false, hasNewData: false, error: err };
    } finally {
      if (showLoadingState) {
        setSnapshotLoading(false);
        setInsightsLoading(false);
      }
    }
  }, [selectedChildId, fetchFreshInsights]);

  useEffect(() => {
    if (user?.id) {
      fetchChildren();
    }
  }, [user?.id]);

  useEffect(() => {
    if (selectedChildId) {
      // Try to load from cache synchronously first
      const cacheKey = `${DASHBOARD_CACHE_PREFIX}${selectedChildId}`;
      const cachedRaw = localStorage.getItem(cacheKey);
      if (cachedRaw) {
        try {
          const cached: CachedDashboardData = JSON.parse(cachedRaw);
          setSnapshot(cached.snapshot);
          setInsights(cached.insights);
          setSnapshotLoading(false);
        } catch (e) {
          // Continue with normal loading
        }
      }
      // Then fetch to check for updates in background
      fetchSnapshot();
    }
  }, [selectedChildId, fetchSnapshot]);

  // Auto-refresh every 2 hours
  useEffect(() => {
    if (!selectedChildId) return;
    
    // Clear any existing interval
    if (autoRefreshIntervalRef.current) {
      clearInterval(autoRefreshIntervalRef.current);
    }
    
    // Set up new interval
    autoRefreshIntervalRef.current = setInterval(() => {
      console.log("[Dashboard] Auto-refreshing...");
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
    
    const result = await fetchSnapshot(false, false); // Check cache first
    
    if (result?.fromCache) {
      toast.info("אין עדכונים חדשים מהמכשיר");
    } else if (result?.hasNewData) {
      toast.success("הנתונים עודכנו");
    } else {
      toast.info("אין נתונים זמינים");
    }
    
    setTimeout(() => setIsRefreshing(false), 500);
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

        {/* Push Notification Enrollment Banner */}
        <PushNotificationBanner />

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
              <div className="flex flex-col items-center justify-center py-16 space-y-6">
                <motion.div
                  animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Shield className="h-16 w-16 text-primary" />
                </motion.div>
                <div className="text-center space-y-2">
                  <p className="text-lg font-medium text-foreground">בודק את הנתונים...</p>
                  <p className="text-sm text-muted-foreground">עוד רגע הכל מוכן</p>
                </div>
                <div className="flex gap-1.5">
                  {[0, 1, 2].map(i => (
                    <motion.div key={i}
                      className="w-2 h-2 rounded-full bg-primary"
                      animate={{ y: [0, -8, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                    />
                  ))}
                </div>
              </div>
            ) : snapshot ? (
              <>
                {/* Card 1 - Digital Activity (all users) */}
                <Card className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                      <BarChart3 className="h-5 w-5 text-muted-foreground" />
                      פעילות דיגיטלית
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className={`grid ${isPremium ? 'grid-cols-3' : 'grid-cols-2'} gap-4`}>
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
                      {isPremium && (
                        <div className="text-center p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="text-2xl font-bold text-foreground">{snapshot.alerts_sent ?? 0}</div>
                          <div className="text-xs text-muted-foreground">התראות נשלחו</div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {isPremium && (
                  <>
                    {/* Positive Alert Card - Premium only */}
                    {positiveAlert && (
                      <Card className="border-emerald-500/30 bg-emerald-500/5">
                        <CardHeader className="pb-2">
                          <CardTitle className="flex items-center gap-2 text-base font-semibold text-emerald-400">
                            <Star className="h-5 w-5 fill-emerald-400 text-emerald-400" />
                            רגע טוב ✨
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <p className="font-medium text-foreground text-sm">{positiveAlert.ai_title}</p>
                          {positiveAlert.ai_summary && (
                            <p className="text-sm text-muted-foreground line-clamp-2">{positiveAlert.ai_summary}</p>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 p-0 h-auto"
                            onClick={() => navigate("/alerts?tab=positive")}
                          >
                            ראה הכל ←
                          </Button>
                        </CardContent>
                      </Card>
                    )}

                    {/* Summary Links - Premium only */}
                    <Button
                      variant="outline"
                      className="w-full justify-between"
                      onClick={() => navigate(`/daily-report/${selectedChildId}`)}
                    >
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>סיכום אתמול</span>
                      </div>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    {/* AI Insights - Premium only */}
                    <Card className="bg-card border-border">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                          <Brain className="h-5 w-5 text-muted-foreground" />
                          תובנות AI
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

                    {/* Top Friends/Chats - Premium only */}
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
                  </>
                )}

                {/* New Apps & Nightly Usage Cards - shown only when data exists */}
                <NewAppsCard childId={selectedChildId} />
                <NightlyUsageCard childId={selectedChildId} />

                {/* Device Status - always visible, shown first for free users */}
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

                {/* App Usage - always visible */}
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

                {/* Premium Upgrade Card - free users only */}
                {!isPremium && (
                  <PremiumUpgradeCard childName={selectedChild?.name} childId={selectedChildId} />
                )}

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
