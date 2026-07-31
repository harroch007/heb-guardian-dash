import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { v2Supabase } from "@/integrations/supabase/v2-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";
import type { ChildWithData } from "@/pages/HomeV2";

interface GeofenceAlert {
  id: string;
  child_id: string;
  message: string;
  occurred_at: string;
}

interface Props {
  childrenData: ChildWithData[];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "עכשיו";
  if (mins < 60) return `לפני ${mins} דק׳`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `לפני ${hours} שע׳`;
  return `לפני ${Math.floor(hours / 24)} ימים`;
}

export const HomePendingGeofenceAlerts = ({ childrenData }: Props) => {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<GeofenceAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const childIds = childrenData.map((c) => c.id);
  const childIdsKey = childIds.join(",");
  const nameById = new Map(childrenData.map((c) => [c.id, c.name]));

  const fetchAlerts = async () => {
    if (childIds.length === 0) {
      setAlerts([]);
      setLoading(false);
      return;
    }
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [devicesResult, geofencesResult] = await Promise.all([
      v2Supabase
        .from("v2_protected_devices")
        .select("id, child_id")
        .in("child_id", childIds)
        .neq("status", "revoked"),
      v2Supabase
        .from("v2_parental_geofences")
        .select("id, child_id, label, place_type")
        .in("child_id", childIds),
    ]);

    if (devicesResult.error || geofencesResult.error) {
      setAlerts([]);
      setLoading(false);
      return;
    }

    const childByDevice = new Map(
      (devicesResult.data || []).map((device) => [device.id, device.child_id]),
    );
    const deviceIds = [...childByDevice.keys()];
    if (deviceIds.length === 0) {
      setAlerts([]);
      setLoading(false);
      return;
    }

    const geofenceById = new Map(
      (geofencesResult.data || []).map((geofence) => [
        geofence.id,
        geofence.label || geofence.place_type,
      ]),
    );

    const { data, error } = await v2Supabase
      .from("v2_parental_geofence_events")
      .select("id, device_id, geofence_id, transition, occurred_at")
      .in("device_id", deviceIds)
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: false })
      .limit(5);

    if (error) {
      setAlerts([]);
      setLoading(false);
      return;
    }

    setAlerts(
      (data || [])
        .map((event) => {
          const childId = childByDevice.get(event.device_id);
          if (!childId) return null;
          const childName = nameById.get(childId) || "הילד/ה";
          const place = geofenceById.get(event.geofence_id) || "אזור מוגדר";
          const action =
            event.transition === "enter" ? "נכנס/ה אל" : "יצא/ה מתוך";
          return {
            id: event.id,
            child_id: childId,
            message: `${childName} ${action} ${place}`,
            occurred_at: event.occurred_at,
          };
        })
        .filter((event): event is GeofenceAlert => event !== null),
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchAlerts();
    if (childIds.length === 0) return;
    const channel = v2Supabase
      .channel(`home-geofence-alerts`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "v2_parental_geofence_events" },
        () => fetchAlerts(),
      )
      .subscribe();
    return () => {
      v2Supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childIdsKey]);

  if (loading || alerts.length === 0) return null;

  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="py-3 px-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-destructive">
          <MapPin className="w-4 h-4" />
          <span>התראות מיקום</span>
        </div>
        {alerts.map((a) => {
          return (
            <div
              key={a.id}
              className="flex items-center justify-between gap-2 bg-card rounded-lg px-3 py-2 border border-border/50"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">
                  {a.message}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {timeAgo(a.occurred_at)}
                </p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => navigate(`/child-v2/${a.child_id}`)}
                >
                  פרטים
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
