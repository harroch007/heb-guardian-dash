import { useState, useEffect } from "react";
import { Clock, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatScreenTime } from "@/components/ScreenTimeCard";

interface DailyLimitControlProps {
  currentLimit: number | null;
  currentUsageMinutes: number;
  onUpdateLimit: (minutes: number | null) => Promise<void>;
}

export function DailyLimitControl({
  currentLimit,
  currentUsageMinutes,
  onUpdateLimit,
}: DailyLimitControlProps) {
  const [enabled, setEnabled] = useState(currentLimit !== null);
  const [sliderValue, setSliderValue] = useState(currentLimit || 120);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setEnabled(currentLimit !== null);
    setSliderValue(currentLimit || 120);
  }, [currentLimit]);

  const handleToggle = async (checked: boolean) => {
    setEnabled(checked);
    setSaving(true);
    await onUpdateLimit(checked ? sliderValue : null);
    setSaving(false);
    setDirty(false);
  };

  const handleSliderChange = (value: number[]) => {
    setSliderValue(value[0]);
    setDirty(true);
  };

  const handleSave = async () => {
    if (!enabled) return;
    setSaving(true);
    await onUpdateLimit(sliderValue);
    setSaving(false);
    setDirty(false);
  };

  const usagePercent = enabled && sliderValue > 0
    ? Math.min(100, (currentUsageMinutes / sliderValue) * 100)
    : 0;

  const isOverLimit = enabled && currentUsageMinutes > sliderValue;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="w-5 h-5 text-primary" />
            מגבלת זמן מסך יומית כוללת
          </CardTitle>
          <div dir="ltr">
            <Switch
              checked={enabled}
              disabled={saving}
              onCheckedChange={handleToggle}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          סך הכל זמן מותר בכל האפליקציות ביחד
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {enabled && (
          <>
            {/* Usage progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">שימוש היום</span>
                <span className={isOverLimit ? "text-destructive font-semibold" : "text-foreground font-medium"}>
                  {formatScreenTime(currentUsageMinutes)} / {formatScreenTime(sliderValue)}
                </span>
              </div>
              <Progress
                value={usagePercent}
                className="h-2.5"
              />
            </div>

            {/* Slider */}
            <div className="space-y-3 pt-2">
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
            </div>

            {/* Save button */}
            {dirty && (
              <Button
                onClick={handleSave}
                disabled={saving}
                size="sm"
                className="w-full"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin ml-2" />
                ) : null}
                שמור מגבלה
              </Button>
            )}
          </>
        )}

        {!enabled && (
          <p className="text-sm text-muted-foreground text-center py-2">
            אין מגבלת זמן מסך מוגדרת
          </p>
        )}
      </CardContent>
    </Card>
  );
}
