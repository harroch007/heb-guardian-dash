import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { adminSupabase } from "@/integrations/supabase/admin-client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, LogOut, Shield, LayoutDashboard, Users, SlidersHorizontal, HelpCircle } from "lucide-react";
import kippyLogo from "@/assets/kippy-logo.svg";
import { AdminOverview, type OverviewStats } from "./admin/AdminOverview";
import { AdminUsersHub } from "./admin/AdminUsersHub";
import { AdminParentalOps } from "./admin/AdminParentalOps";
import { AdminHelpCenter } from "./admin/AdminHelpCenter";
import { format } from "date-fns";

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

export default function Admin() {
  const [loading, setLoading] = useState(true);
  const [overviewStats, setOverviewStats] = useState<OverviewStats | null>(null);
  const [users, setUsers] = useState<UserData[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [usersStatusFilter, setUsersStatusFilter] = useState<string | undefined>(undefined);
  const navigate = useNavigate();

  const handleOverviewNavigate = (tab: string, filter?: string) => {
    setActiveTab(tab);
    if (tab === "users" && filter) setUsersStatusFilter(filter);
    else setUsersStatusFilter(undefined);
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    const { data: { subscription } } = adminSupabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') navigate('/admin-login', { replace: true });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([fetchOverviewStats(), fetchUsers(), fetchWaitlist()]);
    setLoading(false);
  };

  const fetchOverviewStats = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = format(new Date(), "yyyy-MM-dd");
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);

      const [
        { count: parentsCount },
        { count: waitlistCount },
        { data: allDevices },
        { count: activeCount },
        { data: metricsToday },
        { data: childrenAll },
        { data: choresAll },
        { data: bankAll },
        { data: txToday },
        { data: bonusToday },
        { data: requestsAll },
        { data: placesAll },
      ] = await Promise.all([
        adminSupabase.from("parents").select("*", { count: "exact", head: true }),
        adminSupabase.from("waitlist_signups").select("*", { count: "exact", head: true }),
        adminSupabase.from("devices").select("device_id, child_id, last_seen").not("child_id", "is", null),
        adminSupabase.from("devices").select("*", { count: "exact", head: true }).gte("last_seen", yesterday.toISOString()),
        adminSupabase.from("device_daily_metrics").select("device_id").eq("metric_date", todayStr),
        adminSupabase.from("children").select("id, parent_id"),
        adminSupabase.from("chores").select("status, completed_at, approved_at"),
        adminSupabase.from("reward_bank").select("balance_minutes, child_id"),
        adminSupabase.from("reward_transactions").select("amount_minutes").gte("created_at", today.toISOString()),
        adminSupabase.from("bonus_time_grants").select("id").gte("created_at", today.toISOString()),
        adminSupabase.from("time_extension_requests").select("status"),
        adminSupabase.from("child_places").select("child_id"),
      ]);

      const totalDevices = allDevices?.length || 0;
      const now = Date.now();
      const devicesOnline = allDevices?.filter(d => d.last_seen && now - new Date(d.last_seen).getTime() < 15 * 60 * 1000).length || 0;
      const devicesToday = allDevices?.filter(d => d.last_seen && now - new Date(d.last_seen).getTime() < 24 * 60 * 60 * 1000 && now - new Date(d.last_seen).getTime() >= 15 * 60 * 1000).length || 0;
      const devicesOffline = totalDevices - devicesOnline - devicesToday;

      const metricDeviceIds = [...new Set(metricsToday?.map(m => m.device_id) || [])];
      let activeChildrenToday = 0;
      if (metricDeviceIds.length > 0) {
        const { data: dwc } = await adminSupabase.from("devices").select("child_id").in("device_id", metricDeviceIds).not("child_id", "is", null);
        activeChildrenToday = new Set(dwc?.map(d => d.child_id)).size;
      }

      const childrenWithDeviceIds = new Set(allDevices?.map(d => d.child_id).filter(Boolean));
      const childrenNoDevice = (childrenAll?.length || 0) - childrenWithDeviceIds.size;

      const choresActive = choresAll?.filter(c => c.status === "pending").length || 0;
      const choresCompletedToday = choresAll?.filter(c => c.completed_at && new Date(c.completed_at) >= today).length || 0;
      const choresPendingApproval = choresAll?.filter(c => c.status === "completed_by_child").length || 0;

      const rewardBankTotalMinutes = bankAll?.reduce((s, b) => s + (b.balance_minutes || 0), 0) || 0;
      const rewardRedemptionsToday = txToday?.filter(t => (t.amount_minutes ?? 0) < 0).length || 0;
      const bonusGrantsToday = bonusToday?.length || 0;
      const timeRequestsPending = requestsAll?.filter(r => r.status === "pending").length || 0;
      const familiesWithPlaces = new Set(placesAll?.map(p => p.child_id)).size;

      setOverviewStats({
        totalParents: parentsCount || 0,
        totalWaitlist: waitlistCount || 0,
        totalDevices,
        activeUsersToday: activeCount || 0,
        activeChildrenToday,
        activeParentsThisWeek: 0,
        funnel: [
          { stage: "Waitlist", count: waitlistCount || 0 },
          { stage: "נרשמו", count: parentsCount || 0 },
          { stage: "הוסיפו ילד", count: childrenAll?.length || 0 },
          { stage: "חיברו מכשיר", count: totalDevices },
          { stage: "פעילים היום", count: activeCount || 0 },
        ],
        choresActive,
        choresCompletedToday,
        choresPendingApproval,
        rewardBankTotalMinutes,
        rewardRedemptionsToday,
        bonusGrantsToday,
        timeRequestsPending,
        familiesWithPlaces,
        devicesOnline,
        devicesToday,
        devicesOffline,
        childrenNoDevice,
      });
    } catch (error) {
      console.error("Error fetching overview stats:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data: parents, error: parentsError } = await adminSupabase
        .from("parents").select("*").order("created_at", { ascending: false });
      if (parentsError) throw parentsError;

      const { data: children } = await adminSupabase.from("children").select("id, name, gender, parent_id");
      const { data: devices } = await adminSupabase.from("devices").select("device_id, child_id, last_seen, battery_level");
      const { data: adminRoles } = await adminSupabase.from("user_roles").select("user_id").eq("role", "admin");
      const adminIds = new Set((adminRoles || []).map(r => r.user_id));

      const now = new Date();
      const fifteenMinsAgo = new Date(now.getTime() - 15 * 60 * 1000);
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const usersData: UserData[] = (parents || []).filter(p => !adminIds.has(p.id)).map(parent => {
        const parentChildren = (children || []).filter(c => c.parent_id === parent.id);
        const childIds = parentChildren.map(c => c.id);
        const parentDevices = (devices || []).filter(d => d.child_id && childIds.includes(d.child_id));
        let device_status: UserData['device_status'] = 'no_device';
        let last_activity: string | null = null;
        if (parentDevices.length > 0) {
          const mostRecent = parentDevices.reduce((latest, d) =>
            !latest || (d.last_seen && new Date(d.last_seen) > new Date(latest.last_seen!)) ? d : latest
          , null as typeof parentDevices[0] | null);
          last_activity = mostRecent?.last_seen || null;
          if (last_activity) {
            const lastDate = new Date(last_activity);
            if (lastDate >= fifteenMinsAgo) device_status = 'online';
            else if (lastDate >= twentyFourHoursAgo) device_status = 'today';
            else device_status = 'offline';
          } else device_status = 'offline';
        }
        return {
          id: parent.id,
          full_name: parent.full_name,
          email: parent.email,
          phone: parent.phone,
          created_at: parent.created_at,
          children: parentChildren.map(c => ({ id: c.id, name: c.name, gender: c.gender })),
          devices: parentDevices.map(d => ({ device_id: d.device_id, last_seen: d.last_seen, battery_level: d.battery_level })),
          device_status,
          last_activity,
        };
      });
      setUsers(usersData);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchWaitlist = async () => {
    try {
      const { data, error } = await adminSupabase
        .from("waitlist_signups").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      setWaitlist(data || []);
    } catch (error) {
      console.error("Error fetching waitlist:", error);
    }
  };

  const handleLogout = async () => {
    await adminSupabase.auth.signOut();
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
            <p className="text-sm text-muted-foreground">בקרת הורים — מרכז שליטה</p>
          </div>
        </div>
        <Button variant="outline" onClick={handleLogout} className="gap-2">
          <LogOut className="w-4 h-4" />
          התנתק
        </Button>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
          <TabsTrigger value="overview" className="gap-2">
            <LayoutDashboard className="w-4 h-4" />
            <span className="hidden sm:inline">סקירה כללית</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">משתמשים</span>
          </TabsTrigger>
          <TabsTrigger value="ops" className="gap-2">
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">תפעול בקרת הורים</span>
          </TabsTrigger>
          <TabsTrigger value="help" className="gap-2">
            <HelpCircle className="w-4 h-4" />
            <span className="hidden sm:inline">מרכז עזרה</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <AdminOverview stats={overviewStats} loading={loading} onNavigate={handleOverviewNavigate} onRefresh={fetchOverviewStats} />
        </TabsContent>

        <TabsContent value="users">
          <AdminUsersHub
            users={users}
            waitlist={waitlist}
            loading={loading}
            onRefreshWaitlist={fetchWaitlist}
            onRefreshUsers={fetchUsers}
            funnel={overviewStats?.funnel || []}
            initialStatusFilter={usersStatusFilter}
            onFilterApplied={() => setUsersStatusFilter(undefined)}
          />
        </TabsContent>

        <TabsContent value="ops">
          <AdminParentalOps />
        </TabsContent>

        <TabsContent value="help">
          <AdminHelpCenter />
        </TabsContent>
      </Tabs>
    </div>
  );
}
