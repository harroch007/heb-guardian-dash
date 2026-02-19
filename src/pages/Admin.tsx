import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, LogOut, Shield, LayoutDashboard, Users, UserPlus, Database, Brain } from "lucide-react";
import kippyLogo from "@/assets/kippy-logo.svg";
import { AdminOverview } from "./admin/AdminOverview";
import { AdminUsers } from "./admin/AdminUsers";
import { AdminWaitlist } from "./admin/AdminWaitlist";
import { AdminTraining } from "./admin/AdminTraining";
import { AdminInsightStats } from "./admin/AdminInsightStats";
import { format, subDays } from "date-fns";

interface TrainingRecord {
  id: string;
  alert_id: number | null;
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

interface TrainingStats {
  total: number;
  systemAlertCount: number;
  byGender: { name: string; value: number }[];
  byAge: { age: string; count: number }[];
  byVerdict: { name: string; value: number; color: string }[];
  byRiskLevel: { level: string; count: number }[];
  classificationCounts: { name: string; count: number }[];
}

interface OverviewStats {
  totalParents: number;
  totalWaitlist: number;
  totalDevices: number;
  totalAlertsToday: number;
  criticalAlertsToday: number;
  activeUsersToday: number;
  conversionRate: number;
  alertsByVerdict: { name: string; value: number; color: string }[];
  alertsTrend: { date: string; safe: number; review: number; notify: number }[];
  funnel: { stage: string; count: number }[];
  activeChildrenToday: number;
  activeParentsThisWeek: number;
  messagesScannedToday: number;
  alertsSentToday: number;
  feedbackTrend: { date: string; total: number; important: number; not_relevant: number }[];
  totalAlertsLast7Days: number;
  alertsWithFeedbackLast7Days: number;
  feedbackEngagementRate: number;
}

interface UserData {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  children: { id: string; name: string; gender: string }[];
  devices: { device_id: string; last_seen: string | null; battery_level: number | null }[];
  device_status: 'online' | 'today' | 'offline' | 'no_device';
  last_activity: string | null;
}

interface WaitlistEntry {
  id: string;
  parent_name: string;
  email: string;
  phone: string;
  child_age: number;
  device_os: string;
  region: string | null;
  referral_source: string | null;
  status: string | null;
  created_at: string;
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
  const [overviewStats, setOverviewStats] = useState<OverviewStats | null>(null);
  const [users, setUsers] = useState<UserData[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [trainingStats, setTrainingStats] = useState<TrainingStats | null>(null);
  const [trainingRecords, setTrainingRecords] = useState<TrainingRecord[]>([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [usersStatusFilter, setUsersStatusFilter] = useState<string | undefined>(undefined);
  const navigate = useNavigate();

  const handleOverviewNavigate = (tab: string, filter?: string) => {
    setActiveTab(tab);
    if (tab === "users" && filter) {
      setUsersStatusFilter(filter);
    } else {
      setUsersStatusFilter(undefined);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchOverviewStats(),
      fetchUsers(),
      fetchWaitlist(),
      fetchTrainingStats(),
    ]);
    setLoading(false);
  };

  const fetchOverviewStats = async () => {
    try {
      // Fetch parents count
      const { count: parentsCount } = await supabase
        .from("parents")
        .select("*", { count: "exact", head: true });

      // Fetch waitlist count
      const { count: waitlistCount } = await supabase
        .from("waitlist_signups")
        .select("*", { count: "exact", head: true });

      // Fetch devices count
      const { count: devicesCount } = await supabase
        .from("devices")
        .select("*", { count: "exact", head: true })
        .not("child_id", "is", null);

      // Fetch today's alerts
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data: alertsToday } = await supabase
        .from("alerts")
        .select("ai_verdict, ai_risk_score")
        .gte("created_at", today.toISOString());

      const totalAlertsToday = alertsToday?.length || 0;
      const criticalAlertsToday = alertsToday?.filter(a => a.ai_verdict === 'notify').length || 0;

      // Count active users (devices with last_seen in last 24 hours)
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const { count: activeCount } = await supabase
        .from("devices")
        .select("*", { count: "exact", head: true })
        .gte("last_seen", yesterday.toISOString());

      // Alerts by verdict
      const verdictCounts: Record<string, number> = { safe: 0, review: 0, notify: 0 };
      alertsToday?.forEach(alert => {
        if (alert.ai_verdict && verdictCounts[alert.ai_verdict] !== undefined) {
          verdictCounts[alert.ai_verdict]++;
        }
      });

      // NEW KPIs: Active children today (distinct children in device_daily_metrics for today)
      const todayStr = format(new Date(), "yyyy-MM-dd");
      const { data: metricsToday } = await supabase
        .from("device_daily_metrics")
        .select("device_id")
        .eq("metric_date", todayStr);
      
      // Get child_ids from devices for those device_ids
      const metricDeviceIds = [...new Set(metricsToday?.map(m => m.device_id) || [])];
      let activeChildrenToday = 0;
      if (metricDeviceIds.length > 0) {
        const { data: devicesWithChildren } = await supabase
          .from("devices")
          .select("child_id")
          .in("device_id", metricDeviceIds)
          .not("child_id", "is", null);
        activeChildrenToday = new Set(devicesWithChildren?.map(d => d.child_id)).size;
      }

      // Active parents this week (distinct parents with alerts in last 7 days)
      const weekAgo = subDays(new Date(), 7);
      const { data: weekAlerts } = await supabase
        .from("alerts")
        .select("child_id")
        .gte("created_at", weekAgo.toISOString())
        .not("child_id", "is", null);
      
      const weekChildIds = [...new Set(weekAlerts?.map(a => a.child_id).filter(Boolean) || [])];
      let activeParentsThisWeek = 0;
      if (weekChildIds.length > 0) {
        const { data: childrenOfWeek } = await supabase
          .from("children")
          .select("parent_id")
          .in("id", weekChildIds);
        activeParentsThisWeek = new Set(childrenOfWeek?.map(c => c.parent_id)).size;
      }

      // Messages scanned today
      const { data: metricsSum } = await supabase
        .from("device_daily_metrics")
        .select("messages_scanned")
        .eq("metric_date", todayStr);
      const messagesScannedToday = metricsSum?.reduce((sum, m) => sum + (m.messages_scanned || 0), 0) || 0;

      // Fetch alerts trend (last 14 days) + feedback
      const alertsTrend: { date: string; safe: number; review: number; notify: number }[] = [];
      const feedbackTrend: { date: string; total: number; important: number; not_relevant: number }[] = [];
      
      // Batch fetch: all alerts last 14 days
      const fourteenDaysAgo = subDays(new Date(), 13);
      fourteenDaysAgo.setHours(0, 0, 0, 0);
      
      const { data: allTrendAlerts } = await supabase
        .from("alerts")
        .select("id, ai_verdict, created_at")
        .gte("created_at", fourteenDaysAgo.toISOString())
        .order("created_at", { ascending: true });

      // Batch fetch: all feedback for these alerts
      const trendAlertIds = allTrendAlerts?.map(a => a.id) || [];
      let feedbackMap: Record<number, string> = {};
      if (trendAlertIds.length > 0) {
        const { data: feedbackData } = await supabase
          .from("alert_feedback")
          .select("alert_id, feedback_type")
          .in("alert_id", trendAlertIds);
        feedbackData?.forEach(f => {
          feedbackMap[f.alert_id] = f.feedback_type;
        });
      }

      for (let i = 13; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const dayStr = format(date, "yyyy-MM-dd");
        const dayAlerts = allTrendAlerts?.filter(a => a.created_at.startsWith(dayStr)) || [];

        alertsTrend.push({
          date: format(date, "dd/MM"),
          safe: dayAlerts.filter(a => a.ai_verdict === 'safe').length,
          review: dayAlerts.filter(a => a.ai_verdict === 'review').length,
          notify: dayAlerts.filter(a => a.ai_verdict === 'notify').length,
        });

        const dayAlertIds = dayAlerts.map(a => a.id);
        feedbackTrend.push({
          date: format(date, "dd/MM"),
          total: dayAlerts.length,
          important: dayAlertIds.filter(id => feedbackMap[id] === 'important').length,
          not_relevant: dayAlertIds.filter(id => feedbackMap[id] === 'not_relevant').length,
        });
      }

      // Feedback engagement (last 7 days)
      const sevenDaysAgo = subDays(new Date(), 7);
      const alertsLast7 = allTrendAlerts?.filter(a => new Date(a.created_at) >= sevenDaysAgo) || [];
      const totalAlertsLast7Days = alertsLast7.length;
      const alertIdsLast7 = new Set(alertsLast7.map(a => a.id));
      const alertsWithFeedbackLast7Days = new Set(
        Object.keys(feedbackMap).map(Number).filter(id => alertIdsLast7.has(id))
      ).size;
      const feedbackEngagementRate = totalAlertsLast7Days > 0
        ? (alertsWithFeedbackLast7Days / totalAlertsLast7Days) * 100
        : 0;

      // Children count
      const { count: childrenCount } = await supabase
        .from("children")
        .select("*", { count: "exact", head: true });

      setOverviewStats({
        totalParents: parentsCount || 0,
        totalWaitlist: waitlistCount || 0,
        totalDevices: devicesCount || 0,
        totalAlertsToday,
        criticalAlertsToday,
        activeUsersToday: activeCount || 0,
        conversionRate: waitlistCount && parentsCount ? (parentsCount / waitlistCount) * 100 : 0,
        alertsByVerdict: Object.entries(verdictCounts).map(([name, value]) => ({
          name,
          value,
          color: VERDICT_COLORS[name] || "#6b7280",
        })),
        alertsTrend,
        funnel: [
          { stage: "Waitlist", count: waitlistCount || 0 },
          { stage: "נרשמו", count: parentsCount || 0 },
          { stage: "הוסיפו ילד", count: childrenCount || 0 },
          { stage: "חיברו מכשיר", count: devicesCount || 0 },
          { stage: "פעילים היום", count: activeCount || 0 },
        ],
        activeChildrenToday,
        activeParentsThisWeek,
        messagesScannedToday,
        alertsSentToday: totalAlertsToday,
        feedbackTrend,
        totalAlertsLast7Days,
        alertsWithFeedbackLast7Days,
        feedbackEngagementRate,
      });
    } catch (error) {
      console.error("Error fetching overview stats:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      // Fetch parents
      const { data: parents, error: parentsError } = await supabase
        .from("parents")
        .select("*")
        .order("created_at", { ascending: false });

      if (parentsError) throw parentsError;

      // Fetch children
      const { data: children } = await supabase
        .from("children")
        .select("id, name, gender, parent_id");

      // Fetch devices
      const { data: devices } = await supabase
        .from("devices")
        .select("device_id, child_id, last_seen, battery_level");

      const now = new Date();
      const fifteenMinsAgo = new Date(now.getTime() - 15 * 60 * 1000);
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const usersData: UserData[] = (parents || []).map(parent => {
        const parentChildren = children?.filter(c => c.parent_id === parent.id) || [];
        const childIds = parentChildren.map(c => c.id);
        const parentDevices = devices?.filter(d => d.child_id && childIds.includes(d.child_id)) || [];
        
        let deviceStatus: 'online' | 'today' | 'offline' | 'no_device' = 'no_device';
        let lastActivity: string | null = null;

        if (parentDevices.length > 0) {
          const latestDevice = parentDevices.reduce((latest, device) => {
            if (!device.last_seen) return latest;
            if (!latest.last_seen) return device;
            return new Date(device.last_seen) > new Date(latest.last_seen) ? device : latest;
          }, parentDevices[0]);

          lastActivity = latestDevice.last_seen;

          if (lastActivity) {
            const lastSeenDate = new Date(lastActivity);
            if (lastSeenDate >= fifteenMinsAgo) {
              deviceStatus = 'online';
            } else if (lastSeenDate >= twentyFourHoursAgo) {
              deviceStatus = 'today';
            } else {
              deviceStatus = 'offline';
            }
          }
        }

        return {
          id: parent.id,
          full_name: parent.full_name,
          email: parent.email,
          phone: parent.phone,
          created_at: parent.created_at,
          children: parentChildren.map(c => ({ id: c.id, name: c.name, gender: c.gender })),
          devices: parentDevices.map(d => ({
            device_id: d.device_id,
            last_seen: d.last_seen,
            battery_level: d.battery_level,
          })),
          device_status: deviceStatus,
          last_activity: lastActivity,
        };
      });

      setUsers(usersData);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchWaitlist = async () => {
    try {
      const { data, error } = await supabase
        .from("waitlist_signups")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setWaitlist(data || []);
    } catch (error) {
      console.error("Error fetching waitlist:", error);
    }
  };

  const SYSTEM_ALERT_TEXT = 'המכשיר לא מגיב לבדיקות';

  const fetchTrainingStats = async () => {
    try {
      const { data: allData, error: allError } = await supabase
        .from("training_dataset")
        .select("*");

      const { data: tableData, error: tableError } = await supabase
        .from("training_dataset")
        .select("*")
        .neq("raw_text", SYSTEM_ALERT_TEXT)
        .order("created_at", { ascending: false })
        .limit(100);

      if (allError || tableError) {
        console.error("Error fetching training data:", allError || tableError);
        return;
      }

      const allRecords = allData as TrainingRecord[];
      const systemAlertCount = allRecords.filter(r => r.raw_text === SYSTEM_ALERT_TEXT).length;
      const records = allRecords.filter(r => r.raw_text !== SYSTEM_ALERT_TEXT);
      setTrainingRecords(tableData as TrainingRecord[]);
      
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
        const gender = record.gender || "unknown";
        genderCounts[gender] = (genderCounts[gender] || 0) + 1;

        if (record.age_at_incident) {
          const ageGroup = getAgeGroup(record.age_at_incident);
          ageCounts[ageGroup] = (ageCounts[ageGroup] || 0) + 1;
        }

        if (record.ai_verdict?.verdict) {
          const verdict = record.ai_verdict.verdict;
          verdictCounts[verdict] = (verdictCounts[verdict] || 0) + 1;
        }

        if (record.ai_verdict?.risk_score !== undefined) {
          const level = getRiskLevel(record.ai_verdict.risk_score);
          riskLevelCounts[level]++;
        }

        if (record.ai_verdict?.classification) {
          const cls = record.ai_verdict.classification;
          Object.entries(cls).forEach(([key, value]) => {
            if (value && value > 50) {
              classificationCounts[key] = (classificationCounts[key] || 0) + 1;
            }
          });
        }
      });

      setTrainingStats({
        total: records.length,
        systemAlertCount,
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
      console.error("Error processing training stats:", err);
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
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
            <img src={kippyLogo} alt="Kippy" className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              דשבורד ניהול
            </h1>
            <p className="text-sm text-muted-foreground">מרכז שליטה למנכ"ל</p>
          </div>
        </div>
        <Button variant="outline" onClick={handleLogout} className="gap-2">
          <LogOut className="w-4 h-4" />
          התנתק
        </Button>
      </header>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-flex">
          <TabsTrigger value="overview" className="gap-2">
            <LayoutDashboard className="w-4 h-4" />
            <span className="hidden sm:inline">סקירה כללית</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">משתמשים</span>
          </TabsTrigger>
          <TabsTrigger value="waitlist" className="gap-2">
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline">רשימת המתנה</span>
          </TabsTrigger>
          <TabsTrigger value="insights" className="gap-2">
            <Brain className="w-4 h-4" />
            <span className="hidden sm:inline">AI Insights</span>
          </TabsTrigger>
          <TabsTrigger value="training" className="gap-2">
            <Database className="w-4 h-4" />
            <span className="hidden sm:inline">Training</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <AdminOverview stats={overviewStats} loading={loading} onNavigate={handleOverviewNavigate} />
        </TabsContent>

        <TabsContent value="users">
          <AdminUsers users={users} loading={loading} initialStatusFilter={usersStatusFilter} onFilterApplied={() => setUsersStatusFilter(undefined)} />
        </TabsContent>

        <TabsContent value="waitlist">
          <AdminWaitlist entries={waitlist} loading={loading} onRefresh={fetchWaitlist} />
        </TabsContent>

        <TabsContent value="insights">
          <AdminInsightStats />
        </TabsContent>

        <TabsContent value="training">
          <AdminTraining stats={trainingStats} records={trainingRecords} loading={loading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
