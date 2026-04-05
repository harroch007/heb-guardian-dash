import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { MapPin, Loader2, Navigation } from "lucide-react";
import { AddressAutocomplete } from "./AddressAutocomplete";
import { MapPinPicker } from "./MapPinPicker";
import { TimeInput24h } from "@/components/ui/time-input-24h";
import type { ManualPlaceInput } from "@/hooks/useChildPlaces";
import type { ChildPlace } from "@/hooks/useChildPlaces";

// 1=Sun ... 7=Sat (ISO project standard)
const DAY_LABELS: { value: number; label: string }[] = [
  { value: 1, label: "א׳" },
  { value: 2, label: "ב׳" },
  { value: 3, label: "ג׳" },
  { value: 4, label: "ד׳" },
  { value: 5, label: "ה׳" },
  { value: 6, label: "ו׳" },
  { value: 7, label: "ש׳" },
];

interface ManualPlaceFormProps {
  saving: boolean;
  deviceLat?: number | null;
  deviceLng?: number | null;
  deviceAddress?: string | null;
  existing?: ChildPlace | null;
  onSave: (data: ManualPlaceInput, existingId?: string) => void;
  onCancel: () => void;
}

export function ManualPlaceForm({
  saving,
  deviceLat,
  deviceLng,
  deviceAddress,
  existing,
  onSave,
  onCancel,
}: ManualPlaceFormProps) {
  const [label, setLabel] = useState(existing?.label || "");
  const [selected, setSelected] = useState<{ latitude: number; longitude: number; address: string } | null>(
    existing ? { latitude: existing.latitude, longitude: existing.longitude, address: existing.label || "" } : null
  );
  const [showMap, setShowMap] = useState(false);
  const [radius, setRadius] = useState(String(existing?.radius_meters ?? 200));
  const [alertEnter, setAlertEnter] = useState(existing?.alert_on_enter ?? false);
  const [alertExit, setAlertExit] = useState(existing?.alert_on_exit ?? true);
  const [scheduleMode, setScheduleMode] = useState<"ALWAYS" | "SCHEDULED">(existing?.schedule_mode ?? "ALWAYS");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(existing?.days_of_week ?? [1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = useState(existing?.start_time?.slice(0, 5) ?? "08:00");
  const [endTime, setEndTime] = useState(existing?.end_time?.slice(0, 5) ?? "16:00");

  const handleUseDevice = () => {
    if (deviceLat != null && deviceLng != null) {
      const addr = deviceAddress || `${deviceLat.toFixed(5)}, ${deviceLng.toFixed(5)}`;
      setSelected({ latitude: deviceLat, longitude: deviceLng, address: addr });
    }
  };

  const toggleDay = (day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const handleSubmit = () => {
    if (!selected || !label.trim()) return;
    onSave(
      {
        label: label.trim(),
        latitude: selected.latitude,
        longitude: selected.longitude,
        radius_meters: Number(radius),
        alert_on_enter: alertEnter,
        alert_on_exit: alertExit,
        schedule_mode: scheduleMode,
        days_of_week: scheduleMode === "SCHEDULED" ? daysOfWeek : undefined,
        start_time: scheduleMode === "SCHEDULED" ? startTime : undefined,
        end_time: scheduleMode === "SCHEDULED" ? endTime : undefined,
      },
      existing?.id
    );
  };

  const canSave = label.trim() && selected && (scheduleMode === "ALWAYS" || daysOfWeek.length > 0);

  return (
    <div className="border border-border rounded-lg p-3 space-y-3 bg-muted/30">
      {/* Label */}
      <div className="space-y-1">
        <Label className="text-xs">שם המקום</Label>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="למשל: חוג כדורגל"
          className="h-8 text-sm"
        />
      </div>

      {/* Location */}
      <div className="space-y-1">
        <Label className="text-xs">מיקום</Label>
        {showMap ? (
          <MapPinPicker
            initialLat={deviceLat}
            initialLng={deviceLng}
            onConfirm={(r) => { setSelected(r); setShowMap(false); }}
            onCancel={() => setShowMap(false)}
          />
        ) : selected ? (
          <div className="flex items-center gap-2 bg-background rounded px-2 py-1.5">
            <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="text-xs truncate">{selected.address || `${selected.latitude.toFixed(5)}, ${selected.longitude.toFixed(5)}`}</span>
            <button type="button" className="text-[10px] text-muted-foreground underline mr-auto" onClick={() => setSelected(null)}>שנה</button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {deviceLat != null && deviceLng != null && (
              <button type="button" className="text-[11px] text-primary underline" onClick={handleUseDevice}>
                השתמש במיקום המכשיר {deviceAddress ? `(${deviceAddress})` : ""}
              </button>
            )}
            <AddressAutocomplete onSelect={(r) => setSelected(r)} onFallback={() => setShowMap(true)} />
          </div>
        )}
      </div>

      {/* Radius */}
      <div className="flex items-center gap-2">
        <Label className="text-xs">רדיוס:</Label>
        <Select value={radius} onValueChange={setRadius} dir="rtl">
          <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="100">100 מ׳</SelectItem>
            <SelectItem value="150">150 מ׳</SelectItem>
            <SelectItem value="200">200 מ׳</SelectItem>
            <SelectItem value="250">250 מ׳</SelectItem>
            <SelectItem value="300">300 מ׳</SelectItem>
            <SelectItem value="500">500 מ׳</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Alert toggles */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm">התראה בכניסה</span>
          <div dir="ltr"><Switch checked={alertEnter} onCheckedChange={setAlertEnter} /></div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">התראה ביציאה</span>
          <div dir="ltr"><Switch checked={alertExit} onCheckedChange={setAlertExit} /></div>
        </div>
      </div>

      {/* Schedule mode */}
      <div className="space-y-2">
        <Label className="text-xs">מצב פעילות</Label>
        <div className="flex gap-3">
          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
            <input
              type="radio"
              checked={scheduleMode === "ALWAYS"}
              onChange={() => setScheduleMode("ALWAYS")}
              className="accent-primary"
            />
            תמיד פעיל
          </label>
          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
            <input
              type="radio"
              checked={scheduleMode === "SCHEDULED"}
              onChange={() => setScheduleMode("SCHEDULED")}
              className="accent-primary"
            />
            לפי לוח זמנים
          </label>
        </div>

        {scheduleMode === "SCHEDULED" && (
          <div className="space-y-2 pr-2 border-r-2 border-primary/20">
            <div className="flex flex-wrap gap-1.5">
              {DAY_LABELS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                    daysOfWeek.includes(d.value)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">מ-</Label>
              <TimeInput24h value={startTime} onChange={setStartTime} />
              <Label className="text-xs whitespace-nowrap">עד</Label>
              <TimeInput24h value={endTime} onChange={setEndTime} />
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      {!showMap && (
        <div className="flex gap-2 pt-1">
          <Button size="sm" className="text-xs flex-1" onClick={handleSubmit} disabled={saving || !canSave}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : existing ? "עדכן" : "הוסף"}
          </Button>
          <Button variant="ghost" size="sm" className="text-xs" onClick={onCancel}>ביטול</Button>
        </div>
      )}
    </div>
  );
}
