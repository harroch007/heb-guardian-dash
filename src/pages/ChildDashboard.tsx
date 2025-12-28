import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LocationMap } from '@/components/LocationMap';
import { QRCodeDisplay } from '@/components/QRCodeDisplay';
import { 
  ArrowRight, 
  MapPin, 
  Battery, 
  Loader2,
  LocateFixed,
  Copy,
  Smartphone,
  X,
  QrCode,
  Bell,
  User,
  ChevronLeft
} from 'lucide-react';
import { ScreenTimeCard } from '@/components/ScreenTimeCard';
import { toast as sonnerToast } from 'sonner';
import { useToast } from '@/hooks/use-toast';
import { getDeviceStatus, getStatusColor, getStatusLabel, formatLastSeen } from '@/lib/deviceStatus';
import { cn } from '@/lib/utils';

interface Child {
  id: string;
  name: string;
  date_of_birth: string;
  gender: string;
  pairing_code: string | null;
}

interface Device {
  device_id: string;
  child_id: string;
  battery_level: number | null;
  latitude: number | null;
  longitude: number | null;
  last_seen: string | null;
}

interface AppUsage {
  app_name: string | null;
  package_name: string;
  usage_minutes: number;
}

interface RecentAlert {
  id: number;
  parent_message: string | null;
  sender_display: string | null;
  sender: string | null;
  category: string | null;
  created_at: string;
}

export default function ChildDashboard() {
  const { childId } = useParams<{ childId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [child, setChild] = useState<Child | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [appUsage, setAppUsage] = useState<AppUsage[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<RecentAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  // Calculate age
  const calculateAge = (dateOfBirth: string) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Get battery color based on level
  const getBatteryColor = (level: number | null) => {
    if (!level) return 'text-muted-foreground';
    if (level <= 20) return 'text-destructive';
    if (level <= 50) return 'text-warning';
    return 'text-success';
  };

  // Get status for current device
  const status = device ? getDeviceStatus(device.last_seen) : 'not_connected';

  // Fetch child data
  useEffect(() => {
    const fetchData = async () => {
      if (!childId || !user) return;

      setLoading(true);
      
      // Fetch child
      const { data: childData } = await supabase
        .from('children')
        .select('*')
        .eq('id', childId)
        .eq('parent_id', user.id)
        .maybeSingle();

      if (!childData) {
        navigate('/family');
        return;
      }
      setChild(childData);

      // Fetch device - get the most recently seen device
      const { data: deviceData } = await supabase
        .from('devices')
        .select('*')
        .eq('child_id', childId)
        .order('last_seen', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      setDevice(deviceData);

      // Fetch app usage for today
      if (deviceData) {
        const today = new Date().toISOString().split('T')[0];
        const { data: usageData } = await supabase
          .from('app_usage')
          .select('app_name, package_name, usage_minutes')
          .eq('child_id', childId)
          .eq('usage_date', today)
          .order('usage_minutes', { ascending: false })
          .limit(10);
        
        setAppUsage(usageData || []);
      }

      // Fetch recent alerts
      const { data: alertsData } = await supabase
        .from('alerts')
        .select('id, parent_message, sender_display, sender, category, created_at')
        .eq('child_id', childId)
        .eq('is_processed', true)
        .not('parent_message', 'is', null)
        .order('created_at', { ascending: false })
        .limit(3);
      
      setRecentAlerts(alertsData || []);

      setLoading(false);
    };

    fetchData();
  }, [childId, user]);

  // Real-time device updates
  useEffect(() => {
    if (!device?.device_id) return;

    const channel = supabase
      .channel(`device-${device.device_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'devices',
          filter: `device_id=eq.${device.device_id}`,
        },
        (payload) => {
          setDevice(payload.new as Device);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [device?.device_id]);

  // Send locate command
  const handleLocateNow = async () => {
    if (!device?.device_id) return;

    setLocating(true);
    setShowMap(true);
    
    const { error } = await supabase.from('device_commands').insert({
      device_id: device.device_id,
      command_type: 'LOCATE_NOW',
      status: 'PENDING',
    });

    if (error) {
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לשלוח פקודת איתור',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'פקודת איתור נשלחה',
        description: 'המיקום יתעדכן בקרוב',
      });
    }

    setTimeout(() => setLocating(false), 3000);
    setTimeout(() => setShowMap(false), 15000);
  };

  // Format time for alerts
  const formatTimeAgo = (dateString: string) => {
    const diff = new Date().getTime() - new Date(dateString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'עכשיו';
    if (mins < 60) return `לפני ${mins} ד'`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `לפני ${hours} ש'`;
    return `לפני ${Math.floor(hours / 24)} ימים`;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/family')}
            className="shrink-0"
          >
            <ArrowRight className="w-5 h-5" />
          </Button>
          
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                {child?.name}
              </h1>
              <Badge 
                variant="secondary"
                className={cn(
                  status === 'connected' && 'bg-green-500/20 text-green-600 dark:text-green-400',
                  status === 'inactive' && 'bg-orange-500/20 text-orange-600 dark:text-orange-400',
                  status === 'not_connected' && 'bg-gray-500/20 text-gray-600 dark:text-gray-400'
                )}
              >
                <div className={cn('w-2 h-2 rounded-full ml-1.5', getStatusColor(status))} />
                {getStatusLabel(status)}
              </Badge>
            </div>
            {child && (
              <p className="text-sm text-muted-foreground mt-1">
                {calculateAge(child.date_of_birth)} שנים • נראה לאחרונה: {formatLastSeen(device?.last_seen ?? null)}
              </p>
            )}
          </div>
        </div>

        {!device ? (
          /* No device connected */
          <Card className="border-muted/30 bg-muted/5">
            <CardContent className="py-12 text-center">
              <div className="relative inline-block mb-6">
                <Smartphone className="w-16 h-16 text-muted-foreground" />
                <X className="w-8 h-8 text-destructive absolute -bottom-1 -right-1" />
              </div>
              <h3 className="text-xl font-semibold mb-2">אין מכשיר מחובר</h3>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                כדי להתחיל לעקוב אחרי {child?.name}, יש להתקין את האפליקציה על הטלפון שלו/ה ולסרוק קוד QR
              </p>
              <Button onClick={() => setShowQRModal(true)} className="glow-primary">
                <QrCode className="w-4 h-4 ml-2" />
                חבר מכשיר חדש
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Status Card */}
            <Card className="border-primary/20">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-4 rounded-2xl bg-primary/10 border border-primary/30">
                    <User className="w-10 h-10 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-foreground">{child?.name}</h2>
                    <p className="text-muted-foreground">{child && calculateAge(child.date_of_birth)} שנים</p>
                  </div>
                  <div className="text-left">
                    {device.battery_level !== null && (
                      <div className="flex items-center gap-2">
                        <Battery className={cn('w-5 h-5', getBatteryColor(device.battery_level))} />
                        <span className="text-sm font-medium">{device.battery_level}%</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Location Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    מיקום אחרון
                  </CardTitle>
                  <Button 
                    onClick={handleLocateNow} 
                    size="sm" 
                    variant="outline"
                    disabled={locating}
                  >
                    {locating ? (
                      <Loader2 className="w-4 h-4 animate-spin ml-2" />
                    ) : (
                      <LocateFixed className="w-4 h-4 ml-2" />
                    )}
                    אתר עכשיו
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {device.latitude && device.longitude ? (
                  <>
                    {showMap && (
                      <div className="mb-3 animate-fade-in">
                        <LocationMap 
                          latitude={device.latitude} 
                          longitude={device.longitude}
                          name={child?.name}
                        />
                        <div className="flex gap-2 mt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 text-xs sm:text-sm"
                            onClick={() => {
                              navigator.clipboard.writeText(`${device.latitude},${device.longitude}`);
                              sonnerToast.success("המיקום הועתק!");
                            }}
                          >
                            <Copy className="w-3.5 h-3.5 ml-1.5" />
                            העתק
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 text-xs sm:text-sm"
                            asChild
                          >
                            <a 
                              href={`https://www.google.com/maps/search/?api=1&query=${device.latitude},${device.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <MapPin className="w-3.5 h-3.5 ml-1.5" />
                              מפות
                            </a>
                          </Button>
                        </div>
                      </div>
                    )}
                    {!showMap && (
                      <p className="text-sm text-foreground">מיקום ידוע</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      עודכן: {formatLastSeen(device.last_seen)}
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground text-sm">אין מיקום זמין</p>
                )}
              </CardContent>
            </Card>

            {/* Screen Time Card */}
            <ScreenTimeCard appUsage={appUsage} showChart={true} />

            {/* Recent Alerts Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bell className="w-4 h-4 text-warning" />
                    התראות אחרונות
                  </CardTitle>
                  {recentAlerts.length > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => navigate('/alerts')}
                      className="text-muted-foreground"
                    >
                      ראה הכל
                      <ChevronLeft className="w-4 h-4 mr-1" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {recentAlerts.length > 0 ? (
                  <div className="space-y-2">
                    {recentAlerts.map((alert) => (
                      <div 
                        key={alert.id}
                        className="p-3 rounded-lg bg-warning/5 border border-warning/20 cursor-pointer hover:bg-warning/10 transition-colors"
                        onClick={() => navigate('/alerts')}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-foreground">
                            {alert.sender_display || alert.sender || 'לא ידוע'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatTimeAgo(alert.created_at)}
                          </span>
                        </div>
                        {alert.parent_message && (
                          <p className="text-xs text-muted-foreground truncate">
                            {alert.parent_message.slice(0, 60)}...
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm text-center py-4">
                    אין התראות אחרונות - מצוין! ✅
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* QR Modal */}
        {showQRModal && child && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">חיבור מכשיר חדש</h3>
                <Button variant="ghost" size="icon" onClick={() => setShowQRModal(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <QRCodeDisplay childId={child.id} parentId={user?.id || ''} onFinish={() => setShowQRModal(false)} />
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
