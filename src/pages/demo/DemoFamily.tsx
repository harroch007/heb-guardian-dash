import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Plus, User, ChevronLeft, Battery, Clock, Bell, Users, Smartphone } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { DEMO_CHILDREN, DEMO_DEVICE, DEMO_ALERTS_FULL } from '@/data/demoData';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { he } from 'date-fns/locale';
import { getDeviceStatus, getStatusLabel, getStatusBgColor, getStatusTextColor } from '@/lib/deviceStatus';

// Demo device data for each child
const DEMO_DEVICES_MAP: Record<string, { battery_level: number; last_seen: string; latitude: number; longitude: number }> = {
  'demo-child-1': {
    battery_level: 86,
    last_seen: new Date(Date.now() - 6 * 60 * 1000).toISOString(), // 6 minutes ago
    latitude: 32.0853,
    longitude: 34.7818
  },
  'demo-child-2': {
    battery_level: 42,
    last_seen: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 minutes ago
    latitude: 32.0741,
    longitude: 34.7922
  }
};

// Demo alerts count per child
const DEMO_ALERTS_COUNT: Record<string, number> = {
  'demo-child-1': DEMO_ALERTS_FULL.length,
  'demo-child-2': 0
};

export default function DemoFamily() {
  const navigate = useNavigate();

  const handleAddChild = () => {
    toast({
      title: "מצב הדגמה",
      description: "הוספת ילד אינה זמינה במצב הדגמה",
    });
  };

  // Calculate summary stats
  const totalChildren = DEMO_CHILDREN.length;
  const connectedDevices = Object.values(DEMO_DEVICES_MAP).filter(d => 
    getDeviceStatus(true, d.last_seen) === 'connected'
  ).length;
  const totalAlerts = Object.values(DEMO_ALERTS_COUNT).reduce((sum, count) => sum + count, 0);

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

  const getBatteryColor = (level: number) => {
    if (level > 50) return 'text-success';
    if (level > 20) return 'text-warning';
    return 'text-destructive';
  };

  const formatLastSeen = (lastSeen: string) => {
    try {
      return formatDistanceToNow(new Date(lastSeen), { addSuffix: true, locale: he });
    } catch {
      return 'לא ידוע';
    }
  };

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
          {/* Family Summary Card */}
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

          {/* Section: הילדים שלי */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <Card className="bg-card border-border/50">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4">הילדים שלי</h2>
                
                <div className="space-y-3">
                  {DEMO_CHILDREN.map((child, index) => {
                    const device = DEMO_DEVICES_MAP[child.id];
                    const alertsCount = DEMO_ALERTS_COUNT[child.id] || 0;
                    const genderColors = getGenderColors(child.gender);
                    const status = getDeviceStatus(!!device, device?.last_seen);

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
                            
                            {device && status !== 'not_connected' && (
                              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Battery className={`w-4 h-4 ${getBatteryColor(device.battery_level)}`} />
                                  <span>{device.battery_level}%</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock className="w-4 h-4" />
                                  <span>{formatLastSeen(device.last_seen)}</span>
                                </div>
                                {alertsCount > 0 && (
                                  <div className="flex items-center gap-1 text-warning">
                                    <Bell className="w-4 h-4" />
                                    <span>{alertsCount} התראות</span>
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
              </CardContent>
            </Card>
          </motion.div>

          {/* Add Child Button */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.5 }}
            className="flex justify-center"
          >
            <Button 
              onClick={handleAddChild}
              variant="outline"
              size="default"
            >
              <Plus className="w-4 h-4 ml-2" />
              הוסף ילד/ה
            </Button>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}
