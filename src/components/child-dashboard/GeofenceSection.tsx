import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Home, School, Loader2, Trash2, Navigation } from "lucide-react";
import { useChildPlaces, type ChildPlace } from "@/hooks/useChildPlaces";
import { AddressAutocomplete } from "./AddressAutocomplete";
import { MapPinPicker } from "./MapPinPicker";

interface GeofenceSectionProps {
  childId: string;
  deviceLatitude?: number | null;
  deviceLongitude?: number | null;
  deviceAddress?: string | null;
}

function PlaceCard({
  type,
  label,
  place,
  saving,
  deviceLat,
  deviceLng,
  deviceAddress,
  onSave,
  onUpdateRadius,
  onDelete,
}: {
  type: "HOME" | "SCHOOL";
  label: string;
  place: ChildPlace | null;
  saving: boolean;
  deviceLat?: number | null;
  deviceLng?: number | null;
  deviceAddress?: string | null;
  onSave: (lat: number, lng: number, label?: string, radius?: number) => void;
  onUpdateRadius: (radius: number) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<{ latitude: number; longitude: number; address: string } | null>(null);
  const defaultRadius = type === "HOME" ? 150 : 250;
  const icon = type === "HOME" ? <Home className="w-4 h-4" /> : <School className="w-4 h-4" />;

  const handleUseDevice = () => {
    if (deviceLat != null && deviceLng != null) {
      const addr = deviceAddress || `${deviceLat.toFixed(5)}, ${deviceLng.toFixed(5)}`;
      setSelected({ latitude: deviceLat, longitude: deviceLng, address: addr });
      setEditing(true);
    }
  };

  const handleSave = () => {
    if (!selected) return;
    onSave(selected.latitude, selected.longitude, selected.address, place?.radius_meters ?? defaultRadius);
    setEditing(false);
    setSelected(null);
  };

  const handleStartEdit = () => {
    setSelected(null);
    setEditing(true);
  };

  return (
    <div className="border border-border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium">{label}</span>
        </div>
        {place ? (
          <Badge variant="secondary" className="bg-success/15 text-success text-[10px]">מוגדר</Badge>
        ) : (
          <Badge variant="secondary" className="text-[10px]">לא הוגדר</Badge>
        )}
      </div>

      {place && !editing && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{place.label || `${place.latitude.toFixed(5)}, ${place.longitude.toFixed(5)}`}</p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">רדיוס:</span>
            <Select value={String(place.radius_meters)} onValueChange={(v) => onUpdateRadius(Number(v))} dir="rtl">
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
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs flex-1" onClick={handleStartEdit}>עדכן מיקום</Button>
            <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={onDelete}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {!place && !editing && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="text-xs flex-1" onClick={handleStartEdit}>הגדר כתובת</Button>
          {deviceLat != null && deviceLng != null && (
            <Button variant="outline" size="sm" className="text-xs" onClick={handleUseDevice}>
              <Navigation className="w-3.5 h-3.5 ml-1" />מיקום המכשיר
            </Button>
          )}
        </div>
      )}

      {editing && (
        <div className="space-y-2">
          {deviceAddress && deviceLat != null && (
            <button type="button" className="text-[11px] text-primary underline" onClick={handleUseDevice}>
              השתמש במיקום המכשיר: {deviceAddress}
            </button>
          )}

          {selected ? (
            <div className="flex items-center gap-2 bg-muted/50 rounded px-2 py-1.5">
              <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-xs truncate">{selected.address}</span>
              <button type="button" className="text-[10px] text-muted-foreground underline mr-auto" onClick={() => setSelected(null)}>שנה</button>
            </div>
          ) : (
            <AddressAutocomplete onSelect={(r) => setSelected(r)} />
          )}

          <div className="flex gap-2">
            <Button size="sm" className="text-xs flex-1" onClick={handleSave} disabled={saving || !selected}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "שמור"}
            </Button>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setEditing(false); setSelected(null); }}>ביטול</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function GeofenceSection({ childId, deviceLatitude, deviceLongitude, deviceAddress }: GeofenceSectionProps) {
  const { settings, loading, saving, getPlace, upsertPlace, updateRadius, updateSettings, deletePlace } = useChildPlaces(childId);

  if (loading) {
    return (
      <Card className="border-border shadow-sm bg-card">
        <CardContent className="p-4 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border shadow-sm bg-card">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" />
          <span className="font-semibold text-sm text-foreground">גדר גיאוגרפית</span>
        </div>

        <div className="space-y-3">
          <PlaceCard
            type="HOME" label="בית" place={getPlace("HOME")} saving={saving}
            deviceLat={deviceLatitude} deviceLng={deviceLongitude} deviceAddress={deviceAddress}
            onSave={(lat, lng, label, radius) => upsertPlace("HOME", { latitude: lat, longitude: lng, label, radius_meters: radius })}
            onUpdateRadius={(r) => updateRadius("HOME", r)} onDelete={() => deletePlace("HOME")}
          />
          <PlaceCard
            type="SCHOOL" label="בית ספר" place={getPlace("SCHOOL")} saving={saving}
            deviceLat={deviceLatitude} deviceLng={deviceLongitude} deviceAddress={deviceAddress}
            onSave={(lat, lng, label, radius) => upsertPlace("SCHOOL", { latitude: lat, longitude: lng, label, radius_meters: radius })}
            onUpdateRadius={(r) => updateRadius("SCHOOL", r)} onDelete={() => deletePlace("SCHOOL")}
          />
        </div>

        <div className="border-t border-border pt-3 space-y-3">
          <span className="text-xs font-medium text-muted-foreground">התראות יציאה</span>
          <div className="flex items-center justify-between">
            <span className="text-sm">התראה ביציאה מהבית</span>
            <div dir="ltr"><Switch checked={settings.home_exit_alert_enabled} onCheckedChange={(v) => updateSettings({ home_exit_alert_enabled: v })} /></div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">התראה ביציאה מבית הספר</span>
            <div dir="ltr"><Switch checked={settings.school_exit_alert_enabled} onCheckedChange={(v) => updateSettings({ school_exit_alert_enabled: v })} /></div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">השהיה לפני התראה</span>
            <Select value={String(settings.exit_debounce_seconds)} onValueChange={(v) => updateSettings({ exit_debounce_seconds: Number(v) })} dir="rtl">
              <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="60">דקה</SelectItem>
                <SelectItem value="120">2 דקות</SelectItem>
                <SelectItem value="180">3 דקות</SelectItem>
                <SelectItem value="300">5 דקות</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
