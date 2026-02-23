import { AppSidebar } from "./AppSidebar";
import { BottomNavigation } from "./BottomNavigation";
import { ImpersonationBanner } from "./ImpersonationBanner";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex min-h-screen w-full bg-background flex-col">
      <ImpersonationBanner />
      <div className="flex flex-1">
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        <div className="scanline fixed inset-0 pointer-events-none z-50 opacity-30" />
        <div className="p-3 sm:p-6 md:p-8 pb-20 md:pb-8 relative">
          {children}
        </div>
      </main>
      <BottomNavigation />
      </div>
    </div>
  );
}