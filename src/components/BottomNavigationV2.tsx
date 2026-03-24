import { Home, Users, ClipboardList, Bell, Settings } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "בית", url: "/home-v2", icon: Home },
  { title: "משפחה", url: "/family-v2", icon: Users },
  { title: "משימות", url: "/chores-v2", icon: ClipboardList },
  { title: "התראות", url: "/alerts-v2", icon: Bell },
  { title: "הגדרות", url: "/settings-v2", icon: Settings },
];

export function BottomNavigationV2() {
  const location = useLocation();

  const isActive = (url: string) => {
    return location.pathname === url || location.pathname.startsWith(url + "/");
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border/50 md:hidden">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const active = isActive(item.url);
          return (
            <NavLink
              key={item.url}
              to={item.url}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-4 py-2 transition-all duration-200",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className={cn("w-5 h-5", active && "stroke-[2.5]")} />
              <span className={cn("text-xs", active ? "font-bold" : "font-medium")}>
                {item.title}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
