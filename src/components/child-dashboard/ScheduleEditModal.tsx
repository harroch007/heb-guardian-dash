import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TimeInput24h } from "@/components/ui/time-input-24h";
import { Label } from "@/components/ui/label";
import { Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScheduleWindow } from "@/hooks/useChildControls";

const DAYS = [
  { value: 0, label: "א׳" },
  { value: 1, label: "ב׳" },
  { value: 2, label: "ג׳" },
  { value: 3, label: "ד׳" },
  { value: 4, label: "ה׳" },
  { value: 5, label: "ו׳" },
  { value: 6, label: "ש׳" },
];

interface ScheduleEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scheduleType: "bedtime" | "school";
  existing?: ScheduleWindow | null;
  onCreate: (params: {
    schedule_type: string;
    name: string;
    days_of_week: number[];
    start_time: string;
    end_time: string;
  }) => Promise<void>;
  onUpdate: (
    scheduleId: string,
    params: {
      name?: string;
      days_of_week?: number[];
      start_time?: string;
      end_time?: string;
    }
  ) => Promise<void>;
  onDelete: (scheduleId: string) => Promise<void>;
}

const DEFAULTS: Record<"bedtime" | "school", { name: string; days: number[]; start: string; end: string }> = {
  bedtime: { name: "שעת שינה", days: [0, 1, 2, 3, 4, 5, 6], start: "21:00", end: "07:00" },
  school: { name: "בית ספר", days: [0, 1, 2, 3, 4], start: "08:00", end: "14:00" },
};

export function ScheduleEditModal({
  open,
  onOpenChange,
  scheduleType,
  existing,
  onCreate,
  onUpdate,
  onDelete,
}: ScheduleEditModalProps) {
  const defaults = DEFAULTS[scheduleType];
  const isEdit = !!existing;

  const [days, setDays] = useState<number[]>(defaults.days);
  const [startTime, setStartTime] = useState(defaults.start);
  const [endTime, setEndTime] = useState(defaults.end);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (existing) {
      setDays(existing.days_of_week || defaults.days);
      setStartTime(existing.start_time || defaults.start);
      setEndTime(existing.end_time || defaults.end);
    } else {
      setDays(defaults.days);
      setStartTime(defaults.start);
      setEndTime(defaults.end);
    }
  }, [existing, open]);

  const toggleDay = (day: number) => {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const handleSave = async () => {
    if (days.length === 0) return;
    setSaving(true);
    try {
      if (isEdit && existing) {
        await onUpdate(existing.id, { days_of_week: days, start_time: startTime, end_time: endTime });
      } else {
        await onCreate({
          schedule_type: scheduleType,
          name: defaults.name,
          days_of_week: days,
          start_time: startTime,
          end_time: endTime,
        });
      }
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existing) return;
    setDeleting(true);
    try {
      await onDelete(existing.id);
      onOpenChange(false);
    } finally {
      setDeleting(false);
    }
  };

  const title = scheduleType === "bedtime" ? "שעת שינה" : "שעות בית ספר";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-4" dir="rtl">
        <DialogHeader>
          <DialogTitle>{isEdit ? `עריכת ${title}` : `הגדרת ${title}`}</DialogTitle>
          <DialogDescription>
            {scheduleType === "bedtime"
              ? "המכשיר ייחסם באופן מלא בשעות שינה"
              : "המכשיר ייחסם באופן מלא בשעות בית ספר"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Days selection */}
          <div className="space-y-2">
            <Label>ימים</Label>
            <div className="flex gap-1.5 justify-center">
              {DAYS.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  className={cn(
                    "w-9 h-9 rounded-full text-sm font-medium transition-colors",
                    days.includes(day.value)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  )}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>שעת התחלה</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                dir="ltr"
              />
            </div>
            <div className="space-y-1.5">
              <Label>שעת סיום</Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                dir="ltr"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row gap-2 sm:justify-between">
          {isEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={deleting || saving}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 ml-1" />}
              מחק
            </Button>
          )}
          <div className="flex gap-2 mr-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              ביטול
            </Button>
            <Button onClick={handleSave} disabled={saving || days.length === 0}>
              {saving && <Loader2 className="w-4 h-4 animate-spin ml-1" />}
              {isEdit ? "שמור" : "צור"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
