import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { CompactAlertCard } from "@/components/CompactAlertCard";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Plus, CheckCircle, AlertTriangle, MapPin, ChevronLeft, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getDeviceStatus, getStatusColor, getStatusLabel, formatLastSeen } from "@/lib/deviceStatus";

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
  children?: Child;
}

interface Alert {
  id: number;
  parent_message: string | null;
  ai_risk_score: number | null;
  created_at: string;
  is_processed: boolean;
  child_id: string | null;
}

interface ChildWithDevice extends Child {
  device?: Device;
  alertsCount?: number;
}

const Index = () => {
  const navigate = useNavigate();
  const [children, setChildren] = useState<ChildWithDevice[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch children with their devices
      const { data: childrenData, error: childrenError } = await supabase
        .from('children')
        .select('*')
        .eq('parent_id', user?.id)
        .order('created_at', { ascending: false });

      if (childrenError) throw childrenError;

      // Fetch devices for these children
      const childIds = childrenData?.map(c => c.id) || [];
      let devicesMap: Record<string, Device> = {};
      let alertsCountMap: Record<string, number> = {};
      
      if (childIds.length > 0) {
        const { data: devicesData } = await supabase
          .from('devices')
          .select('*')
          .in('child_id', childIds);
        
        // Group by child_id, keeping the most recent device
        devicesData?.forEach(d => {
          if (d.child_id) {
            const existing = devicesMap[d.child_id];
            if (!existing || (d.last_seen && (!existing.last_seen || new Date(d.last_seen) > new Date(existing.last_seen)))) {
              devicesMap[d.child_id] = d;
            }
          }
        });

        // Count alerts per child (only unacknowledged)
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
      }

      // Combine children with their devices and alert counts
      const childrenWithDevices: ChildWithDevice[] = childrenData?.map(child => ({
        ...child,
        device: devicesMap[child.id],
        alertsCount: alertsCountMap[child.id] || 0
      })) || [];

      setChildren(childrenWithDevices);

      // Fetch PROCESSED alerts only (with parent_message, unacknowledged)
      const { data: alertsData, error: alertsError } = await supabase
        .from('alerts')
        .select('id, parent_message, ai_risk_score, created_at, is_processed, child_id')
        .eq('is_processed', true)
        .not('parent_message', 'is', null)
        .is('acknowledged_at', null)
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

  useEffect(() => {
    if (user?.id) {
      fetchData();
    }
  }, [user?.id]);

  // Get a simple location label (would need reverse geocoding in real app)
  const getLocationLabel = (device?: Device) => {
    if (!device?.latitude || !device?.longitude) return 'לא ידוע';
    return 'מיקום ידוע'; // In a real app, use reverse geocoding
  };

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 md:p-8">
        {/* Status Banner */}
        {!loading && (
          <div className="mb-6 animate-fade-in">
            {alerts.length === 0 ? (
              <div className="p-4 rounded-xl bg-success/10 border border-success/30 flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-success shrink-0" />
                <div>
                  <p className="font-semibold text-foreground">הכל בסדר! ✅</p>
                  <p className="text-sm text-muted-foreground">כל הילדים בטוחים</p>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-warning/10 border border-warning/30 flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-warning shrink-0" />
                <div>
                  <p className="font-semibold text-foreground">
                    יש {alerts.length} התראות לבדיקה ⚠️
                  </p>
                  <p className="text-sm text-muted-foreground">לחץ לפרטים</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive">
            <p className="font-medium">שגיאה בטעינת נתונים</p>
            <p className="text-sm opacity-80">{error}</p>
          </div>
        )}

        {/* Children Section */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">הילדים שלי</h2>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/family')}
              className="text-muted-foreground"
            >
              נהל משפחה
            </Button>
          </div>
          
          {loading ? (
            <div className="space-y-2">
              {[1, 2].map(i => (
                <div key={i} className="h-14 rounded-lg bg-card/50 animate-pulse border border-border/30" />
              ))}
            </div>
          ) : children.length > 0 ? (
            <div className="space-y-2">
              {children.map((child) => {
                const status = child.device ? getDeviceStatus(child.device.last_seen) : 'not_connected';
                
                return (
                  <div 
                    key={child.id}
                    onClick={() => navigate(`/child/${child.id}`)}
                    className="p-3 sm:p-4 rounded-lg bg-card border border-border/50 flex items-center justify-between cursor-pointer hover:border-primary/50 transition-all hover:scale-[1.01]"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-2.5 h-2.5 rounded-full",
                        getStatusColor(status)
                      )} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{child.name}</span>
                          {child.alertsCount && child.alertsCount > 0 && (
                            <Badge variant="destructive" className="text-xs px-1.5 py-0">
                              {child.alertsCount}
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatLastSeen(child.device?.last_seen ?? null)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{getLocationLabel(child.device)}</span>
                      <ChevronLeft className="w-4 h-4" />
                    </div>
                  </div>
                );
              })}
            </div>
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
        </section>

        {/* Alerts Section - Compact */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-warning" />
              <h2 className="text-lg font-semibold text-foreground">התראות אחרונות</h2>
            </div>
            {alerts.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate('/alerts')}
                className="text-muted-foreground"
              >
                ראה הכל
              </Button>
            )}
          </div>
          
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 rounded-lg bg-card/50 animate-pulse border border-border/30" />
              ))}
            </div>
          ) : alerts.length > 0 ? (
            <div className="space-y-2">
              {alerts.slice(0, 3).map((alert) => (
                <CompactAlertCard
                  key={alert.id}
                  alert={alert}
                  onClick={() => navigate('/alerts')}
                />
              ))}
              {alerts.length > 3 && (
                <Button 
                  variant="ghost" 
                  onClick={() => navigate('/alerts')} 
                  className="w-full text-muted-foreground hover:text-foreground"
                >
                  ראה את כל ההתראות ({alerts.length})
                </Button>
              )}
            </div>
          ) : (
            <div className="p-6 rounded-xl bg-card border border-success/20 text-center">
              <CheckCircle className="w-10 h-10 text-success mx-auto mb-2" />
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
