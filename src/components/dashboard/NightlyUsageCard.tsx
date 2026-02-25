import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Moon, PartyPopper } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getIsraelDate } from "@/lib/utils";
import { getAppIconInfo } from "@/lib/appIcons";

interface NightlyReport {
  total_minutes: number;
  top_app_name: string | null;
  top_app_package: string | null;
  top_app_minutes: number | null;
}

interface NightlyUsageCardProps {
  childId: string;
}

const getIsraelHour = (): number => {
  const now = new Date();
  const israelTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
  return israelTime.getHours();
};

export function NightlyUsageCard({ childId }: NightlyUsageCardProps) {
  const [report, setReport] = useState<NightlyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      const today = getIsraelDate();

      const { data, error } = await supabase
        .from("nightly_usage_reports")
        .select("total_minutes, top_app_name, top_app_package, top_app_minutes")
        .eq("child_id", childId)
        .eq("report_date", today)
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setReport(data);
        setHasData(true);
      } else {
        setReport(null);
        setHasData(false);
      }
      setLoading(false);
    };

    fetchReport();
  }, [childId]);

  // Hide after 11:00 AM Israel time
  if (getIsraelHour() >= 11) return null;

  if (loading) return null;

  // No usage or no report → show positive message
  if (!hasData || !report || report.total_minutes === 0) {
    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Moon className="h-5 w-5 text-green-400" />
            שימוש לילי
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-green-400">
            <PartyPopper className="h-5 w-5" />
            <span className="font-medium">לא זוהה שימוש לילי 🎉</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">לא נצפה שימוש במכשיר בין 00:00–05:00</p>
        </CardContent>
      </Card>
    );
  }

  // Has usage → show real data
  const iconInfo = getAppIconInfo(report.top_app_package);
  const IconComponent = iconInfo.icon;

  return (
    <Card className="border-blue-500/30 bg-blue-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <Moon className="h-5 w-5 text-blue-400" />
          שימוש לילי
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">סה״כ שימוש (00:00–05:00)</span>
          <span className="font-bold text-foreground">{report.total_minutes} דקות</span>
        </div>
        {report.top_app_name && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">האפליקציה המובילה</span>
            <div className="flex items-center gap-2">
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center"
                style={{ backgroundColor: iconInfo.bgColor }}
              >
                <IconComponent className="w-3.5 h-3.5" style={{ color: iconInfo.color }} />
              </span>
              <span className="text-sm font-medium text-foreground">{report.top_app_name}</span>
              {report.top_app_minutes && (
                <span className="text-xs text-muted-foreground">({report.top_app_minutes} דק׳)</span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
