import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LocationMap } from '@/components/LocationMap';
import { 
  ArrowRight, 
  MapPin, 
  Battery, 
  Wifi, 
  WifiOff, 
  Loader2,
  LocateFixed,
  AlertCircle,
  Copy
} from 'lucide-react';
import { ScreenTimeCard } from '@/components/ScreenTimeCard';
import { toast as sonnerToast } from 'sonner';
import { useToast } from '@/hooks/use-toast';

interface Child {
  id: string;
  name: string;
  date_of_birth: string;
  gender: string;
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

export default function ChildDashboard() {
  const { childId } = useParams<{ childId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [child, setChild] = useState<Child | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [appUsage, setAppUsage] = useState<AppUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [showMap, setShowMap] = useState(false);

  // Device is connected if a device record exists (app is installed and authorized)
  const isConnected = device !== null;

  // Get battery color based on level
  const getBatteryColor = (level: number | null) => {
    if (!level) return 'text-muted-foreground';
    if (level <= 20) return 'text-destructive';
    if (level <= 50) return 'text-warning';
    return 'text-success';
  };

  // Format last seen time
  const formatLastSeen = (lastSeen: string | null) => {
    if (!lastSeen) return 'לא ידוע';
    const diff = new Date().getTime() - new Date(lastSeen).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'עכשיו';
    if (mins < 60) return `לפני ${mins} דקות`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `לפני ${hours} שעות`;
    return `לפני ${Math.floor(hours / 24)} ימים`;
  };

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

      // Fetch device
      const { data: deviceData } = await supabase
        .from('devices')
        .select('*')
        .eq('child_id', childId)
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
    
    // Hide map after 15 seconds
    setTimeout(() => setShowMap(false), 15000);
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
                variant={isConnected ? 'default' : 'secondary'}
                className={isConnected ? 'bg-success text-success-foreground' : ''}
              >
                {isConnected ? (
                  <>
                    <Wifi className="w-3 h-3 ml-1" />
                    מחובר
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3 ml-1" />
                    לא מחובר
                  </>
                )}
              </Badge>
            </div>
            {device?.last_seen && (
              <p className="text-sm text-muted-foreground mt-1">
                נצפה לאחרונה: {formatLastSeen(device.last_seen)}
              </p>
            )}
          </div>
        </div>

        {!device ? (
          /* No device connected */
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="py-8 text-center">
              <AlertCircle className="w-12 h-12 text-warning mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">אין מכשיר מחובר</h3>
              <p className="text-muted-foreground mb-4">
                חבר את מכשיר הילד כדי להתחיל במעקב
              </p>
              <Button onClick={() => navigate('/family')} className="glow-primary">
                חזור למשפחה
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Compact Status Row - Battery + Location + Locate Button */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-xl bg-card border border-border/50">
              <div className="flex items-center gap-4 flex-wrap">
                {/* Location */}
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span className="text-sm text-foreground">
                    {device.latitude && device.longitude ? 'מיקום ידוע' : 'לא ידוע'}
                  </span>
                </div>
                
                <div className="w-px h-4 bg-border hidden sm:block" />
                
                {/* Battery */}
                <div className="flex items-center gap-2">
                  <Battery className={`w-4 h-4 ${getBatteryColor(device.battery_level)}`} />
                  <span className="text-sm text-foreground">
                    {device.battery_level ?? '--'}%
                  </span>
                </div>
              </div>
              
              <Button 
                onClick={handleLocateNow} 
                size="sm" 
                disabled={locating}
                className="glow-primary"
              >
                {locating ? (
                  <Loader2 className="w-4 h-4 animate-spin ml-2" />
                ) : (
                  <LocateFixed className="w-4 h-4 ml-2" />
                )}
                אתר עכשיו
              </Button>
            </div>

            {/* Map - Shows when locate is clicked */}
            {showMap && device.latitude && device.longitude && (
              <Card className="border-primary/30 animate-fade-in">
                <CardContent className="p-3 sm:p-4">
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
                </CardContent>
              </Card>
            )}

            {/* Screen Time / App Usage */}
            <ScreenTimeCard appUsage={appUsage} showChart={true} />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
