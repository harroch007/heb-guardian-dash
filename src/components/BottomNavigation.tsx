import { forwardRef } from "react";
import { Home, Users, Bell, Settings, ClipboardList } from "lucide-react";
import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const navItems = [
  { title: "בית", url: "/dashboard", icon: Home },
  { title: "משפחה", url: "/family", icon: Users },
  { title: "משימות", url: "/chores", icon: ClipboardList },
  { title: "התראות", url: "/alerts", icon: Bell },
  { title: "הגדרות", url: "/settings", icon: Settings },
];

export const BottomNavigation = forwardRef<HTMLElement, object>(function BottomNavigation(_, ref) {
  const location = useLocation();
  const [alertsCount, setAlertsCount] = useState(0);
  
  const isActive = (url: string) => {
    if (url === "/dashboard") {
      return location.pathname === "/dashboard";
    }
    return location.pathname.startsWith(url);
  };

  useEffect(() => {
    const fetchAlertsCount = async () => {
      // 1. Fetch per-child alert thresholds from settings
      const { data: settingsData } = await supabase
        .from('settings')
        .select('child_id, alert_threshold')
        .not('child_id', 'is', null);

      const thresholds: Record<string, number> = {};
      settingsData?.forEach(s => {
        if (s.child_id) {
          thresholds[s.child_id] = s.alert_threshold ?? 65;
        }
      });

      // 2. Fetch alerts with same filters as Alerts page
      const { data } = await supabase
        .from('alerts')
        .select('id, child_id, ai_risk_score, remind_at')
        .eq('is_processed', true)
        .is('acknowledged_at', null)
        .is('saved_at', null)
        .is('parent_message', null)
        .eq('alert_type', 'warning')
        .in('ai_verdict', ['notify', 'review']);

      if (!data) {
        setAlertsCount(0);
        return;
      }

      // 3. Client-side filtering: threshold + remind_at (same as Alerts page)
      const now = new Date();
      const filtered = data.filter(a => {
        // Filter snoozed alerts
        if (a.remind_at && new Date(a.remind_at) >= now) return false;
        // Filter by sensitivity threshold
        const threshold = a.child_id ? (thresholds[a.child_id] ?? 65) : 65;
        return (a.ai_risk_score ?? 0) >= threshold;
      });

      setAlertsCount(filtered.length);
    };

    fetchAlertsCount();

    const channel = supabase
      .channel('alerts-count')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'alerts' },
        () => fetchAlertsCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <nav ref={ref} className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border/50 md:hidden">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const active = isActive(item.url);
          const showBadge = item.url === "/alerts" && alertsCount > 0;
          
          return (
            <RouterNavLink
              key={item.url}
              to={item.url}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-4 py-2 transition-all duration-200 relative",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div className={cn("relative", active && "glow-primary")}>
                <item.icon className="w-5 h-5" />
                {showBadge && (
                  <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold bg-destructive text-destructive-foreground rounded-full">
                    {alertsCount > 99 ? "99+" : alertsCount}
                  </span>
                )}
              </div>
              <span className="text-xs font-medium">{item.title}</span>
            </RouterNavLink>
          );
        })}
      </div>
    </nav>
  );
});

BottomNavigation.displayName = "BottomNavigation";