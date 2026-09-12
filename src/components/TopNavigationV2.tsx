import { Home, Users, Bell, Settings } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useV2NavBadgeCounts } from "@/hooks/useV2NavBadgeCounts";

const navItems = [
  { title: "בית", url: "/home-v2", icon: Home },
  { title: "משפחה", url: "/family-v2", icon: Users },
  { title: "התראות", url: "/alerts-v2", icon: Bell },
  { title: "הגדרות", url: "/settings-v2", icon: Settings },
];

/**
 * Desktop-only top navigation for V2 pages.
 * Mobile uses BottomNavigationV2 (md:hidden), desktop uses this (hidden md:flex).
 */
export function TopNavigationV2() {
  // The mobile surface owns the shared realtime listener, even when CSS-hidden.
  // This observer shares its scoped query and also has the visible polling fallback.
  const counts = useV2NavBadgeCounts({ subscribeToChanges: false });

  return (
    <nav
      className="hidden md:block sticky top-0 z-40 bg-card/90 backdrop-blur border-b border-primary/20"
      dir="rtl"
    >
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="text-base font-bold text-foreground">KippyAI</div>
        <div className="flex items-center gap-1">
          {navItems.map((item) => {
            const count = item.url === "/alerts-v2" ? counts.alerts
              : item.url === "/home-v2" ? counts.home : 0;
            return (
              <NavLink
                key={item.url}
                to={item.url}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                    isActive
                      ? "bg-primary/15 text-primary font-bold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  )
                }
              >
                <item.icon aria-hidden="true" className="w-4 h-4" />
                <span>{item.title}</span>
                {count > 0 && (
                  <span
                    className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white"
                    aria-label={`${count} ממתינים לטיפול`}
                  >
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
