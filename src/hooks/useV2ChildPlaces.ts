import { useCallback, useEffect, useState } from "react";
import { v2Supabase } from "@/integrations/supabase/v2-client";
import { useToast } from "@/hooks/use-toast";

export interface ChildPlace {
  id: string;
  child_id: string;
  place_type: "HOME" | "SCHOOL" | "MANUAL";
  label: string | null;
  latitude: number;
  longitude: number;
  radius_meters: number;
  is_active: boolean;
  alert_on_enter: boolean;
  alert_on_exit: boolean;
  schedule_mode: "ALWAYS" | "SCHEDULED";
  days_of_week: number[] | null;
  start_time: string | null;
  end_time: string | null;
}

export interface GeofenceSettings {
  home_exit_alert_enabled: boolean;
  school_exit_alert_enabled: boolean;
  exit_debounce_seconds: number;
}

export interface ManualPlaceInput {
  label: string;
  latitude: number;
  longitude: number;
  radius_meters?: number;
  alert_on_enter: boolean;
  alert_on_exit: boolean;
  schedule_mode: "ALWAYS" | "SCHEDULED";
  days_of_week?: number[];
  start_time?: string;
  end_time?: string;
}

const DEFAULT_SETTINGS: GeofenceSettings = {
  home_exit_alert_enabled: true,
  school_exit_alert_enabled: true,
  exit_debounce_seconds: 120,
};

const DEFAULT_RADIUS: Record<ChildPlace["place_type"], number> = {
  HOME: 150,
  SCHOOL: 250,
  MANUAL: 200,
};

const requestKey = (prefix: string) => `${prefix}:${crypto.randomUUID()}`;
const nullableText = (value: string | null) =>
  value as unknown as string;
const nullableDays = (value: number[] | null) =>
  value as unknown as number[];

const toDatabasePlaceType = (value: ChildPlace["place_type"]) =>
  value.toLowerCase();

const toUiPlaceType = (value: string): ChildPlace["place_type"] => {
  if (value === "home") return "HOME";
  if (value === "school") return "SCHOOL";
  return "MANUAL";
};

export function useV2ChildPlaces(childId: string | undefined) {
  const [places, setPlaces] = useState<ChildPlace[]>([]);
  const [settings, setSettings] =
    useState<GeofenceSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    if (!childId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [placesResult, settingsResult] = await Promise.all([
      v2Supabase
        .from("v2_parental_geofences")
        .select("*")
        .eq("child_id", childId)
        .order("created_at"),
      v2Supabase
        .from("v2_parental_settings")
        .select(
          "home_exit_alert_enabled, school_exit_alert_enabled, exit_debounce_seconds",
        )
        .eq("child_id", childId)
        .maybeSingle(),
    ]);

    if (!placesResult.error) {
      setPlaces(
        (placesResult.data || []).map((place) => ({
          id: place.id,
          child_id: place.child_id,
          place_type: toUiPlaceType(place.place_type),
          label: place.label,
          latitude: place.latitude,
          longitude: place.longitude,
          radius_meters: place.radius_meters,
          is_active: place.is_active,
          alert_on_enter: place.alert_on_enter,
          alert_on_exit: place.alert_on_exit,
          schedule_mode:
            place.schedule_mode === "scheduled" ? "SCHEDULED" : "ALWAYS",
          days_of_week: place.days_of_week,
          start_time: place.start_time,
          end_time: place.end_time,
        })),
      );
    }

    if (!settingsResult.error && settingsResult.data) {
      setSettings({
        home_exit_alert_enabled:
          settingsResult.data.home_exit_alert_enabled,
        school_exit_alert_enabled:
          settingsResult.data.school_exit_alert_enabled,
        exit_debounce_seconds:
          settingsResult.data.exit_debounce_seconds,
      });
    } else {
      setSettings(DEFAULT_SETTINGS);
    }
    setLoading(false);
  }, [childId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const getPlace = (type: "HOME" | "SCHOOL") =>
    places.find(
      (place) => place.place_type === type && place.is_active,
    ) || null;

  const writePlace = async (place: ChildPlace) => {
    if (!childId) return;
    const { error } = await v2Supabase.rpc(
      "v2_upsert_parental_geofence",
      {
        target_child_id: childId,
        target_geofence_id: place.id,
        target_place_type: toDatabasePlaceType(place.place_type),
        target_label: place.label ?? "",
        target_latitude: place.latitude,
        target_longitude: place.longitude,
        target_radius_meters: place.radius_meters,
        target_is_active: place.is_active,
        target_alert_on_enter: place.alert_on_enter,
        target_alert_on_exit: place.alert_on_exit,
        target_schedule_mode:
          place.schedule_mode === "SCHEDULED" ? "scheduled" : "always",
        target_days_of_week: nullableDays(place.days_of_week),
        target_start_time: nullableText(place.start_time),
        target_end_time: nullableText(place.end_time),
        target_request_key: requestKey("geofence-upsert"),
      },
    );
    if (error) throw error;
  };

  const upsertPlace = async (
    type: "HOME" | "SCHOOL",
    data: {
      latitude: number;
      longitude: number;
      label?: string;
      radius_meters?: number;
    },
  ) => {
    if (!childId) return;
    setSaving(true);
    const existing = getPlace(type);
    try {
      await writePlace({
        id: existing?.id ?? crypto.randomUUID(),
        child_id: childId,
        place_type: type,
        label:
          data.label ??
          existing?.label ??
          (type === "HOME" ? "בית" : "בית ספר"),
        latitude: data.latitude,
        longitude: data.longitude,
        radius_meters:
          data.radius_meters ??
          existing?.radius_meters ??
          DEFAULT_RADIUS[type],
        is_active: true,
        alert_on_enter: existing?.alert_on_enter ?? false,
        alert_on_exit:
          type === "HOME"
            ? settings.home_exit_alert_enabled
            : settings.school_exit_alert_enabled,
        schedule_mode: existing?.schedule_mode ?? "ALWAYS",
        days_of_week: existing?.days_of_week ?? null,
        start_time: existing?.start_time ?? null,
        end_time: existing?.end_time ?? null,
      });
      toast({ title: "המיקום נשמר בהצלחה" });
      await fetchData();
    } catch (error) {
      console.error(error);
      toast({
        title: "שגיאה",
        description: "לא ניתן לשמור את המיקום",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateRadius = async (
    type: "HOME" | "SCHOOL",
    radius: number,
  ) => {
    const existing = getPlace(type);
    if (!existing) return;
    setSaving(true);
    try {
      await writePlace({ ...existing, radius_meters: radius });
      toast({ title: "הרדיוס עודכן" });
      await fetchData();
    } catch (error) {
      console.error(error);
      toast({
        title: "שגיאה",
        description: "לא ניתן לעדכן את הרדיוס",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateSettings = async (patch: Partial<GeofenceSettings>) => {
    if (!childId) return;
    setSaving(true);
    const next = { ...settings, ...patch };
    try {
      const { error } = await v2Supabase.rpc(
        "v2_set_geofence_preferences",
        {
          target_child_id: childId,
          target_home_exit_alert_enabled:
            next.home_exit_alert_enabled,
          target_school_exit_alert_enabled:
            next.school_exit_alert_enabled,
          target_exit_debounce_seconds:
            next.exit_debounce_seconds,
          target_request_key: requestKey("geofence-preferences"),
        },
      );
      if (error) throw error;

      const home = getPlace("HOME");
      if (
        home &&
        home.alert_on_exit !== next.home_exit_alert_enabled
      ) {
        await writePlace({
          ...home,
          alert_on_exit: next.home_exit_alert_enabled,
        });
      }
      const school = getPlace("SCHOOL");
      if (
        school &&
        school.alert_on_exit !== next.school_exit_alert_enabled
      ) {
        await writePlace({
          ...school,
          alert_on_exit: next.school_exit_alert_enabled,
        });
      }

      setSettings(next);
    } catch (error) {
      console.error(error);
      toast({
        title: "שגיאה",
        description: "לא ניתן לעדכן הגדרות",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const deletePlace = async (type: "HOME" | "SCHOOL") => {
    const existing = getPlace(type);
    if (!existing || !childId) return;
    setSaving(true);
    const { error } = await v2Supabase.rpc(
      "v2_delete_parental_geofence",
      {
        target_child_id: childId,
        target_geofence_id: existing.id,
        target_request_key: requestKey("geofence-delete"),
      },
    );
    if (error) {
      toast({
        title: "שגיאה",
        description: "לא ניתן למחוק את המיקום",
        variant: "destructive",
      });
    } else {
      toast({ title: "המיקום הוסר" });
      await fetchData();
    }
    setSaving(false);
  };

  const manualPlaces = places.filter(
    (place) =>
      place.place_type === "MANUAL" && place.is_active,
  );

  const upsertManualPlace = async (
    data: ManualPlaceInput,
    existingId?: string,
  ) => {
    if (!childId) return;
    setSaving(true);
    const existing = existingId
      ? places.find((place) => place.id === existingId)
      : null;
    try {
      await writePlace({
        id: existingId ?? crypto.randomUUID(),
        child_id: childId,
        place_type: "MANUAL",
        label: data.label,
        latitude: data.latitude,
        longitude: data.longitude,
        radius_meters:
          data.radius_meters ?? DEFAULT_RADIUS.MANUAL,
        is_active: true,
        alert_on_enter: data.alert_on_enter,
        alert_on_exit: data.alert_on_exit,
        schedule_mode: data.schedule_mode,
        days_of_week:
          data.schedule_mode === "SCHEDULED"
            ? data.days_of_week ?? null
            : null,
        start_time:
          data.schedule_mode === "SCHEDULED"
            ? data.start_time ?? null
            : null,
        end_time:
          data.schedule_mode === "SCHEDULED"
            ? data.end_time ?? null
            : null,
        ...(existing ? { child_id: existing.child_id } : {}),
      });
      toast({
        title: existingId
          ? "המקום עודכן"
          : "המקום נוסף בהצלחה",
      });
      await fetchData();
    } catch (error) {
      console.error(error);
      toast({
        title: "שגיאה",
        description: "לא ניתן לשמור את המקום",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const deactivateManualPlace = async (id: string) => {
    const existing = places.find((place) => place.id === id);
    if (!existing) return;
    setSaving(true);
    try {
      await writePlace({ ...existing, is_active: false });
      toast({ title: "המקום הושבת" });
      await fetchData();
    } catch (error) {
      console.error(error);
      toast({
        title: "שגיאה",
        description: "לא ניתן להשבית את המקום",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
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
    manualPlaces,
    upsertManualPlace,
    deactivateManualPlace,
  };
}
