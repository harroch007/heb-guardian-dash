import { useState, useEffect } from "react";
import { Clock, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { formatScreenTime } from "@/components/ScreenTimeCard";
import { getAppIconInfo } from "@/lib/appIcons";
import { cn } from "@/lib/utils";

interface AppUsageEntry {
  app_name: string | null;
  package_name: string;
  usage_minutes: number;
}

interface ScreenTimeSectionProps {
  appUsage: AppUsageEntry[];
  screenTimeLimit: number | null;
  currentUsageMinutes: number;
  onUpdateLimit: (minutes: number | null) => Promise<void>;
}

const SYSTEM_FILTER = [
  "com.google.android.permissioncontroller",
  "com.android.systemui",
  "com.android.settings",
  "com.google.android.gms",
  "com.android.providers",
  "com.samsung.android.app.routines",
  "com.sec.android.app.launcher",
  "com.miui.home",
  "com.android.launcher",
  "com.android.packageinstaller",
];

const isSystem = (pkg: string) =>
  SYSTEM_FILTER.some((s) => pkg.toLowerCase().startsWith(s.toLowerCase())) ||
  pkg.toLowerCase().includes("systemui") ||
  pkg.toLowerCase().includes("devicecare");

export function ScreenTimeSection({
  appUsage,
  screenTimeLimit,
  currentUsageMinutes,
  onUpdateLimit,
}: ScreenTimeSectionProps) {
  const [limitEnabled, setLimitEnabled] = useState(screenTimeLimit !== null);
  const [sliderValue, setSliderValue] = useState(screenTimeLimit || 120);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setLimitEnabled(screenTimeLimit !== null);
    setSliderValue(screenTimeLimit || 120);
  }, [screenTimeLimit]);

  const handleToggleLimit = async (checked: boolean) => {
    setLimitEnabled(checked);
    setSaving(true);
    await onUpdateLimit(checked ? sliderValue : null);
    setSaving(false);
    setDirty(false);
  };

  const handleSliderChange = (value: number[]) => {
    setSliderValue(value[0]);
    setDirty(true);
  };

  const handleSaveLimit = async () => {
    if (!limitEnabled) return;
    setSaving(true);
    await onUpdateLimit(sliderValue);
    setSaving(false);
    setDirty(false);
  };

  const effectiveLimit = limitEnabled ? sliderValue : screenTimeLimit;
  const usagePercent =
    effectiveLimit && effectiveLimit > 0
      ? Math.min(100, (currentUsageMinutes / effectiveLimit) * 100)
      : null;

  const isOverLimit = limitEnabled && currentUsageMinutes > sliderValue;

  const filteredApps = appUsage
    .filter((a) => !isSystem(a.package_name))
    .sort((a, b) => b.usage_minutes - a.usage_minutes)
    .slice(0, 5);

  

  return (
    <div id="screentime-section" className="space-y-3 scroll-mt-4">
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="w-5 h-5 text-primary" />
              זמן מסך
            </CardTitle>
            <span className={cn("text-lg font-bold", isOverLimit ? "text-destructive" : "text-foreground")}>
              {formatScreenTime(currentUsageMinutes)}
            </span>
          </div>
          {usagePercent !== null && (
            <Progress value={usagePercent} className="h-1.5 mt-2" />
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Daily limit control — inline */}
          <div className="flex items-center justify-between py-1.5">
            <span className="text-sm text-muted-foreground">מגבלה יומית</span>
            <div dir="ltr">
              <Switch
                checked={limitEnabled}
                disabled={saving}
                onCheckedChange={handleToggleLimit}
              />
            </div>
          </div>

          {limitEnabled && (
            <div className="space-y-3">
              <div dir="ltr">
                <Slider
                  value={[sliderValue]}
                  onValueChange={handleSliderChange}
                  min={30}
                  max={480}
                  step={15}
                  className="w-full"
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>30 דק׳</span>
                <span className="font-medium text-foreground text-sm">
                  {formatScreenTime(sliderValue)}
                </span>
                <span>8 שעות</span>
              </div>
              {dirty && (
                <Button onClick={handleSaveLimit} disabled={saving} size="sm" className="w-full">
                  {saving && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                  שמור מגבלה
                </Button>
              )}
            </div>
          )}

          {/* Top apps — compact list, no bars */}
          {filteredApps.length > 0 && (
            <div className="space-y-0.5">
              {filteredApps.map((app) => {
                const iconInfo = getAppIconInfo(app.package_name);
                const Icon = iconInfo.icon;

                return (
                  <div
                    key={app.package_name}
                    className="flex items-center gap-2.5 py-1.5 px-1"
                  >
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                      style={{ backgroundColor: iconInfo.bgColor }}
                    >
                      <Icon className="w-3 h-3" style={{ color: iconInfo.color }} />
                    </div>
                    <span className="text-xs font-medium truncate flex-1">
                      {app.app_name || app.package_name.split(".").pop()}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatScreenTime(app.usage_minutes)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {filteredApps.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              אין נתוני שימוש זמינים
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
