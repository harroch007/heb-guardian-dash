import { Home, Users, Bell, Settings } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

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
  return (
    <nav
      className="hidden md:block sticky top-0 z-40 bg-card/90 backdrop-blur border-b border-primary/20"
      dir="rtl"
    >
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="text-base font-bold text-foreground">KippyAI</div>
        <div className="flex items-center gap-1">
          {navItems.map((item) => (
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
              <item.icon className="w-4 h-4" />
              <span>{item.title}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
