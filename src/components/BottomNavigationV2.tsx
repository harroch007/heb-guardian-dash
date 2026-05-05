import { Home, Users, ClipboardList, Bell, Settings, MessageCircle } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { WHATSAPP_MONITORING_ENABLED } from "@/config/featureFlags";
import { useUnreadChatTotal } from "@/hooks/useUnreadChatTotal";

const allNavItems = [
  { title: "בית", url: "/home-v2", icon: Home, key: "home" },
  { title: "משפחה", url: "/family-v2", icon: Users, key: "family" },
  { title: "צ'אט", url: "/chat-v2", icon: MessageCircle, key: "chat" },
  { title: "משימות", url: "/chores-v2", icon: ClipboardList, key: "chores" },
  { title: "התראות", url: "/alerts-v2", icon: Bell, key: "alerts", requiresWhatsApp: true },
  { title: "הגדרות", url: "/settings-v2", icon: Settings, key: "settings" },
];

const navItems = allNavItems.filter(
  (item) => WHATSAPP_MONITORING_ENABLED || !item.requiresWhatsApp
);

export function BottomNavigationV2() {
  const location = useLocation();
  const unreadChat = useUnreadChatTotal();

  const isActive = (url: string) => {
    return location.pathname === url || location.pathname.startsWith(url + "/");
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card/90 backdrop-blur border-t border-primary/20 md:hidden">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const active = isActive(item.url);
          const showBadge = item.key === "chat" && unreadChat > 0;
          return (
            <NavLink
              key={item.url}
              to={item.url}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 px-1 py-2 transition-all duration-200",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <span className="relative">
                <item.icon className={cn("w-5 h-5", active && "stroke-[2.5]")} />
                {showBadge && (
                  <span
                    className="absolute -top-1.5 -right-2 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-white bg-red-500 ring-2 ring-card"
                    aria-label={`${unreadChat} הודעות חדשות`}
                  >
                    {unreadChat > 99 ? "99+" : unreadChat}
                  </span>
                )}
              </span>
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
