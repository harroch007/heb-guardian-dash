import { useState, useEffect } from "react";
import { Clock, Loader2, Gift, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatScreenTime } from "@/components/ScreenTimeCard";
import { getAppIconInfo } from "@/lib/appIcons";
import { isSystemApp } from "@/lib/appUtils";
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
  todayBonusMinutes: number;
  onUpdateLimit: (minutes: number | null) => Promise<void>;
  onGrantBonus: (minutes: number) => Promise<void>;
}


const BONUS_OPTIONS = [15, 30, 45, 60];

export function ScreenTimeSection({
  appUsage,
  screenTimeLimit,
  currentUsageMinutes,
  todayBonusMinutes,
  onUpdateLimit,
  onGrantBonus,
}: ScreenTimeSectionProps) {
  const [limitEnabled, setLimitEnabled] = useState(screenTimeLimit !== null);
  const [sliderValue, setSliderValue] = useState(screenTimeLimit || 120);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [grantingBonus, setGrantingBonus] = useState<number | null>(null);

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

  const handleGrantBonus = async (minutes: number) => {
    setGrantingBonus(minutes);
    await onGrantBonus(minutes);
    setGrantingBonus(null);
  };

  const effectiveLimit = limitEnabled
    ? sliderValue + todayBonusMinutes
    : screenTimeLimit
      ? screenTimeLimit + todayBonusMinutes
      : null;

  const usagePercent =
    effectiveLimit && effectiveLimit > 0
      ? Math.min(100, (currentUsageMinutes / effectiveLimit) * 100)
      : null;

  const isOverLimit = limitEnabled && currentUsageMinutes > (sliderValue + todayBonusMinutes);

  const userApps = appUsage.filter((a) => !isSystemApp(a.package_name));
  const filteredTotal = userApps.reduce((sum, a) => sum + a.usage_minutes, 0);
  const filteredApps = userApps
    .sort((a, b) => b.usage_minutes - a.usage_minutes)
    .slice(0, 5);

  const [expanded, setExpanded] = useState(false);

  return (
    <div id="screentime-section" className="space-y-3 scroll-mt-4">
      <Card className="border-border/50">
        <CardHeader
          className="pb-3 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="w-5 h-5 text-primary" />
              זמן מסך
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className={cn("text-lg font-bold", isOverLimit ? "text-destructive" : "text-foreground")}>
                {formatScreenTime(currentUsageMinutes)}
              </span>
              {expanded ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          </div>
        </CardHeader>

        {expanded && (
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

                {/* Effective limit display when bonus is active */}
                {todayBonusMinutes > 0 && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-md px-2.5 py-1.5">
                    <Gift className="w-3.5 h-3.5 text-amber-500" />
                    <span>
                      מגבלה אפקטיבית להיום: <strong className="text-foreground">{formatScreenTime(sliderValue + todayBonusMinutes)}</strong>
                      {" "}(+{todayBonusMinutes} דק׳ בונוס)
                    </span>
                  </div>
                )}

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

                {/* Bonus Time */}
                <div className="border-t border-border/20 pt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Gift className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-medium">זמן בונוס</span>
                    {todayBonusMinutes > 0 && (
                      <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600 mr-auto">
                        +{todayBonusMinutes} דק׳ היום
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    {BONUS_OPTIONS.map((mins) => (
                      <Button
                        key={mins}
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs h-8"
                        disabled={grantingBonus !== null}
                        onClick={() => handleGrantBonus(mins)}
                      >
                        {grantingBonus === mins ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          `+${mins}`
                        )}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Top apps — compact list, no bars */}
            {filteredApps.length > 0 && (
              <>
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
                <p className="text-[11px] text-muted-foreground/70 mt-2 px-1">
                  * זמן המסך הכולל כולל גם אפליקציות מערכת ורקע. כאן מוצגות רק האפליקציות בהן הילד השתמש באופן פעיל.
                </p>
              </>
            )}

            {filteredApps.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                אין נתוני שימוש זמינים
              </p>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
