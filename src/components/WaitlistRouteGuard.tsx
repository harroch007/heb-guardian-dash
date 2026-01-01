// All imports commented out for debugging
// import { useEffect } from "react";
// import { useLocation, useNavigate } from "react-router-dom";
// import { WAITLIST_MODE } from "@/config/featureFlags";
// import { useWaitlist } from "@/contexts/WaitlistContext";

// Routes that should be blocked in waitlist mode
// const PROTECTED_ROUTES = ["/auth", "/onboarding", "/dashboard", "/family", "/child", "/alerts", "/settings"];

export function WaitlistRouteGuard({ children }: { children: React.ReactNode }) {
  // All logic disabled for debugging
  // const location = useLocation();
  // const navigate = useNavigate();
  // const { openModal } = useWaitlist();

  // useEffect(() => {
  //   if (!WAITLIST_MODE) return;
  //   const isProtectedRoute = PROTECTED_ROUTES.some(
  //     (route) => location.pathname === route || location.pathname.startsWith(route + '/')
  //   );
  //   if (isProtectedRoute) {
  //     navigate('/', { replace: true });
  //     openModal();
  //   }
  // }, [location.pathname, navigate, openModal]);

  return <>{children}</>;
}
