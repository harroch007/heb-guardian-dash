import { Home, Bell, Settings, Shield, Menu, X } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "בית", url: "/", icon: Home },
  { title: "התראות", url: "/alerts", icon: Bell },
  { title: "הגדרות", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 right-4 z-50 p-2 rounded-lg bg-card border border-primary/30 text-primary md:hidden glow-primary"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed md:static top-0 right-0 h-screen w-64 bg-sidebar border-l border-sidebar-border z-40 transition-transform duration-300",
          "flex flex-col",
          isOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 glow-primary animate-glow-pulse">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground text-glow">מרכז בקרה</h1>
              <p className="text-xs text-muted-foreground">הורית</p>
            </div>
          </div>
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
