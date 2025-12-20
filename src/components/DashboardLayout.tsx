import { AppSidebar } from "./AppSidebar";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        <div className="scanline fixed inset-0 pointer-events-none z-50 opacity-30" />
        <div className="p-6 md:p-8 relative">
          {children}
        </div>
      </main>
    </div>
  );
}
