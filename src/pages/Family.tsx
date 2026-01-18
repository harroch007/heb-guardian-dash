import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { AddChildModal } from '@/components/AddChildModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Plus, User, ChevronLeft, Battery, Clock, Bell, Users, Smartphone, UserPlus } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { he } from 'date-fns/locale';
import { getDeviceStatus, getStatusLabel, getStatusBgColor, getStatusTextColor } from '@/lib/deviceStatus';

interface Child {
  id: string;
  name: string;
  phone_number: string;
  date_of_birth: string;
  gender: string;
  city: string | null;
  school: string | null;
}

interface DeviceInfo {
  device_id: string;
  battery_level: number | null;
  last_seen: string | null;
}

interface ChildWithDevice extends Child {
  device?: DeviceInfo | null;
  alertsCount: number;
}

export default function Family() {
  const navigate = useNavigate();
  const [children, setChildren] = useState<ChildWithDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const { user } = useAuth();

  const fetchChildren = async () => {
    if (!user) return;

    setLoading(true);
    
    // Fetch children
    const { data: childrenData, error: childrenError } = await supabase
      .from('children')
      .select('*')
      .eq('parent_id', user.id)
      .order('created_at', { ascending: false });

    if (childrenError) {
      console.error('Error fetching children:', childrenError);
      setLoading(false);
      return;
    }

    if (!childrenData || childrenData.length === 0) {
      setChildren([]);
      setLoading(false);
      return;
    }

    // Fetch devices for all children
    const childIds = childrenData.map(c => c.id);
    const { data: devicesData } = await supabase
      .from('devices')
      .select('device_id, child_id, battery_level, last_seen')
      .in('child_id', childIds);

    // Fetch alerts count for each child
    const { data: alertsData } = await supabase
      .from('alerts')
      .select('child_id')
      .in('child_id', childIds)
      .is('acknowledged_at', null);

    // Map devices to children
    const devicesMap: Record<string, DeviceInfo> = {};
    devicesData?.forEach(device => {
      if (device.child_id) {
        devicesMap[device.child_id] = {
          device_id: device.device_id,
          battery_level: device.battery_level,
          last_seen: device.last_seen
        };
      }
    });

    // Count alerts per child
    const alertsCountMap: Record<string, number> = {};
    alertsData?.forEach(alert => {
      if (alert.child_id) {
        alertsCountMap[alert.child_id] = (alertsCountMap[alert.child_id] || 0) + 1;
      }
    });

    // Combine data
    const childrenWithDevices: ChildWithDevice[] = childrenData.map(child => ({
      ...child,
      device: devicesMap[child.id] || null,
      alertsCount: alertsCountMap[child.id] || 0
    }));

    setChildren(childrenWithDevices);
    setLoading(false);
  };

  useEffect(() => {
    fetchChildren();
  }, [user]);

  const handleChildAdded = () => {
    fetchChildren();
  };

  const getGenderColors = (gender: string) => {
    if (gender === 'male') {
      return {
        bg: 'bg-blue-500/20',
        text: 'text-blue-400',
        border: 'border-blue-500/30'
      };
    }
    return {
      bg: 'bg-pink-500/20',
      text: 'text-pink-400',
      border: 'border-pink-500/30'
    };
  };

  const getBatteryColor = (level: number | null) => {
    if (!level) return 'text-muted-foreground';
    if (level > 50) return 'text-success';
    if (level > 20) return 'text-warning';
    return 'text-destructive';
  };

  const formatLastSeen = (lastSeen: string | null) => {
    if (!lastSeen) return 'לא ידוע';
    try {
      return formatDistanceToNow(new Date(lastSeen), { addSuffix: true, locale: he });
    } catch {
      return 'לא ידוע';
    }
  };

  // Calculate summary stats
  const totalChildren = children.length;
  const connectedDevices = children.filter(c => getDeviceStatus(!!c.device, c.device?.last_seen) === 'connected').length;
  const totalAlerts = children.reduce((sum, c) => sum + c.alertsCount, 0);

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8">
        {/* Header */}
        <motion.div 
          className="mb-8"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="text-3xl font-bold text-foreground">
            המשפחה שלי
          </h1>
          <p className="text-muted-foreground mt-1">
            ילדים, חיבור מכשיר, וניהול הרשאות
          </p>
        </motion.div>

        {/* Content */}
        <div className="space-y-6">
          {/* Family Summary Card - only show if there are children */}
          {!loading && children.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <Card className="bg-card border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-around text-center">
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-2 text-primary">
                        <Users className="w-5 h-5" />
                        <span className="text-2xl font-bold">{totalChildren}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">ילדים</span>
                    </div>
                    <div className="h-8 w-px bg-border/50" />
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-2 text-success">
                        <Smartphone className="w-5 h-5" />
                        <span className="text-2xl font-bold">{connectedDevices}/{totalChildren}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">מחוברים</span>
                    </div>
                    <div className="h-8 w-px bg-border/50" />
                    <div className="flex flex-col items-center gap-1">
                      <div className={`flex items-center gap-2 ${totalAlerts > 0 ? 'text-warning' : 'text-muted-foreground'}`}>
                        <Bell className="w-5 h-5" />
                        <span className="text-2xl font-bold">{totalAlerts}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">התראות</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Section: הילדים שלי */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <Card className="bg-card border-border/50">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4">הילדים שלי</h2>
                
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : children.length === 0 ? (
                  // Improved Empty State
                  <motion.div 
                    className="flex flex-col items-center justify-center py-12 text-center"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                      <UserPlus className="w-10 h-10 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      עוד לא הוספתם ילדים
                    </h3>
                    <p className="text-muted-foreground text-sm mb-6 max-w-xs">
                      הוסיפו את הילד הראשון כדי להתחיל לנטר את הפעילות הדיגיטלית שלו
                    </p>
                    <Button onClick={() => setIsAddModalOpen(true)}>
                      <Plus className="w-4 h-4 ml-2" />
                      הוסף ילד/ה
                    </Button>
                  </motion.div>
                ) : (
                  <div className="space-y-3">
                    {children.map((child, index) => {
                      const genderColors = getGenderColors(child.gender);
                      const status = getDeviceStatus(!!child.device, child.device?.last_seen);

                      return (
                        <motion.div
                          key={child.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: 0.3 + index * 0.1 }}
                          onClick={() => navigate(`/child/${child.id}`)}
                          className={`p-4 rounded-xl border ${genderColors.border} bg-card hover:bg-muted/30 cursor-pointer transition-all duration-200`}
                        >
                          <div className="flex items-start gap-4">
                            {/* Avatar */}
                            <Avatar className={`w-12 h-12 ${genderColors.bg}`}>
                              <AvatarFallback className={`${genderColors.bg} ${genderColors.text}`}>
                                <User className="w-6 h-6" />
                              </AvatarFallback>
                            </Avatar>
                            
                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-semibold text-foreground text-lg">
                                  {child.name}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs px-2 py-1 rounded-full ${getStatusBgColor(status)} ${getStatusTextColor(status)}`}>
                                    {getStatusLabel(status)}
                                  </span>
                                  <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                                </div>
                              </div>
                              
                              {child.device && (
                                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                                  {child.device.battery_level !== null && (
                                    <div className="flex items-center gap-1">
                                      <Battery className={`w-4 h-4 ${getBatteryColor(child.device.battery_level)}`} />
                                      <span>{child.device.battery_level}%</span>
                                    </div>
                                  )}
                                  <div className="flex items-center gap-1">
                                    <Clock className="w-4 h-4" />
                                    <span>{formatLastSeen(child.device.last_seen)}</span>
                                  </div>
                                  {child.alertsCount > 0 && (
                                    <div className="flex items-center gap-1 text-warning">
                                      <Bell className="w-4 h-4" />
                                      <span>{child.alertsCount} התראות</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Add Child Button - only show if there are already children */}
          {!loading && children.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.5 }}
              className="flex justify-center"
            >
              <Button 
                onClick={() => setIsAddModalOpen(true)}
                variant="outline"
                size="default"
              >
                <Plus className="w-4 h-4 ml-2" />
                הוסף ילד/ה
              </Button>
            </motion.div>
          )}
        </div>

        <AddChildModal
          open={isAddModalOpen}
          onOpenChange={setIsAddModalOpen}
          onChildAdded={handleChildAdded}
        />
      </div>
    </DashboardLayout>
  );
}
