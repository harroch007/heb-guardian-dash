import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { LocationMap } from '@/components/LocationMap';
import { 
  ArrowRight, 
  MapPin, 
  Battery, 
  Wifi, 
  WifiOff, 
  Smartphone, 
  Clock, 
  Loader2,
  LocateFixed,
  AlertCircle,
  Copy,
  Unlink
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
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
  id: string;
  app_name: string;
  package_name: string;
  usage_seconds: number;
  last_updated: string;
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

  // Format seconds to readable time
  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}ש'`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}ד'`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return mins > 0 ? `${hours}ש' ${mins}ד'` : `${hours}ש'`;
  };

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

      // Fetch app usage
      if (deviceData) {
        const { data: usageData } = await supabase
          .from('app_usage')
          .select('*')
          .eq('device_id', deviceData.device_id)
          .order('usage_seconds', { ascending: false })
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

  // Disconnect device
  const handleDisconnectDevice = async () => {
    if (!device?.device_id) return;

    const { error } = await supabase
      .from('devices')
      .update({ child_id: null })
      .eq('device_id', device.device_id);

    if (error) {
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לנתק את המכשיר',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'המכשיר נותק',
        description: 'המעקב הופסק בהצלחה',
      });
      setDevice(null);
      setAppUsage([]);
    }
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
      <div className="p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
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
          <div className="grid gap-6 md:grid-cols-2">
            {/* Location Card */}
            <Card className="md:col-span-2 border-primary/30">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  מיקום
                </CardTitle>
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
              </CardHeader>
              <CardContent>
                {showMap && device.latitude && device.longitude ? (
                  <div className="space-y-3">
                    <LocationMap 
                      latitude={device.latitude} 
                      longitude={device.longitude}
                      name={child?.name}
                      height="250px"
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          navigator.clipboard.writeText(`${device.latitude},${device.longitude}`);
                          sonnerToast.success("המיקום הועתק!");
                        }}
                      >
                        <Copy className="w-4 h-4 ml-2" />
                        העתק מיקום
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        asChild
                      >
                        <a 
                          href={`https://www.google.com/maps/search/?api=1&query=${device.latitude},${device.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <MapPin className="w-4 h-4 ml-2" />
                          פתח ב-Google Maps
                        </a>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="h-48 rounded-xl bg-muted/50 flex items-center justify-center">
                    <p className="text-muted-foreground">לחץ "אתר עכשיו" לראות את המיקום</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Battery Card */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Battery className={`w-5 h-5 ${getBatteryColor(device.battery_level)}`} />
                  סוללה
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-bold">
                      {device.battery_level ?? '--'}%
                    </span>
                    <Smartphone className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <Progress 
                    value={device.battery_level ?? 0} 
                    className="h-3"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Device Info Card */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-primary" />
                  פרטי מכשיר
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">מזהה מכשיר</span>
                      <span className="font-mono text-xs">{device.device_id.slice(0, 12)}...</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">סטטוס</span>
                      <span className="text-success">מחובר</span>
                    </div>
                  </div>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" className="w-full">
                        <Unlink className="w-4 h-4 ml-2" />
                        נתק מכשיר
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>לנתק את המכשיר?</AlertDialogTitle>
                        <AlertDialogDescription>
                          הניתוק יפסיק את המעקב אחרי המכשיר של {child?.name}. 
                          תוכל לחבר אותו מחדש מאוחר יותר באמצעות קוד ההתאמה.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="flex-row-reverse gap-2">
                        <AlertDialogCancel>ביטול</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={handleDisconnectDevice}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          נתק מכשיר
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>

            {/* Screen Time / App Usage */}
            <Card className="md:col-span-2 border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  זמן מסך
                </CardTitle>
              </CardHeader>
              <CardContent>
                {appUsage.length > 0 ? (
                  <div className="space-y-3">
                    {appUsage.map((app) => (
                      <div 
                        key={app.id} 
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
                            <span className="text-lg">📱</span>
                          </div>
                          <div>
                            <p className="font-medium">{app.app_name}</p>
                            <p className="text-xs text-muted-foreground">{app.package_name}</p>
                          </div>
                        </div>
                        <span className="text-primary font-semibold">
                          {formatTime(app.usage_seconds)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>אין נתוני שימוש זמינים</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
