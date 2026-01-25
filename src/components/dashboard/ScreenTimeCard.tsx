import { useEffect, useState } from "react";
import { Clock, Smartphone, MessageCircle, Play, Music, Camera, Gamepad2, ShoppingBag, Chrome, Instagram, Facebook, Twitter, Mail, Video, Image, BookOpen } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { getIsraelDate } from "@/lib/utils";

// System apps to filter out from screen time display
const SYSTEM_APPS_TO_FILTER = [
  'com.google.android.permissioncontroller',  // בקר הרשאות
  'com.android.systemui',                      // System UI
  'com.android.settings',                      // הגדרות
  'com.google.android.gms',                    // Google Play Services
  'com.google.android.gsf',                    // Google Services Framework
  'com.android.providers',                     // System providers
  'com.samsung.android.app.routines',          // Samsung Routines
  'com.sec.android.app.launcher',              // Samsung Launcher
  'com.miui.home',                             // Xiaomi Launcher
  'com.android.launcher',                      // Stock Launcher
  'com.android.packageinstaller',              // Package Installer
  'com.android.bluetooth',                     // Bluetooth
  'com.android.nfc',                           // NFC
];

// App icons and colors mapping
const APP_ICONS: Record<string, { icon: React.ElementType; color: string; bgColor: string }> = {
  // Messaging apps
  'com.whatsapp': { icon: MessageCircle, color: '#25D366', bgColor: 'rgba(37, 211, 102, 0.15)' },
  'com.whatsapp.w4b': { icon: MessageCircle, color: '#25D366', bgColor: 'rgba(37, 211, 102, 0.15)' },
  'org.telegram.messenger': { icon: MessageCircle, color: '#0088cc', bgColor: 'rgba(0, 136, 204, 0.15)' },
  'com.facebook.orca': { icon: MessageCircle, color: '#0084FF', bgColor: 'rgba(0, 132, 255, 0.15)' },
  'com.discord': { icon: MessageCircle, color: '#5865F2', bgColor: 'rgba(88, 101, 242, 0.15)' },
  'com.snapchat.android': { icon: Camera, color: '#FFFC00', bgColor: 'rgba(255, 252, 0, 0.15)' },
  
  // Video & Streaming
  'com.google.android.youtube': { icon: Play, color: '#FF0000', bgColor: 'rgba(255, 0, 0, 0.15)' },
  'com.zhiliaoapp.musically': { icon: Music, color: '#000000', bgColor: 'rgba(255, 0, 80, 0.15)' }, // TikTok
  'com.ss.android.ugc.trill': { icon: Music, color: '#000000', bgColor: 'rgba(255, 0, 80, 0.15)' }, // TikTok
  'com.netflix.mediaclient': { icon: Video, color: '#E50914', bgColor: 'rgba(229, 9, 20, 0.15)' },
  'com.disney.disneyplus': { icon: Video, color: '#113CCF', bgColor: 'rgba(17, 60, 207, 0.15)' },
  'com.amazon.avod.thirdpartyclient': { icon: Video, color: '#00A8E1', bgColor: 'rgba(0, 168, 225, 0.15)' },
  'tv.twitch.android.app': { icon: Video, color: '#9146FF', bgColor: 'rgba(145, 70, 255, 0.15)' },
  
  // Social Media
  'com.instagram.android': { icon: Instagram, color: '#E4405F', bgColor: 'rgba(228, 64, 95, 0.15)' },
  'com.facebook.katana': { icon: Facebook, color: '#1877F2', bgColor: 'rgba(24, 119, 242, 0.15)' },
  'com.twitter.android': { icon: Twitter, color: '#1DA1F2', bgColor: 'rgba(29, 161, 242, 0.15)' },
  'com.pinterest': { icon: Image, color: '#E60023', bgColor: 'rgba(230, 0, 35, 0.15)' },
  
  // Games
  'com.supercell.clashofclans': { icon: Gamepad2, color: '#F5A623', bgColor: 'rgba(245, 166, 35, 0.15)' },
  'com.supercell.clashroyale': { icon: Gamepad2, color: '#0084FF', bgColor: 'rgba(0, 132, 255, 0.15)' },
  'com.mojang.minecraftpe': { icon: Gamepad2, color: '#7BC043', bgColor: 'rgba(123, 192, 67, 0.15)' },
  'com.kiloo.subwaysurf': { icon: Gamepad2, color: '#FF6B35', bgColor: 'rgba(255, 107, 53, 0.15)' },
  'com.king.candycrushsaga': { icon: Gamepad2, color: '#FF6B35', bgColor: 'rgba(255, 107, 53, 0.15)' },
  
  // Music
  'com.spotify.music': { icon: Music, color: '#1DB954', bgColor: 'rgba(29, 185, 84, 0.15)' },
  'com.apple.android.music': { icon: Music, color: '#FC3C44', bgColor: 'rgba(252, 60, 68, 0.15)' },
  'com.google.android.apps.youtube.music': { icon: Music, color: '#FF0000', bgColor: 'rgba(255, 0, 0, 0.15)' },
  
  // Browsers
  'com.android.chrome': { icon: Chrome, color: '#4285F4', bgColor: 'rgba(66, 133, 244, 0.15)' },
  'org.mozilla.firefox': { icon: Chrome, color: '#FF7139', bgColor: 'rgba(255, 113, 57, 0.15)' },
  'com.opera.browser': { icon: Chrome, color: '#FF1B2D', bgColor: 'rgba(255, 27, 45, 0.15)' },
  
  // Shopping
  'com.amazon.mShop.android.shopping': { icon: ShoppingBag, color: '#FF9900', bgColor: 'rgba(255, 153, 0, 0.15)' },
  'com.alibaba.aliexpresshd': { icon: ShoppingBag, color: '#FF4747', bgColor: 'rgba(255, 71, 71, 0.15)' },
  
  // Education
  'com.duolingo': { icon: BookOpen, color: '#58CC02', bgColor: 'rgba(88, 204, 2, 0.15)' },
  
  // Email
  'com.google.android.gm': { icon: Mail, color: '#EA4335', bgColor: 'rgba(234, 67, 53, 0.15)' },
};

// Get app icon info based on package name
const getAppIconInfo = (packageName: string) => {
  // Exact match first
  if (APP_ICONS[packageName]) {
    return APP_ICONS[packageName];
  }
  
  // Partial match for games
  if (packageName.includes('game') || packageName.includes('play')) {
    return { icon: Gamepad2, color: 'hsl(var(--primary))', bgColor: 'hsl(var(--primary) / 0.15)' };
  }
  
  // Default
  return { icon: Smartphone, color: 'hsl(var(--muted-foreground))', bgColor: 'hsl(var(--muted) / 0.3)' };
};

// Helper function to check if app is a system app
const isSystemApp = (packageName: string): boolean => {
  return SYSTEM_APPS_TO_FILTER.some(systemPkg => 
    packageName.startsWith(systemPkg)
  );
};

interface AppUsage {
  app_name: string | null;
  package_name: string;
  usage_minutes: number | null;
}

interface ScreenTimeCardProps {
  childId: string;
  deviceId?: string;
  screenTimeLimit?: number | null;
}

export const ScreenTimeCard = ({ childId, deviceId, screenTimeLimit }: ScreenTimeCardProps) => {
  const [appUsage, setAppUsage] = useState<AppUsage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAppUsage = async () => {
      if (!childId) return;
      
      setLoading(true);
      // Use Israel timezone for consistent date calculation (screen time resets at 00:00 Israel time)
      const today = getIsraelDate();
      
      const { data } = await supabase
        .from('app_usage')
        .select('app_name, package_name, usage_minutes')
        .eq('child_id', childId)
        .eq('usage_date', today)
        .order('usage_minutes', { ascending: false });
      
      // Filter out system apps
      const filteredApps = (data || []).filter(app => !isSystemApp(app.package_name));
      setAppUsage(filteredApps);
      setLoading(false);
    };

    fetchAppUsage();
  }, [childId, deviceId]);

  const totalMinutes = appUsage.reduce((sum, app) => sum + (app.usage_minutes || 0), 0);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  const formatTime = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0) return `${h}ש' ${m}ד'`;
    return `${m}ד'`;
  };

  const progress = screenTimeLimit ? Math.min((totalMinutes / screenTimeLimit) * 100, 100) : 0;
  const isOverLimit = screenTimeLimit && totalMinutes > screenTimeLimit;

  const getAppDisplayName = (app: AppUsage) => {
    if (app.app_name) return app.app_name;
    // Extract app name from package name
    const parts = app.package_name.split('.');
    return parts[parts.length - 1];
  };

  return (
    <Card className="p-4 bg-card border-border/50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">זמן מסך היום</h3>
        </div>
        <span className={`text-lg font-bold ${isOverLimit ? 'text-destructive' : 'text-foreground'}`}>
          {hours > 0 ? `${hours}:${minutes.toString().padStart(2, '0')}` : `${minutes} דק'`}
        </span>
      </div>

      {screenTimeLimit && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>מתוך {formatTime(screenTimeLimit)}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress 
            value={progress} 
            className={`h-2 ${isOverLimit ? '[&>div]:bg-destructive' : ''}`}
          />
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-8 rounded bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : appUsage.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground mb-2">אפליקציות מובילות:</p>
          {appUsage.slice(0, 3).map((app) => {
            const iconInfo = getAppIconInfo(app.package_name);
            const IconComponent = iconInfo.icon;
            return (
              <div 
                key={app.package_name} 
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30"
              >
                <div className="flex items-center gap-2">
                  <div 
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: iconInfo.bgColor }}
                  >
                    <IconComponent className="w-4 h-4" style={{ color: iconInfo.color }} />
                  </div>
                  <span className="text-sm text-foreground">{getAppDisplayName(app)}</span>
                </div>
                <span className="text-sm font-medium text-muted-foreground">
                  {formatTime(app.usage_minutes || 0)}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-4 text-muted-foreground">
          <Smartphone className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">אין נתוני שימוש להיום</p>
        </div>
      )}
    </Card>
  );
};
