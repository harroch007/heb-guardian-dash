import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ChildPlace {
  id: string;
  child_id: string;
  place_type: "HOME" | "SCHOOL";
  label: string | null;
  latitude: number;
  longitude: number;
  radius_meters: number;
  is_active: boolean;
}

export interface GeofenceSettings {
  home_exit_alert_enabled: boolean;
  school_exit_alert_enabled: boolean;
  exit_debounce_seconds: number;
}

const DEFAULT_SETTINGS: GeofenceSettings = {
  home_exit_alert_enabled: true,
  school_exit_alert_enabled: true,
  exit_debounce_seconds: 120,
};

const DEFAULT_RADIUS: Record<string, number> = {
  HOME: 150,
  SCHOOL: 250,
};

export function useChildPlaces(childId: string | undefined) {
  const [places, setPlaces] = useState<ChildPlace[]>([]);
  const [settings, setSettings] = useState<GeofenceSettings>(DEFAULT_SETTINGS);
  const [settingsRowExists, setSettingsRowExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    if (!childId) return;
    setLoading(true);

    const [placesRes, settingsRes] = await Promise.all([
      supabase
        .from("child_places")
        .select("*")
        .eq("child_id", childId)
        .eq("is_active", true),
      supabase
        .from("child_geofence_settings")
        .select("*")
        .eq("child_id", childId)
        .maybeSingle(),
    ]);

    if (placesRes.data) {
      setPlaces(placesRes.data as ChildPlace[]);
    }

    if (settingsRes.data) {
      setSettings({
        home_exit_alert_enabled: settingsRes.data.home_exit_alert_enabled,
        school_exit_alert_enabled: settingsRes.data.school_exit_alert_enabled,
        exit_debounce_seconds: settingsRes.data.exit_debounce_seconds,
      });
      setSettingsRowExists(true);
    } else {
      setSettings(DEFAULT_SETTINGS);
      setSettingsRowExists(false);
    }

    setLoading(false);
  }, [childId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getPlace = (type: "HOME" | "SCHOOL") =>
    places.find((p) => p.place_type === type) || null;

  const upsertPlace = async (
    type: "HOME" | "SCHOOL",
    data: { latitude: number; longitude: number; label?: string; radius_meters?: number }
  ) => {
    if (!childId) return;
    setSaving(true);

    const existing = getPlace(type);
    const radius = data.radius_meters ?? DEFAULT_RADIUS[type];

    if (existing) {
      const { error } = await supabase
        .from("child_places")
        .update({
          latitude: data.latitude,
          longitude: data.longitude,
          label: data.label ?? existing.label,
          radius_meters: radius,
        })
        .eq("id", existing.id);

      if (error) {
        toast({ title: "שגיאה", description: "לא ניתן לעדכן את המיקום", variant: "destructive" });
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from("child_places").insert({
        child_id: childId,
        place_type: type,
        latitude: data.latitude,
        longitude: data.longitude,
        label: data.label ?? (type === "HOME" ? "בית" : "בית ספר"),
        radius_meters: radius,
        is_active: true,
      });

      if (error) {
        toast({ title: "שגיאה", description: "לא ניתן לשמור את המיקום", variant: "destructive" });
        setSaving(false);
        return;
      }
    }

    toast({ title: "המיקום נשמר בהצלחה" });
    await fetchData();
    setSaving(false);
  };

  const updateRadius = async (type: "HOME" | "SCHOOL", radius: number) => {
    const existing = getPlace(type);
    if (!existing) return;
    setSaving(true);

    const { error } = await supabase
      .from("child_places")
      .update({ radius_meters: radius })
      .eq("id", existing.id);

    if (error) {
      toast({ title: "שגיאה", description: "לא ניתן לעדכן את הרדיוס", variant: "destructive" });
    } else {
      toast({ title: "הרדיוס עודכן" });
      await fetchData();
    }
    setSaving(false);
  };

  const updateSettings = async (patch: Partial<GeofenceSettings>) => {
    if (!childId) return;
    setSaving(true);

    const newSettings = { ...settings, ...patch };

    if (settingsRowExists) {
      const { error } = await supabase
        .from("child_geofence_settings")
        .update(newSettings)
        .eq("child_id", childId);

      if (error) {
        toast({ title: "שגיאה", description: "לא ניתן לעדכן הגדרות", variant: "destructive" });
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from("child_geofence_settings").insert({
        child_id: childId,
        ...newSettings,
      });

      if (error) {
        toast({ title: "שגיאה", description: "לא ניתן לשמור הגדרות", variant: "destructive" });
        setSaving(false);
        return;
      }
      setSettingsRowExists(true);
    }

    setSettings(newSettings);
    setSaving(false);
  };

  const deletePlace = async (type: "HOME" | "SCHOOL") => {
    const existing = getPlace(type);
    if (!existing) return;
    setSaving(true);

    const { error } = await supabase
      .from("child_places")
      .delete()
      .eq("id", existing.id);

    if (error) {
      toast({ title: "שגיאה", description: "לא ניתן למחוק את המיקום", variant: "destructive" });
    } else {
      toast({ title: "המיקום הוסר" });
      await fetchData();
    }
    setSaving(false);
  };

  return {
    places,
    settings,
    loading,
    saving,
    getPlace,
    upsertPlace,
    updateRadius,
    updateSettings,
    deletePlace,
  };
}
