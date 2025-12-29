import { useEffect, useState } from "react";
import { Clock, Smartphone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";

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
      const today = new Date().toISOString().split('T')[0];
      
      const { data } = await supabase
        .from('app_usage')
        .select('app_name, package_name, usage_minutes')
        .eq('child_id', childId)
        .eq('usage_date', today)
        .order('usage_minutes', { ascending: false });
      
      setAppUsage(data || []);
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
          {appUsage.slice(0, 3).map((app, idx) => (
            <div 
              key={app.package_name} 
              className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30"
            >
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-foreground">{getAppDisplayName(app)}</span>
              </div>
              <span className="text-sm font-medium text-muted-foreground">
                {formatTime(app.usage_minutes || 0)}
              </span>
            </div>
          ))}
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
