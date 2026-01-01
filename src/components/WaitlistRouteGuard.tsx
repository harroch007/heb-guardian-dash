import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { WAITLIST_MODE } from '@/config/featureFlags';
import { useWaitlist } from '@/contexts/WaitlistContext';

// Routes that should be blocked in waitlist mode (login allowed, signup blocked)
const PROTECTED_ROUTES = [
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

    // Allow /auth for login, but block signup attempts
    if (location.pathname === '/auth') {
      const searchParams = new URLSearchParams(location.search);
      if (searchParams.get('signup') === 'true') {
        // Block signup - redirect to home and open waitlist
        navigate('/', { replace: true });
        openModal();
      }
      // Otherwise allow login
      return;
    }

    const isProtectedRoute = PROTECTED_ROUTES.some(
      (route) => location.pathname === route || location.pathname.startsWith(route + '/')
    );

    if (isProtectedRoute) {
      // Redirect to home and open waitlist modal
      navigate('/', { replace: true });
      openModal();
    }
  }, [location.pathname, location.search, navigate, openModal]);

  return <>{children}</>;
}
