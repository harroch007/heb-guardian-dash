import { useState, useEffect } from "react";
import { Clock, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

  const handleSelectChange = (value: string) => {
    const minutes = parseInt(value, 10);
    setSliderValue(minutes);
    setDirty(true);
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
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">מגבלה:</span>
                <Select
                  value={sliderValue.toString()}
                  onValueChange={handleSelectChange}
                  dir="rtl"
                >
                  <SelectTrigger className="w-28 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 420, 480].map((m) => (
                      <SelectItem key={m} value={m.toString()}>
                        {formatScreenTime(m)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {dirty && (
                <Button
                  onClick={async () => {
                    if (!limitEnabled) return;
                    setSaving(true);
                    await onUpdateLimit(sliderValue);
                    setSaving(false);
                    setDirty(false);
                  }}
                  disabled={saving}
                  size="sm"
                  className="w-full"
                >
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
