import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Check } from "lucide-react";
import type { ChildWithData } from "@/pages/HomeV2";

interface GeofenceAlert {
  id: number;
  child_id: string | null;
  parent_message: string | null;
  created_at: string;
  alert_type: string | null;
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
  const [acking, setAcking] = useState<number | null>(null);

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
    const { data } = await supabase
      .from("alerts")
      .select("id, child_id, parent_message, created_at, alert_type")
      .in("child_id", childIds)
      .eq("category", "geofence")
      .is("acknowledged_at", null)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5);
    setAlerts((data as GeofenceAlert[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAlerts();
    if (childIds.length === 0) return;
    const channel = supabase
      .channel(`home-geofence-alerts`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alerts" },
        () => fetchAlerts(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childIdsKey]);

  const handleAck = async (id: number) => {
    setAcking(id);
    await supabase
      .from("alerts")
      .update({ acknowledged_at: new Date().toISOString() })
      .eq("id", id);
    setAcking(null);
    fetchAlerts();
  };

  if (loading || alerts.length === 0) return null;

  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="py-3 px-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-destructive">
          <MapPin className="w-4 h-4" />
          <span>התראות מיקום</span>
        </div>
        {alerts.map((a) => {
          const childName = a.child_id ? nameById.get(a.child_id) : null;
          return (
            <div
              key={a.id}
              className="flex items-center justify-between gap-2 bg-card rounded-lg px-3 py-2 border border-border/50"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">
                  {a.parent_message || `${childName ?? "הילד/ה"} — חריגה מאזור מוגדר`}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {timeAgo(a.created_at)}
                </p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => navigate("/alerts-v2")}
                >
                  פרטים
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-success hover:bg-success/10"
                  onClick={() => handleAck(a.id)}
                  disabled={acking === a.id}
                  aria-label="סמן כנקרא"
                >
                  <Check className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
