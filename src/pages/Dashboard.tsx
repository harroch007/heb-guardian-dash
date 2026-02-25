import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardGreeting } from "@/components/dashboard/DashboardGreeting";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Users, User, BarChart3, Brain, Smartphone, MapPin, Battery, Clock, Mail, Bot, AlertTriangle, Calendar, ChevronLeft, Bell, X, Shield, Star, UserPlus } from "lucide-react";
import { NewAppsCard } from "@/components/dashboard/NewAppsCard";
import { NightlyUsageCard } from "@/components/dashboard/NightlyUsageCard";
import { motion } from "framer-motion";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useFamilySubscription } from "@/hooks/useFamilySubscription";
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
  const { allPremium: isPremium, childCount: familyChildCount } = useFamilySubscription();

  // One-time: clear stale dashboard cache entries on mount to ensure fresh data
  useEffect(() => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(DASHBOARD_CACHE_PREFIX));
    keys.forEach(k => localStorage.removeItem(k));
    console.log("[Dashboard] Cleared", keys.length, "stale cache entries on mount");
  }, []);

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

  // Main fetch function - always fetches fresh snapshot, caches only AI insights by last_seen
  const fetchSnapshot = useCallback(async (showLoadingState = true, forceRefresh = false) => {
    if (!selectedChildId) return;
    
    const cacheKey = `${DASHBOARD_CACHE_PREFIX}${selectedChildId}`;
    
    try {
      if (showLoadingState) {
        setSnapshotLoading(true);
        setInsightsLoading(true);
      }

      // Always fetch snapshot fresh (lightweight view, prevents stale metrics)
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
        
        // AI insights: use cache if last_seen unchanged (expensive call)
        const currentLastSeen = fullData.last_seen;
        let freshInsights: DailyInsights | null = null;
        
        if (!forceRefresh && currentLastSeen) {
          const cachedRaw = localStorage.getItem(cacheKey);
          if (cachedRaw) {
            try {
              const cached: CachedDashboardData = JSON.parse(cachedRaw);
              if (cached.lastSeen === currentLastSeen && cached.insights) {
                console.log("[Dashboard] AI insights cache hit - last_seen unchanged");
                freshInsights = cached.insights;
              }
            } catch (e) {
              localStorage.removeItem(cacheKey);
            }
          }
        }
        
        if (!freshInsights) {
          console.log("[Dashboard] Fetching fresh AI insights...");
          freshInsights = await fetchFreshInsights(selectedChildId);
        }
        setInsights(freshInsights);
        
        // Save to cache (snapshot + insights)
        if (fullData.last_seen) {
          const cacheData: CachedDashboardData = {
            lastSeen: fullData.last_seen,
            snapshot: snapshotData,
            insights: freshInsights,
            cachedAt: Date.now()
          };
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
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

  // Realtime: refresh when new processed alerts arrive for selected child
  useEffect(() => {
    if (!selectedChildId) return;
    
    const channel = supabase
      .channel(`dashboard-alerts-${selectedChildId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'alerts',
          filter: `child_id=eq.${selectedChildId}`,
        },
        (payload) => {
          const newRecord = payload.new as any;
          if (newRecord?.is_processed) {
            console.log("[Dashboard] Realtime: new processed alert, refreshing...");
            fetchSnapshot(false, true); // force refresh, no loading spinner
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedChildId, fetchSnapshot]);

  // Realtime: refresh when device_daily_metrics change for selected child's device
  useEffect(() => {
    const deviceId = snapshot?.device_id;
    if (!deviceId) return;
    
    const channel = supabase
      .channel(`dashboard-metrics-${deviceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'device_daily_metrics',
          filter: `device_id=eq.${deviceId}`,
        },
        () => {
          console.log("[Dashboard] Realtime: device_daily_metrics changed, refreshing...");
          fetchSnapshot(false, true);
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [snapshot?.device_id, fetchSnapshot]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    
    const result = await fetchSnapshot(false, true); // force refresh on manual tap
    
    if (result?.hasNewData) {
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
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4" dir="rtl">
        {/* 1. Greeting + Refresh (compact single row) */}
        <DashboardGreeting onRefresh={handleRefresh} isRefreshing={isRefreshing} />

        {/* Error State */}
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive">
            <p className="font-medium text-sm">שגיאה בטעינת נתונים</p>
            <p className="text-xs opacity-80">{error}</p>
          </div>
        )}

        {/* Push Notification Enrollment Banner */}
        <PushNotificationBanner />

        {loading ? (
          <div className="h-48 rounded-2xl bg-card/50 animate-pulse border border-border/30" />
        ) : children.length > 0 ? (
          <div className="space-y-4 animate-fade-in">
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
                {/* 2. Positive Alert Banner (premium, if exists) */}
                {isPremium && positiveAlert && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <Star className="h-4 w-4 text-emerald-400 flex-shrink-0 fill-emerald-400" />
                    <p className="text-sm text-foreground flex-1 line-clamp-1">{positiveAlert.ai_title}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 h-auto py-1 px-2"
                      onClick={() => navigate("/alerts?tab=positive")}
                    >
                      ←
                    </Button>
                  </div>
                )}

                {/* Device Status — Compact inline row (moved up) */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/30 text-sm">
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="flex items-center gap-1.5 text-foreground">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="truncate max-w-[120px]">{snapshot.address || "לא זמין"}</span>
                    </span>
                    <span className="flex items-center gap-1 text-foreground">
                      <Battery className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      {snapshot.battery_level != null ? `${snapshot.battery_level}%` : "—"}
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground text-xs">
                      <Clock className="h-3 w-3 flex-shrink-0" />
                      {formatLastSeen(snapshot.last_seen)}
                    </span>
                  </div>
                </div>

                {/* Digital Activity — Compact Stats Bar */}
                <div className={`grid ${isPremium ? 'grid-cols-3' : 'grid-cols-2'} gap-2 p-3 rounded-xl bg-muted/30 border border-border/30`}>
                  <div className="text-center">
                    <Mail className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                    <div className="text-xl font-bold text-foreground">{snapshot.messages_scanned ?? 0}</div>
                    <div className="text-[10px] text-muted-foreground">הודעות נסרקו</div>
                  </div>
                  <div className="text-center">
                    <Bot className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                    <div className="text-xl font-bold text-foreground">{snapshot.stacks_sent_to_ai ?? 0}</div>
                    <div className="text-[10px] text-muted-foreground">ניתוח AI</div>
                  </div>
                  {isPremium && (
                    <div className="text-center">
                      <AlertTriangle className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                      <div className="text-xl font-bold text-foreground">{snapshot.notify_effective_today ?? 0}</div>
                      <div className="text-[10px] text-muted-foreground">התראות</div>
                    </div>
                  )}
                </div>

                {isPremium && (
                  <>

                    {/* AI Insights — Hero Card */}
                    <Card className="bg-card border-primary/20 shadow-sm shadow-primary/5">
                      <CardContent className="p-4">
                        {insightsLoading ? (
                          <div className="space-y-2">
                            <div className="h-5 bg-muted/50 rounded animate-pulse w-3/4" />
                            <div className="h-4 bg-muted/50 rounded animate-pulse w-full" />
                            <div className="h-4 bg-muted/50 rounded animate-pulse w-5/6" />
                          </div>
                        ) : insights ? (
                          <div className="space-y-2.5">
                            <div className="flex items-center gap-2">
                              <Brain className="h-4 w-4 text-primary" />
                              <p className="text-base font-semibold text-foreground">{insights.headline}</p>
                            </div>
                            <ul className="space-y-1">
                              {insights.insights.map((insight, idx) => (
                                <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                                  <span className="text-primary mt-0.5">•</span>
                                  <span>{insight}</span>
                                </li>
                              ))}
                            </ul>
                            {insights.suggested_action && (
                              <p className="text-xs text-muted-foreground/80 pt-2 border-t border-border/50">
                                {insights.suggested_action}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-2">
                            <div className="flex items-center justify-center gap-2 mb-1">
                              <Brain className="h-4 w-4 text-muted-foreground" />
                              <p className="font-medium text-sm text-muted-foreground">אין מספיק נתונים לתובנות</p>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              תובנות יופיעו לאחר הצטברות פעילות מספקת.
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Top Contacts — Compact pills (collapse if empty) */}
                    {topChats.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 pr-1">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs font-medium text-muted-foreground">הצ'אטים הפעילים ביותר</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {topChats.map((chat, index) => (
                            <span
                              key={index}
                              className="px-2.5 py-1 rounded-full bg-muted/60 text-xs font-medium text-foreground"
                            >
                              {chat.chat_name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* 8. Top Apps — With mini progress bars */}
                {topApps.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 pr-1">
                      <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">אפליקציות מובילות</span>
                    </div>
                    <div className="space-y-2">
                      {topApps.map((app, index) => {
                        const iconInfo = getAppIconInfo(app.package_name);
                        const IconComponent = iconInfo.icon;
                        const maxMinutes = topApps[0]?.usage_minutes || 1;
                        const percent = Math.round((app.usage_minutes / maxMinutes) * 100);
                        return (
                          <div key={index} className="flex items-center gap-2.5">
                            <span 
                              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: iconInfo.bgColor }}
                            >
                              <IconComponent className="w-3.5 h-3.5" style={{ color: iconInfo.color }} />
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-sm font-medium text-foreground truncate">{app.app_name}</span>
                                <span className="text-xs text-muted-foreground mr-2">{formatMinutes(app.usage_minutes)}</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                                <motion.div
                                  className="h-full rounded-full"
                                  style={{ backgroundColor: iconInfo.color }}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${percent}%` }}
                                  transition={{ duration: 0.6, delay: index * 0.1 }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 9. New Apps & Nightly Usage (conditional) */}
                <NewAppsCard childId={selectedChildId} />
                <NightlyUsageCard childId={selectedChildId} />

                {/* 10. Premium Upgrade Card - free users only */}
                {!isPremium && (
                  <PremiumUpgradeCard childCount={familyChildCount} />
                )}
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
          <motion.div
            className="rounded-2xl bg-gradient-to-b from-primary/10 to-card border border-primary/20 text-center px-6 py-10"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-5">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">
              ברוכים הבאים ל-Kippy! 👋
            </h2>
            <p className="text-muted-foreground text-sm mb-8 max-w-sm mx-auto">
              כדי להתחיל להגן על הילדים שלכם ברשת, הוסיפו ילד וחברו את המכשיר שלו
            </p>

            <div className="flex justify-center gap-4 mb-8">
              {[
                { icon: UserPlus, label: "הוסיפו ילד", step: "1" },
                { icon: Smartphone, label: "חברו מכשיר", step: "2" },
                { icon: Bell, label: "קבלו התראות", step: "3" },
              ].map((item) => (
                <div key={item.step} className="flex flex-col items-center gap-2 w-24">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center relative">
                    <item.icon className="w-5 h-5 text-primary" />
                    <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                      {item.step}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">{item.label}</span>
                </div>
              ))}
            </div>

            <Button onClick={() => navigate("/family")} size="lg" className="gap-2 mb-3">
              <Plus className="w-4 h-4" />
              הוסיפו את הילד הראשון
            </Button>
            <p className="text-xs text-muted-foreground">זה לוקח פחות מדקה ⏱️</p>
          </motion.div>
        )}
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-muted-foreground text-center mt-4 px-4">
        הנתונים מתעדכנים אוטומטית כל ~15 דקות. התראות בטיחות מתקבלות באופן מיידי.
      </p>
      {isPremium && selectedChildId && (
        <button
          onClick={() => navigate(`/daily-report/${selectedChildId}`)}
          className="flex items-center justify-center mx-auto gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mt-2 mb-8"
        >
          <Calendar className="h-3.5 w-3.5" />
          <span>צפה בסיכום של אתמול</span>
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
      )}
      {!(isPremium && selectedChildId) && <div className="mb-8" />}
    </DashboardLayout>
  );
};

export default Index;
