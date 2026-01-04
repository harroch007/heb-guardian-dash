import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardGreeting } from "@/components/dashboard/DashboardGreeting";
import { ChildTabs } from "@/components/dashboard/ChildTabs";
import { QuickStatusCard } from "@/components/dashboard/QuickStatusCard";
import { ScreenTimeCard } from "@/components/dashboard/ScreenTimeCard";
import { AlertsCard } from "@/components/dashboard/AlertsCard";
import { ReconnectChildModal } from "@/components/ReconnectChildModal";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

interface Child {
  id: string;
  name: string;
  parent_id: string;
}

interface Device {
  device_id: string;
  child_id: string | null;
  battery_level: number | null;
  last_seen: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface Alert {
  id: number;
  parent_message: string | null;
  ai_risk_score: number | null;
  created_at: string;
  is_processed: boolean;
  child_id: string | null;
}

interface Settings {
  daily_screen_time_limit_minutes: number | null;
}

interface ChildWithDevice extends Child {
  device?: Device;
  alertsCount?: number;
  settings?: Settings;
}

const Index = () => {
  const navigate = useNavigate();
  const [children, setChildren] = useState<ChildWithDevice[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [reconnectChildId, setReconnectChildId] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch children
      const { data: childrenData, error: childrenError } = await supabase
        .from('children')
        .select('*')
        .eq('parent_id', user?.id)
        .order('created_at', { ascending: false });

      if (childrenError) throw childrenError;

      const childIds = childrenData?.map(c => c.id) || [];
      let devicesMap: Record<string, Device> = {};
      let alertsCountMap: Record<string, number> = {};
      let settingsMap: Record<string, Settings> = {};
      
      if (childIds.length > 0) {
        // Fetch devices
        const { data: devicesData } = await supabase
          .from('devices')
          .select('*')
          .in('child_id', childIds);
        
        devicesData?.forEach(d => {
          if (d.child_id) {
            const existing = devicesMap[d.child_id];
            if (!existing || (d.last_seen && (!existing.last_seen || new Date(d.last_seen) > new Date(existing.last_seen)))) {
              devicesMap[d.child_id] = d;
            }
          }
        });

        // Count unacknowledged alerts per child
        const { data: alertsCount } = await supabase
          .from('alerts')
          .select('child_id')
          .in('child_id', childIds)
          .eq('is_processed', true)
          .not('parent_message', 'is', null)
          .is('acknowledged_at', null);

        alertsCount?.forEach(a => {
          if (a.child_id) {
            alertsCountMap[a.child_id] = (alertsCountMap[a.child_id] || 0) + 1;
          }
        });

        // Fetch settings for screen time limits
        const { data: settingsData } = await supabase
          .from('settings')
          .select('child_id, daily_screen_time_limit_minutes')
          .in('child_id', childIds);

        settingsData?.forEach(s => {
          if (s.child_id) {
            settingsMap[s.child_id] = { 
              daily_screen_time_limit_minutes: s.daily_screen_time_limit_minutes 
            };
          }
        });
      }

      const childrenWithDevices: ChildWithDevice[] = childrenData?.map(child => ({
        ...child,
        device: devicesMap[child.id],
        alertsCount: alertsCountMap[child.id] || 0,
        settings: settingsMap[child.id]
      })) || [];

      setChildren(childrenWithDevices);
      
      // Set first child as selected if none selected
      if (childrenWithDevices.length > 0 && !selectedChildId) {
        setSelectedChildId(childrenWithDevices[0].id);
      }

      // Fetch alerts for all children
      if (childIds.length > 0) {
       const { data: alertsData, error: alertsError } = await supabase
  .from('alerts')
  .select('id, parent_message, ai_risk_score, created_at, is_processed, child_id')
  .in('child_id', childIds)
  .eq('is_processed', true)
  .not('parent_message', 'is', null)
  .is('acknowledged_at', null)
  .order('created_at', { ascending: false });  .limit(10);

        if (alertsError) throw alertsError;
        setAlerts(alertsData || []);
      }

    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.message || 'שגיאה בטעינת נתונים');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchData();
    }
  }, [user?.id]);

  const selectedChild = children.find(c => c.id === selectedChildId);
  const selectedChildAlerts = alerts.filter(a => a.child_id === selectedChildId);

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 md:p-8 max-w-2xl mx-auto">
        {/* Personalized Greeting */}
        <DashboardGreeting />

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive">
            <p className="font-medium">שגיאה בטעינת נתונים</p>
            <p className="text-sm opacity-80">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            <div className="h-24 rounded-xl bg-card/50 animate-pulse border border-border/30" />
            <div className="h-40 rounded-xl bg-card/50 animate-pulse border border-border/30" />
            <div className="h-32 rounded-xl bg-card/50 animate-pulse border border-border/30" />
          </div>
        ) : children.length > 0 ? (
          <>
            {/* Child Tabs (only shown if multiple children) */}
            <ChildTabs 
              children={children.map(c => ({
                id: c.id,
                name: c.name,
                alertsCount: c.alertsCount,
                device: c.device ? { last_seen: c.device.last_seen } : undefined
              }))}
              selectedChildId={selectedChildId}
              onSelectChild={setSelectedChildId}
            />

            {selectedChild && (
              <div className="space-y-4 animate-fade-in">
                {/* Quick Status Card */}
                <QuickStatusCard 
                  device={selectedChild.device}
                  childName={selectedChild.name}
                  childId={selectedChild.id}
                  onReconnect={() => setReconnectChildId(selectedChild.id)}
                />

                {/* Screen Time Card */}
                <ScreenTimeCard 
                  childId={selectedChild.id}
                  deviceId={selectedChild.device?.device_id}
                  screenTimeLimit={selectedChild.settings?.daily_screen_time_limit_minutes}
                />

                {/* Alerts Card */}
                <AlertsCard 
                  alerts={selectedChildAlerts}
                  onAlertAcknowledged={fetchData}
                />

                {/* Quick action to view full profile */}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate(`/child/${selectedChild.id}`)}
                >
                  צפה בפרופיל המלא של {selectedChild.name}
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="p-8 rounded-xl bg-card border border-border/50 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground mb-4">אין ילדים רשומים</p>
            <Button onClick={() => navigate('/family')} className="gap-2">
              <Plus className="w-4 h-4" />
              הוסף ילד
            </Button>
          </div>
        )}

        {/* Reconnect Modal */}
        <ReconnectChildModal
          childId={reconnectChildId}
          childName={children.find(c => c.id === reconnectChildId)?.name || ''}
          parentEmail={user?.email || ''}
          onClose={() => {
            setReconnectChildId(null);
            fetchData(); // Refresh data after modal closes
          }}
        />
      </div>
    </DashboardLayout>
  );
};

export default Index;
