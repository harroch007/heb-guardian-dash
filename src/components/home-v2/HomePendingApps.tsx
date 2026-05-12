import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, X, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { isSystemApp } from "@/lib/appUtils";
import type { ChildWithData } from "@/pages/HomeV2";

interface PendingApp {
  child_id: string;
  package_name: string;
  app_name: string | null;
  last_seen_at: string;
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
    const [installedRes, policiesRes] = await Promise.all([
      supabase
        .from("installed_apps")
        .select("child_id, package_name, app_name, last_seen_at, is_system")
        .in("child_id", childIds)
        .order("last_seen_at", { ascending: false }),
      supabase
        .from("app_policies")
        .select("child_id, package_name")
        .in("child_id", childIds),
    ]);

    const policyKey = new Set(
      (policiesRes.data || []).map((p) => `${p.child_id}|${p.package_name}`)
    );

    const pending = (installedRes.data || []).filter((a) => {
      if (policyKey.has(`${a.child_id}|${a.package_name}`)) return false;
      if (a.is_system) return false;
      if (isSystemApp(a.package_name)) return false;
      return true;
    });

    setApps(pending.slice(0, 5));
    setLoading(false);
  };

  useEffect(() => {
    fetchPending();
    if (childIds.length === 0) return;
    const channel = supabase
      .channel("home-pending-apps")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "installed_apps" },
        () => fetchPending()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_policies" },
        () => fetchPending()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childIdsKey]);

  const decide = async (app: PendingApp, allow: boolean) => {
    const key = `${app.child_id}|${app.package_name}`;
    setActing(key);
    const { error } = await supabase.from("app_policies").insert({
      child_id: app.child_id,
      package_name: app.package_name,
      app_name: app.app_name,
      is_blocked: !allow,
    });
    if (error) {
      toast.error("שגיאה בעדכון האפליקציה");
    } else {
      toast.success(allow ? "האפליקציה אושרה" : "האפליקציה נחסמה");
      setApps((prev) => prev.filter((a) => `${a.child_id}|${a.package_name}` !== key));
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
