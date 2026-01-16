import { Home, Bell, Settings, Users, LogOut } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useDemo } from "@/contexts/DemoContext";
import { Button } from "@/components/ui/button";
import kippyLogo from "@/assets/kippy-logo.svg";

const navItems = [
  { title: "בית", url: "/dashboard", icon: Home },
  { title: "המשפחה שלי", url: "/family", icon: Users },
  { title: "התראות", url: "/alerts", icon: Bell },
  { title: "הגדרות", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { signOut } = useAuth();
  const { isDemoMode, exitDemoMode } = useDemo();

  const handleLogout = async () => {
    if (isDemoMode) {
      exitDemoMode();
      window.location.href = "/";
    } else {
      await signOut();
    }
  };

  const handleLogoClick = () => {
    window.location.href = "/dashboard";
  };

  return (
    <>
      {/* Sidebar - Desktop only */}
      <aside
        className={cn(
          "hidden md:flex fixed md:static top-0 right-0 h-screen w-64 bg-sidebar border-l border-sidebar-border z-40",
          "flex-col"
        )}
      >
        {/* Logo - clickable for refresh */}
        <div className="p-6 border-b border-sidebar-border">
          <button
            onClick={handleLogoClick}
            className="flex items-center gap-3 w-full text-right hover:opacity-80 transition-opacity"
          >
            <div className="p-1 rounded-lg glow-primary animate-glow-pulse">
              <img src={kippyLogo} alt="Kippy" className="w-10 h-10 rounded-lg" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground text-glow">Kippy</h1>
              <p className="text-xs text-muted-foreground">מרכז בטיחות</p>
            </div>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {navItems.map((item, index) => (
              <li key={item.url} style={{ animationDelay: `${index * 100}ms` }} className="animate-fade-in opacity-0">
                <NavLink
                  to={item.url}
                  end={item.url === "/"}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-all duration-200 group"
                  activeClassName="bg-primary/10 text-primary glow-primary border border-primary/30"
                >
                  <item.icon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  <span className="font-medium">{item.title}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Logout Button */}
        <div className="p-4">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={handleLogout}
          >
            <LogOut className="w-5 h-5" />
            <span>התנתק</span>
          </Button>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="p-3 rounded-lg bg-muted/50 cyber-border">
            <p className="text-xs text-muted-foreground text-center">
              מערכת מאובטחת ומוצפנת
            </p>
            <div className="flex justify-center gap-1 mt-2">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 h-1 rounded-full bg-primary animate-pulse-glow"
                  style={{ animationDelay: `${i * 200}ms` }}
                />
              ))}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}