import { useState } from "react";
import { Calendar, Moon, BookOpen, Plus, Pencil, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpTooltip } from "@/components/help/HelpTooltip";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ScheduleEditModal } from "./ScheduleEditModal";
import type { ScheduleWindow } from "@/hooks/useChildControls";

interface SchedulesSectionProps {
  scheduleWindows: ScheduleWindow[];
  onToggleShabbat: () => Promise<void>;
  onCreateSchedule: (params: {
    schedule_type: string;
    name: string;
    days_of_week: number[];
    start_time: string;
    end_time: string;
  }) => Promise<void>;
  onUpdateSchedule: (
    scheduleId: string,
    params: {
      name?: string;
      days_of_week?: number[];
      start_time?: string;
      end_time?: string;
      is_active?: boolean;
    }
  ) => Promise<void>;
  onDeleteSchedule: (scheduleId: string) => Promise<void>;
}

const DAY_LABELS: Record<number, string> = { 1: "א׳", 2: "ב׳", 3: "ג׳", 4: "ד׳", 5: "ה׳", 6: "ו׳", 7: "ש׳" };

export function SchedulesSection({
  scheduleWindows,
  onToggleShabbat,
  onCreateSchedule,
  onUpdateSchedule,
  onDeleteSchedule,
}: SchedulesSectionProps) {
  const [togglingShabbat, setTogglingShabbat] = useState(false);
  const [editModal, setEditModal] = useState<{ open: boolean; type: "bedtime" | "school"; existing?: ScheduleWindow | null }>({
    open: false,
    type: "bedtime",
    existing: null,
  });
  const [expanded, setExpanded] = useState(false);

  const shabbatRule = scheduleWindows.find((s) => s.schedule_type === "shabbat");
  const bedtimeRule = scheduleWindows.find((s) => s.schedule_type === "bedtime");
  const schoolRule = scheduleWindows.find((s) => s.schedule_type === "school");

  const handleShabbatToggle = async () => {
    setTogglingShabbat(true);
    await onToggleShabbat();
    setTogglingShabbat(false);
  };

  const handleToggleRule = async (rule: ScheduleWindow) => {
    await onUpdateSchedule(rule.id, { is_active: !rule.is_active });
  };

  const renderDays = (days: number[] | null) => {
    if (!days || days.length === 0) return null;
    if (days.length === 7) return "כל יום";
    return [...days].sort((a, b) => a - b).map((d) => DAY_LABELS[d] || `${d}`).join(", ");
  };

  const activeCount = scheduleWindows.filter((s) => s.is_active).length;

  return (
    <div id="schedules-section" className="scroll-mt-4">
      <Card className="border-border/50">
        <CardHeader
          className="pb-3 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Calendar className="w-5 h-5 text-primary" />
              לוחות זמנים
            </CardTitle>
            <div className="flex items-center gap-2">
              {expanded ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          </div>
        </CardHeader>

        {expanded && (
        <CardContent className="space-y-0.5">
          {/* Shabbat & holidays row */}
          <div className="py-2.5 px-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <Calendar className="w-4 h-4 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-foreground">שבתות וחגים</span>
                </div>
              </div>
              <div className="shrink-0">
                {togglingShabbat ? (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                ) : (
                  <div dir="ltr">
                    <Switch
                      checked={shabbatRule?.is_active ?? false}
                      onCheckedChange={handleShabbatToggle}
                    />
                  </div>
                )}
              </div>
            </div>

            {shabbatRule?.is_active && (
              <div className="mt-1.5 mr-6">
                <span className="text-[11px] text-muted-foreground">
                  מחושב אוטומטית לפי מיקום הילד
                </span>
              </div>
            )}
          </div>

          <div className="border-t border-border/20" />

          {/* Bedtime row */}
          {bedtimeRule ? (
            <div className="flex items-center justify-between py-2.5 px-1">
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <Moon className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-foreground">שעת שינה</span>
                  <span className="text-[11px] text-muted-foreground block">
                    {bedtimeRule.start_time}–{bedtimeRule.end_time} · {renderDays(bedtimeRule.days_of_week)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setEditModal({ open: true, type: "bedtime", existing: bedtimeRule })}
                >
                  <Pencil className="w-3 h-3 text-muted-foreground" />
                </Button>
                <div dir="ltr">
                  <Switch
                    checked={bedtimeRule.is_active}
                    onCheckedChange={() => handleToggleRule(bedtimeRule)}
                  />
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setEditModal({ open: true, type: "bedtime", existing: null })}
              className="flex items-center justify-between py-2.5 px-1 w-full text-right hover:bg-muted/20 rounded transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Moon className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">הגדר שעת שינה</span>
              </div>
              <Plus className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}

          <div className="border-t border-border/20" />

          {/* School row */}
          {schoolRule ? (
            <div className="flex items-center justify-between py-2.5 px-1">
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <BookOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-foreground">בית ספר</span>
                  <span className="text-[11px] text-muted-foreground block">
                    {schoolRule.start_time}–{schoolRule.end_time} · {renderDays(schoolRule.days_of_week)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setEditModal({ open: true, type: "school", existing: schoolRule })}
                >
                  <Pencil className="w-3 h-3 text-muted-foreground" />
                </Button>
                <div dir="ltr">
                  <Switch
                    checked={schoolRule.is_active}
                    onCheckedChange={() => handleToggleRule(schoolRule)}
                  />
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setEditModal({ open: true, type: "school", existing: null })}
              className="flex items-center justify-between py-2.5 px-1 w-full text-right hover:bg-muted/20 rounded transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">הגדר שעות בית ספר</span>
              </div>
              <Plus className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
        </CardContent>
        )}
      </Card>

      <ScheduleEditModal
        open={editModal.open}
        onOpenChange={(open) => setEditModal((prev) => ({ ...prev, open }))}
        scheduleType={editModal.type}
        existing={editModal.existing}
        onCreate={onCreateSchedule}
        onUpdate={onUpdateSchedule}
        onDelete={onDeleteSchedule}
      />
    </div>
  );
}
