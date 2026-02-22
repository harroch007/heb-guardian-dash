import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getIsraelDate } from "@/lib/utils";
import { getAppIconInfo } from "@/lib/appIcons";

interface AppAlert {
  id: string;
  app_name: string | null;
  package_name: string;
  created_at: string;
}

interface NewAppsCardProps {
  childId: string;
}

export function NewAppsCard({ childId }: NewAppsCardProps) {
  const [apps, setApps] = useState<AppAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchApps = async () => {
      setLoading(true);
      const todayISO = getIsraelDate();
      // Start of today in Israel timezone
      const startOfDay = new Date(`${todayISO}T00:00:00+03:00`).toISOString();

      const { data, error } = await supabase
        .from("app_alerts")
        .select("id, app_name, package_name, created_at")
        .eq("child_id", childId)
        .gte("created_at", startOfDay)
        .order("created_at", { ascending: false });

      if (!error && data && data.length > 0) {
        setApps(data);
      } else {
        setApps([]);
      }
      setLoading(false);
    };

    fetchApps();
  }, [childId]);

  if (loading || apps.length === 0) return null;

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("he-IL", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jerusalem",
    });
  };

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <Download className="h-5 w-5 text-amber-500" />
          אפליקציות חדשות שזוהו
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {apps.map((app) => {
          const iconInfo = getAppIconInfo(app.package_name);
          const IconComponent = iconInfo.icon;
          return (
            <div key={app.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  className="w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: iconInfo.bgColor }}
                >
                  <IconComponent className="w-4 h-4" style={{ color: iconInfo.color }} />
                </span>
                <span className="font-medium text-foreground text-sm">
                  {app.app_name || app.package_name}
                </span>
              </div>
              <span className="text-xs text-muted-foreground" dir="ltr">
                {`\u202A${formatTime(app.created_at)}\u202C`}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
