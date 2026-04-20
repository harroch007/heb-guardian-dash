import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { NavbarV1 } from '@/components/landing-v1/NavbarV1';
import { HeroV1 } from '@/components/landing-v1/HeroV1';
import { TrustBar } from '@/components/landing-v1/TrustBar';
import { FeaturesGrid } from '@/components/landing-v1/FeaturesGrid';
import { CoachSpotlight } from '@/components/landing-v1/CoachSpotlight';
import { Differentiators } from '@/components/landing-v1/Differentiators';
import { HowItWorks } from '@/components/landing-v1/HowItWorks';
import { FreeAccessCTA } from '@/components/landing-v1/FreeAccessCTA';
import { FooterV1 } from '@/components/landing-v1/FooterV1';
import { CookieConsent } from '@/components/landing/CookieConsent';

export default function LandingV1() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/home-v2', { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading || user) return null;

  return (
    <div className="homev2-light min-h-screen bg-background text-foreground" dir="rtl">
      <NavbarV1 />
      <main id="main-content">
        <HeroV1 />
        <TrustBar />
        <FeaturesGrid />
        <CoachSpotlight />
        <Differentiators />
        <HowItWorks />
        <FreeAccessCTA />
      </main>
      <FooterV1 />
      <CookieConsent />
    </div>
  );
}
