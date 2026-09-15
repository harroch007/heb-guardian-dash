import { useEffect, useState } from "react";
import { v2Supabase } from "@/integrations/supabase/v2-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ChildWithData } from "@/pages/HomeV2";
import { useAuth } from "@/contexts/AuthContext";
import {
  isManageableInstalledApp,
  isOutsideStoreInstall,
  saveAppPolicy,
} from "@/lib/parental-controls/settingsService";

interface PendingApp {
  child_id: string;
  package_name: string;
  app_name: string | null;
  last_seen_at: string;
  is_system: boolean;
  is_launchable: boolean;
  install_source: string;
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

export const HomePendingApps = ({ childrenData }: Props) => {
  const { user } = useAuth();
  const [apps, setApps] = useState<PendingApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const childIds = childrenData.map((c) => c.id);
  const childIdsKey = childIds.join(",");
  const nameById = new Map(childrenData.map((c) => [c.id, c.name]));

  const fetchPending = async () => {
    if (childIds.length === 0) {
      setApps([]);
      setLoading(false);
      return;
    }
    const [devicesRes, policiesRes] = await Promise.all([
      v2Supabase
        .from("v2_protected_devices")
        .select("id, child_id")
        .in("child_id", childIds)
        .neq("status", "revoked"),
      v2Supabase
        .from("v2_parental_app_policies")
        .select("child_id, package_name")
        .in("child_id", childIds),
    ]);

    if (devicesRes.error || policiesRes.error) {
      setApps([]);
      setLoading(false);
      return;
    }

    const childByDevice = new Map(
      (devicesRes.data || []).map((device) => [device.id, device.child_id]),
    );
    const deviceIds = [...childByDevice.keys()];
    if (deviceIds.length === 0) {
      setApps([]);
      setLoading(false);
      return;
    }

    const { data: installed, error: installedError } = await v2Supabase
      .from("v2_parental_installed_apps")
      .select(
        "device_id, package_name, app_name, last_seen_at, is_system, is_launchable, install_source",
      )
      .in("device_id", deviceIds)
      .eq("is_installed", true)
      .eq("is_system", false)
      .eq("is_launchable", true)
      .order("last_seen_at", { ascending: false });

    if (installedError) {
      setApps([]);
      setLoading(false);
      return;
    }

    const policyKey = new Set(
      (policiesRes.data || []).map((p) => `${p.child_id}|${p.package_name}`)
    );

    const pending = (installed || [])
      .map((app) => ({
        child_id: childByDevice.get(app.device_id) || "",
        package_name: app.package_name,
        app_name: app.app_name,
        last_seen_at: app.last_seen_at,
        is_system: app.is_system,
        is_launchable: app.is_launchable,
        install_source: app.install_source,
      }))
      .filter((app) => {
        if (!app.child_id) return false;
        if (policyKey.has(`${app.child_id}|${app.package_name}`)) return false;
        return isManageableInstalledApp(app);
      });

    setApps(pending.slice(0, 5));
    setLoading(false);
  };

  useEffect(() => {
    fetchPending();
    if (childIds.length === 0) return;
    const channel = v2Supabase
      .channel("home-pending-apps")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "v2_parental_installed_apps" },
        () => fetchPending()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "v2_parental_app_policies" },
        () => fetchPending()
      )
      .subscribe();
    return () => {
      v2Supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childIdsKey]);

  const decide = async (app: PendingApp, allow: boolean) => {
    if (!user?.id) return;
    const key = `${app.child_id}|${app.package_name}`;
    setActing(key);
    try {
      await saveAppPolicy({
        childId: app.child_id,
        parentId: user.id,
        packageName: app.package_name,
        appName: app.app_name,
        blocked: !allow,
      });
      toast.success(
        allow
          ? "בקשת האישור נשלחה למכשיר"
          : "בקשת החסימה נשלחה למכשיר",
      );
      setApps((prev) => prev.filter((item) => `${item.child_id}|${item.package_name}` !== key));
    } catch {
      toast.error("שגיאה בעדכון האפליקציה");
    }
    setActing(null);
  };

  if (loading || apps.length === 0) return null;

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardContent className="py-3 px-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-amber-600">
          <Download className="w-4 h-4" />
          <span>אפליקציות חדשות ממתינות לאישור</span>
        </div>
        {apps.map((app) => {
          const key = `${app.child_id}|${app.package_name}`;
          const childName = nameById.get(app.child_id) || "";
          return (
            <div
              key={key}
              className="flex items-center justify-between gap-2 bg-card rounded-lg px-3 py-2 border border-border/50"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">
                  <span className="font-medium">{childName}</span>
                  {" · "}
                  {app.app_name || app.package_name}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {timeAgo(app.last_seen_at)}
                </p>
                {isOutsideStoreInstall(app.install_source) && (
                  <Badge
                    variant="outline"
                    className="mt-1 h-5 border-amber-500/40 px-1.5 text-[10px] text-amber-600"
                  >
                    הותקנה מחוץ לחנות
                  </Badge>
                )}
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive hover:bg-destructive/10"
                  onClick={() => decide(app, false)}
                  disabled={acting === key}
                  aria-label="חסום"
                >
                  {acting === key ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <X className="w-3.5 h-3.5" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-success hover:bg-success/10"
                  onClick={() => decide(app, true)}
                  disabled={acting === key}
                  aria-label="אישור"
                >
                  {acting === key ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
