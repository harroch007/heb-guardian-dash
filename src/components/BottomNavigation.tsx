import { Home, Users, Bell, Settings } from "lucide-react";
import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "בית", url: "/", icon: Home },
  { title: "משפחה", url: "/family", icon: Users },
  { title: "התראות", url: "/alerts", icon: Bell },
  { title: "הגדרות", url: "/settings", icon: Settings },
];

export function BottomNavigation() {
  const location = useLocation();
  
  const isActive = (url: string) => {
    if (url === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(url);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border/50 md:hidden">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const active = isActive(item.url);
          return (
            <RouterNavLink
              key={item.url}
              to={item.url}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-4 py-2 transition-all duration-200",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div className={active ? "glow-primary" : ""}>
                <item.icon className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium">{item.title}</span>
            </RouterNavLink>
          );
        })}
      </div>
    </nav>
  );
}