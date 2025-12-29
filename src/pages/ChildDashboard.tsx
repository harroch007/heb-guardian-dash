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
import { EditChildModal } from '@/components/EditChildModal';
import { ScreenTimeLimitModal } from '@/components/ScreenTimeLimitModal';
import { ReconnectChildModal } from '@/components/ReconnectChildModal';
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
  ChevronLeft,
  Trash2,
  Pencil,
  Unplug,
  RefreshCw
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
  const [deleting, setDeleting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showScreenTimeLimitModal, setShowScreenTimeLimitModal] = useState(false);
  const [screenTimeLimit, setScreenTimeLimit] = useState<number | null>(null);
  const [showReconnectModal, setShowReconnectModal] = useState(false);

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
  const status = getDeviceStatus(device?.last_seen ?? null);

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

      // Fetch open alerts (same logic as dashboard)
      const { data: alertsData } = await supabase
        .from('alerts')
        .select('id, parent_message, sender_display, sender, category, created_at')
        .eq('child_id', childId)
        .eq('is_processed', true)
        .not('parent_message', 'is', null)
        .is('acknowledged_at', null)
        .order('created_at', { ascending: false })
        .limit(3);
      
      setRecentAlerts(alertsData || []);

      // Fetch screen time limit settings
      const { data: settingsData } = await supabase
        .from('settings')
        .select('daily_screen_time_limit_minutes')
        .eq('child_id', childId)
        .maybeSingle();
      
      if (settingsData) {
        setScreenTimeLimit(settingsData.daily_screen_time_limit_minutes);
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
    setTimeout(() => setShowMap(false), 15000);
  };

  // Delete child
  const handleDeleteChild = async () => {
    if (!childId) return;
    
    setDeleting(true);
    
    const { data, error } = await supabase.rpc('delete_child_data', { 
      p_child_id: childId 
    });

    if (error) {
      toast({
        title: 'שגיאה',
        description: 'לא ניתן למחוק את הילד',
        variant: 'destructive',
      });
      setDeleting(false);
      return;
    }

    toast({
      title: 'הילד הוסר בהצלחה',
      description: `כל הנתונים של ${child?.name} נמחקו`,
    });

    navigate('/family');
  };

  // Disconnect device from child
  const handleDisconnectDevice = async () => {
    if (!device?.device_id) return;
    
    setDisconnecting(true);
    
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
      setDisconnecting(false);
      return;
    }

    toast({
      title: 'המכשיר נותק',
      description: 'המכשיר נותק בהצלחה מהילד',
    });

    setDevice(null);
    setDisconnecting(false);
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
              <div className="flex items-center gap-2">
                {child?.gender === 'male' ? (
                  <div className="p-1.5 rounded-full bg-blue-500/10">
                    <User className="w-5 h-5 text-blue-500" />
                  </div>
                ) : child?.gender === 'female' ? (
                  <div className="p-1.5 rounded-full bg-pink-500/10">
                    <User className="w-5 h-5 text-pink-500" />
                  </div>
                ) : null}
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                  {child?.name}
                </h1>
              </div>
                <Badge 
                  variant="secondary"
                  className={cn(
                    status === 'connected' && 'bg-success/20 text-success',
                    status === 'inactive' && 'bg-warning/20 text-warning',
                    status === 'disconnected' && 'bg-destructive/20 text-destructive'
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

          {/* Edit Child Button */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setShowEditModal(true)}
            className="text-muted-foreground hover:text-foreground"
          >
            <Pencil className="w-5 h-5" />
          </Button>

          {/* Delete Child Button */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="w-5 h-5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>האם להסיר את {child?.name}?</AlertDialogTitle>
                <AlertDialogDescription className="text-right">
                  פעולה זו תמחק את כל הנתונים הקשורים לילד זה כולל: התראות, מכשירים מחוברים, ונתוני שימוש.
                  <br /><br />
                  <strong>לא ניתן לבטל פעולה זו.</strong>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-row-reverse gap-2">
                <AlertDialogCancel>ביטול</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteChild}
                  disabled={deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                  כן, הסר
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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
            {/* Disconnected Warning Banner */}
            {status === 'disconnected' && (
              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-3">
                <div className="p-2 rounded-full bg-destructive/20 shrink-0">
                  <Smartphone className="w-5 h-5 text-destructive" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-destructive mb-1">המכשיר מנותק</h4>
                  <p className="text-sm text-muted-foreground">
                    לא התקבל עדכון מהמכשיר יותר משעה. ייתכן שהאפליקציה הוסרה מהטלפון או שהמכשיר כבוי.
                    <br />
                    מומלץ לבדוק שהאפליקציה עדיין מותקנת ופועלת.
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-3 text-primary border-primary/30 hover:bg-primary/10"
                    onClick={() => setShowReconnectModal(true)}
                  >
                    <RefreshCw className="w-4 h-4 ml-2" />
                    חבר מכשיר מחדש
                  </Button>
                </div>
              </div>
            )}

            {/* Status Card */}
            <Card className="border-primary/20">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "p-4 rounded-2xl border",
                    child?.gender === 'male' && "bg-blue-500/10 border-blue-500/30",
                    child?.gender === 'female' && "bg-pink-500/10 border-pink-500/30",
                    !child?.gender && "bg-primary/10 border-primary/30"
                  )}>
                    <User className={cn(
                      "w-10 h-10",
                      child?.gender === 'male' && "text-blue-500",
                      child?.gender === 'female' && "text-pink-500",
                      !child?.gender && "text-primary"
                    )} />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-foreground">{child?.name}</h2>
                    <p className="text-muted-foreground">{child && calculateAge(child.date_of_birth)} שנים</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {device.battery_level !== null && (
                      <div className="flex items-center gap-2">
                        <Battery className={cn('w-5 h-5', getBatteryColor(device.battery_level))} />
                        <span className="text-sm font-medium">{device.battery_level}%</span>
                      </div>
                    )}
                    {/* Disconnect/Reconnect Device Button */}
                    {status === 'disconnected' ? (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setShowReconnectModal(true)}
                        className="text-xs text-primary hover:text-primary"
                      >
                        <RefreshCw className="w-3.5 h-3.5 ml-1" />
                        חבר מחדש
                      </Button>
                    ) : (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-xs text-muted-foreground hover:text-destructive"
                          >
                            <Unplug className="w-3.5 h-3.5 ml-1" />
                            נתק מכשיר
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>האם לנתק את המכשיר?</AlertDialogTitle>
                            <AlertDialogDescription className="text-right">
                              המכשיר ינותק מ-{child?.name} אך לא יימחק מהמערכת. תוכל לחבר אותו מחדש בכל עת.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="flex-row-reverse gap-2">
                            <AlertDialogCancel>ביטול</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleDisconnectDevice}
                              disabled={disconnecting}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {disconnecting ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                              כן, נתק
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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
            <ScreenTimeCard 
              appUsage={appUsage} 
              showChart={true} 
              screenTimeLimit={screenTimeLimit}
              onSettingsClick={() => setShowScreenTimeLimitModal(true)}
            />

            {/* Recent Alerts Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                    <Bell className="w-4 h-4 text-warning" />
                    התראות פתוחות
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

        {/* Edit Child Modal */}
        {child && (
          <EditChildModal
            child={child}
            open={showEditModal}
            onOpenChange={setShowEditModal}
            onUpdated={(updatedChild) => setChild(updatedChild as Child)}
          />
        )}

        {/* Screen Time Limit Modal */}
        {child && (
          <ScreenTimeLimitModal
            childId={child.id}
            childName={child.name}
            open={showScreenTimeLimitModal}
            onOpenChange={setShowScreenTimeLimitModal}
            currentLimit={screenTimeLimit}
            onUpdated={setScreenTimeLimit}
          />
        )}

        {/* Reconnect Child Modal */}
        {child && user?.email && (
          <ReconnectChildModal
            childId={showReconnectModal ? child.id : null}
            childName={child.name}
            parentEmail={user.email}
            onClose={() => setShowReconnectModal(false)}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
