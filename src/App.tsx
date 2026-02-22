import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AccessibilityProvider } from "@/contexts/AccessibilityContext";
import { WaitlistProvider } from "@/contexts/WaitlistContext";
import { DemoProvider, useDemo } from "@/contexts/DemoContext";
import { AccessibilityWrapper } from "@/components/accessibility/AccessibilityWrapper";
import { WaitlistRouteGuard } from "@/components/WaitlistRouteGuard";
import { WaitlistModal } from "@/components/WaitlistModal";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { ServiceWorkerUpdatePrompt } from "@/components/ServiceWorkerUpdatePrompt";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import Family from "./pages/Family";
import Dashboard from "./pages/Dashboard";
import ChildDashboard from "./pages/ChildDashboard";
import AlertsPage from "./pages/Alerts";
import SettingsPage from "./pages/Settings";
import DailyReport from "./pages/DailyReport";
import NotificationSettings from "./pages/NotificationSettings";
import Install from "./pages/Install";
import NotFound from "./pages/NotFound";
import AdminLogin from "./pages/AdminLogin";
import Admin from "./pages/Admin";

// Demo pages
import DemoDashboard from "./pages/demo/DemoDashboard";
import DemoChildDashboard from "./pages/demo/DemoChildDashboard";
import DemoAlerts from "./pages/demo/DemoAlerts";
import DemoDailyReport from "./pages/demo/DemoDailyReport";
import DemoFamily from "./pages/demo/DemoFamily";
import DemoSettings from "./pages/demo/DemoSettings";

const queryClient = new QueryClient();

// Smart routing component that checks demo mode
const AppRoutes = () => {
  const { isDemoMode } = useDemo();

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/install" element={<Install />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsOfService />} />
      
      {/* Dashboard - demo or protected */}
      <Route
        path="/dashboard"
        element={isDemoMode ? <DemoDashboard /> : <ProtectedRoute><Dashboard /></ProtectedRoute>}
      />
      
      {/* Family - demo or protected */}
      <Route
        path="/family"
        element={isDemoMode ? <DemoFamily /> : <ProtectedRoute><Family /></ProtectedRoute>}
      />
      
      {/* Child Dashboard - demo or protected */}
      <Route
        path="/child/:childId"
        element={isDemoMode ? <DemoChildDashboard /> : <ProtectedRoute><ChildDashboard /></ProtectedRoute>}
      />
      
      {/* Alerts - demo or protected */}
      <Route
        path="/alerts"
        element={isDemoMode ? <DemoAlerts /> : <ProtectedRoute><AlertsPage /></ProtectedRoute>}
      />
      
      {/* Settings - demo or protected */}
      <Route
        path="/settings"
        element={isDemoMode ? <DemoSettings /> : <ProtectedRoute><SettingsPage /></ProtectedRoute>}
      />
      
      {/* Daily Report - demo or protected */}
      <Route
        path="/daily-report/:childId"
        element={isDemoMode ? <DemoDailyReport /> : <ProtectedRoute><DailyReport /></ProtectedRoute>}
      />
      
      {/* Notification Settings - protected only */}
      <Route
        path="/notification-settings"
        element={<ProtectedRoute><NotificationSettings /></ProtectedRoute>}
      />
      
      {/* Onboarding - protected only (no demo version) */}
      <Route
        path="/onboarding"
        element={<ProtectedRoute><Onboarding /></ProtectedRoute>}
      />
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AccessibilityProvider>
      <WaitlistProvider>
        <DemoProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <WaitlistModal />
            <ServiceWorkerUpdatePrompt />
            <BrowserRouter>
              <AccessibilityWrapper />
              <Routes>
                {/* Admin routes - completely separate from main app */}
                <Route path="/admin-login" element={<AdminLogin />} />
                <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
                
                {/* Main app routes */}
                <Route path="/*" element={
                  <WaitlistRouteGuard>
                    <AuthProvider>
                      <AppRoutes />
                    </AuthProvider>
                  </WaitlistRouteGuard>
                } />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </DemoProvider>
      </WaitlistProvider>
    </AccessibilityProvider>
  </QueryClientProvider>
);

export default App;
