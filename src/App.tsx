import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useParams } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AccessibilityProvider } from "@/contexts/AccessibilityContext";
import { WaitlistProvider } from "@/contexts/WaitlistContext";
import { DemoProvider } from "@/contexts/DemoContext";
import { AccessibilityWrapper } from "@/components/accessibility/AccessibilityWrapper";
import { WaitlistRouteGuard } from "@/components/WaitlistRouteGuard";
import { WaitlistModal } from "@/components/WaitlistModal";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ServiceWorkerUpdatePrompt } from "@/components/ServiceWorkerUpdatePrompt";
import { Navigate } from "react-router-dom";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import Install from "./pages/Install";
import ChildInstallLanding from "./pages/ChildInstallLanding";
import NotFound from "./pages/NotFound";
import GuardianHomeV2 from "./pages/GuardianHomeV2";
import GuardianChildV2 from "./pages/GuardianChildV2";
import AlertsV2 from "./pages/AlertsV2Canonical";
import SettingsV2 from "./pages/SettingsV2Canonical";
import GuardianFamilyV2 from "./pages/GuardianFamilyV2";
import LandingV1 from "./pages/LandingV1";
import { ControlTowerEntry } from "@/features/control-tower";

const queryClient = new QueryClient();

// Redirect helper preserving :childId param from V1 → V2
const RedirectChildToV2 = () => {
  const { childId } = useParams();
  return <Navigate to={`/child-v2/${childId}`} replace />;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<LandingV1 />} />
      <Route path="/landing-v1" element={<LandingV1 />} />
      <Route path="/next" element={<Navigate to="/landing-v1" replace />} />
      <Route path="/home-v2" element={<ProtectedRoute><GuardianHomeV2 /></ProtectedRoute>} />
      <Route path="/child-v2/:childId" element={<ProtectedRoute><GuardianChildV2 /></ProtectedRoute>} />
      <Route path="/chores-v2" element={<Navigate to="/home-v2" replace />} />
      <Route path="/alerts-v2" element={<ProtectedRoute><AlertsV2 /></ProtectedRoute>} />
      <Route path="/settings-v2" element={<ProtectedRoute><SettingsV2 /></ProtectedRoute>} />
      <Route path="/family-v2" element={<ProtectedRoute><GuardianFamilyV2 /></ProtectedRoute>} />
      <Route path="/chat-v2" element={<Navigate to="/home-v2" replace />} />
      <Route path="/chat-v2/:friendshipId" element={<Navigate to="/home-v2" replace />} />
      <Route path="/accept-invite/:inviteId" element={<Navigate to="/family-v2" replace />} />
      <Route path="/invite/:token" element={<Navigate to="/home-v2" replace />} />
      <Route path="/join-family" element={<Navigate to="/family-v2" replace />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/install" element={<Install />} />
      <Route
        path="/install/:activationToken"
        element={<ChildInstallLanding />}
      />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsOfService />} />
      
      {/* Legacy V1 routes redirect to V2 equivalents */}
      <Route path="/dashboard" element={<Navigate to="/home-v2" replace />} />
      <Route path="/family" element={<Navigate to="/family-v2" replace />} />
      <Route path="/child/:childId" element={<RedirectChildToV2 />} />
      <Route path="/alerts" element={<Navigate to="/alerts-v2" replace />} />
      <Route path="/chores" element={<Navigate to="/home-v2" replace />} />
      <Route path="/settings" element={<Navigate to="/settings-v2" replace />} />

      <Route path="/daily-report/:childId" element={<Navigate to="/home-v2" replace />} />
      <Route path="/summary/:childId/:type" element={<Navigate to="/home-v2" replace />} />
      <Route path="/notification-settings" element={<Navigate to="/settings-v2" replace />} />
      <Route path="/checkout" element={<Navigate to="/home-v2" replace />} />
      
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
                {/* Legacy V1 admin surfaces stay in source, but are not active in V2. */}
                <Route path="/admin-login" element={<Navigate to="/auth" replace />} />
                <Route path="/admin" element={<Navigate to="/home-v2" replace />} />
                <Route path="/impersonate-session" element={<Navigate to="/home-v2" replace />} />
                <Route path="/control-tower/*" element={<ControlTowerEntry />} />
                
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
