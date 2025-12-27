import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DeviceCard } from "@/components/DeviceCard";
import { AlertCard } from "@/components/AlertCard";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Smartphone, Bell, AlertTriangle, Plus, CheckCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

interface Device {
  device_id: string;
  child_id: string | null;
  battery_level: number | null;
  last_seen: string | null;
  latitude: number | null;
  longitude: number | null;
  children?: {
    id: string;
    name: string;
    parent_id: string;
    subscription_tier: string | null;
  };
}

interface Alert {
  id: number;
  sender: string | null;
  content: string | null;
  risk_score: number | null;
  created_at: string;
  ai_summary: string | null;
  ai_recommendation: string | null;
  is_processed: boolean;
}

const Index = () => {
  const navigate = useNavigate();
  const [devices, setDevices] = useState<Device[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch devices - only connected devices belonging to the parent's children
      const { data: devicesData, error: devicesError } = await supabase
        .from('devices')
        .select(`
          *,
          children!inner (
            id,
            name,
            parent_id,
            subscription_tier
          )
        `)
        .eq('children.parent_id', user?.id)
        .order('last_seen', { ascending: false });

      if (devicesError) throw devicesError;
      setDevices(devicesData || []);

      // Fetch alerts (latest 5)
      const { data: alertsData, error: alertsError } = await supabase
        .from('alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (alertsError) throw alertsError;
      setAlerts(alertsData || []);

    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.message || 'שגיאה בטעינת נתונים');
    } finally {
      setLoading(false);
    }
  };

  const deleteAlert = async (id: number) => {
    try {
      const { error } = await supabase
        .from('alerts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setAlerts(prev => prev.filter(alert => alert.id !== id));
      toast({
        title: "ההתראה נמחקה",
        description: "ההתראה הוסרה בהצלחה מהמערכת",
      });
    } catch (err: any) {
      toast({
        title: "שגיאה",
        description: err.message || "לא ניתן למחוק את ההתראה",
        variant: "destructive",
      });
    }
  };

  const handleReanalyze = async (id: number) => {
    // Refresh the alert data after re-analysis
    await fetchData();
  };

  useEffect(() => {
    if (user?.id) {
      fetchData();
    }
  }, [user?.id]);

  const highRiskCount = alerts.filter(a => (a.risk_score ?? 0) > 80).length;

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground text-glow mb-2">
          לוח בקרה
        </h1>
        <p className="text-muted-foreground">ניטור מכשירים והתראות בזמן אמת</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="p-4 rounded-xl bg-card border border-border/50 cyber-border animate-fade-in opacity-0" style={{ animationDelay: '0ms' }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Smartphone className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{devices.length}</p>
              <p className="text-xs text-muted-foreground">מכשירים מחוברים</p>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border/50 cyber-border animate-fade-in opacity-0" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <Bell className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{alerts.length}</p>
              <p className="text-xs text-muted-foreground">התראות פעילות</p>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border/50 cyber-border animate-fade-in opacity-0" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${highRiskCount > 0 ? 'bg-destructive/10' : 'bg-success/10'}`}>
              <AlertTriangle className={`w-5 h-5 ${highRiskCount > 0 ? 'text-destructive' : 'text-success'}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{highRiskCount}</p>
              <p className="text-xs text-muted-foreground">סיכון גבוה</p>
            </div>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive">
          <p className="font-medium">שגיאה בטעינת נתונים</p>
          <p className="text-sm opacity-80">{error}</p>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Devices Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">סטטוס מכשירים</h2>
          </div>
          
          {loading ? (
            <div className="space-y-4">
              {[1, 2].map(i => (
                <div key={i} className="h-40 rounded-xl bg-card/50 animate-pulse border border-border/30" />
              ))}
            </div>
          ) : devices.length > 0 ? (
            <div className="space-y-4">
              {devices.map((device) => (
                <DeviceCard key={device.device_id} device={device} />
              ))}
            </div>
          ) : (
            <div className="p-8 rounded-xl bg-card border border-border/50 text-center">
              <Smartphone className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground mb-4">אין מכשירים מחוברים</p>
              <p className="text-sm text-muted-foreground mb-4">הוסף ילד וחבר מכשיר כדי להתחיל</p>
              <Button onClick={() => navigate('/family')} className="gap-2">
                <Plus className="w-4 h-4" />
                הוסף ילד
              </Button>
            </div>
          )}
        </section>

        {/* Alerts Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5 text-warning" />
            <h2 className="text-lg font-semibold text-foreground">התראות אחרונות</h2>
          </div>
          
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-28 rounded-xl bg-card/50 animate-pulse border border-border/30" />
              ))}
            </div>
          ) : alerts.length > 0 ? (
            <div className="space-y-3">
              {alerts.map((alert, index) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onDelete={deleteAlert}
                  onReanalyze={handleReanalyze}
                  index={index}
                />
              ))}
            </div>
          ) : (
            <div className="p-8 rounded-xl bg-card border border-success/20 text-center">
              <CheckCircle className="w-12 h-12 text-success mx-auto mb-3" />
              <p className="text-foreground font-medium">אין התראות - מצוין!</p>
              <p className="text-sm text-muted-foreground mt-1">כל המכשירים בטוחים</p>
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
};

export default Index;
