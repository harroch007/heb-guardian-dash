import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { WAITLIST_MODE } from '@/config/featureFlags';
import { useWaitlist } from '@/contexts/WaitlistContext';

// Routes that should be blocked in waitlist mode
const PROTECTED_ROUTES = [
  '/auth',
  '/onboarding',
  '/dashboard',
  '/family',
  '/child',
  '/alerts',
  '/settings',
];

export function WaitlistRouteGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { openModal } = useWaitlist();

  useEffect(() => {
    if (!WAITLIST_MODE) return;

    const isProtectedRoute = PROTECTED_ROUTES.some(
      (route) => location.pathname === route || location.pathname.startsWith(route + '/')
    );

    if (isProtectedRoute) {
      // Redirect to home and open waitlist modal
      navigate('/', { replace: true });
      openModal();
    }
  }, [location.pathname, navigate, openModal]);

  return <>{children}</>;
}
