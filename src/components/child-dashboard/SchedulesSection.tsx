import { useState } from "react";
import { Calendar, Moon, BookOpen, Plus, Pencil, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpTooltip } from "@/components/help/HelpTooltip";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScheduleEditModal } from "./ScheduleEditModal";
import type { ScheduleWindow } from "@/hooks/useChildControls";

interface SchedulesSectionProps {
  scheduleWindows: ScheduleWindow[];
  onToggleShabbat: () => Promise<void>;
  onUpdateShabbatMode: (
    scheduleId: string,
    mode: "default" | "manual",
    manualStartTime?: string,
    manualEndTime?: string,
  ) => Promise<void>;
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
  onUpdateShabbatMode,
  onCreateSchedule,
  onUpdateSchedule,
  onDeleteSchedule,
}: SchedulesSectionProps) {
  const [togglingShabbat, setTogglingShabbat] = useState(false);
  const [editingShabbat, setEditingShabbat] = useState(false);
  const [shabbatStart, setShabbatStart] = useState("18:00");
  const [shabbatEnd, setShabbatEnd] = useState("20:00");
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
    if (
      !shabbatRule ||
      !shabbatRule.start_time ||
      !shabbatRule.end_time
    ) {
      setShabbatStart(shabbatRule?.start_time || "18:00");
      setShabbatEnd(shabbatRule?.end_time || "20:00");
      setEditingShabbat(true);
      return;
    }
    setTogglingShabbat(true);
    await onToggleShabbat();
    setTogglingShabbat(false);
  };

  const saveShabbatWindow = async () => {
    if (!shabbatStart || !shabbatEnd) return;
    setTogglingShabbat(true);
    if (shabbatRule) {
      await onUpdateShabbatMode(
        shabbatRule.id,
        "manual",
        shabbatStart,
        shabbatEnd,
      );
    } else {
      await onCreateSchedule({
        schedule_type: "shabbat",
        name: "שבתות וחגים",
        // Friday. Cross-midnight evaluation applies the end time on Saturday.
        days_of_week: [6],
        start_time: shabbatStart,
        end_time: shabbatEnd,
      });
    }
    setTogglingShabbat(false);
    setEditingShabbat(false);
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
              <HelpTooltip text="חלונות זמן בהם המכשיר חסום אוטומטית — לדוגמה שינה, שיעורים או שבת." iconSize={12} />
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
              <div className="mt-1.5 mr-6 flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">
                  {shabbatRule.start_time && shabbatRule.end_time
                    ? `מיום שישי ${shabbatRule.start_time} עד שבת ${shabbatRule.end_time}`
                    : "נדרש להגדיר חלון שעות ידני"}
                </span>
                <button
                  type="button"
                  className="text-[11px] text-primary underline"
                  onClick={() => {
                    setShabbatStart(
                      shabbatRule.start_time || "18:00",
                    );
                    setShabbatEnd(shabbatRule.end_time || "20:00");
                    setEditingShabbat(true);
                  }}
                >
                  עריכה
                </button>
              </div>
            )}

            {editingShabbat && (
              <div className="mt-3 mr-6 space-y-2 rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">
                  הגדירו חלון קבוע מיום שישי עד שבת. חישוב אוטומטי לפי מיקום
                  יחובר בשלב נפרד.
                </p>
                <div className="grid grid-cols-2 gap-2" dir="ltr">
                  <Input
                    type="time"
                    value={shabbatStart}
                    onChange={(event) =>
                      setShabbatStart(event.target.value)
                    }
                  />
                  <Input
                    type="time"
                    value={shabbatEnd}
                    onChange={(event) =>
                      setShabbatEnd(event.target.value)
                    }
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={saveShabbatWindow}
                    disabled={togglingShabbat}
                  >
                    {togglingShabbat && (
                      <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin" />
                    )}
                    שמור והפעל
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingShabbat(false)}
                    disabled={togglingShabbat}
                  >
                    ביטול
                  </Button>
                </div>
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
