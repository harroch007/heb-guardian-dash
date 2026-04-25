import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { NavbarV1 } from '@/components/landing-v1/NavbarV1';
import { HeroV1 } from '@/components/landing-v1/HeroV1';
import { EmpathyQuotes } from '@/components/landing-v1/EmpathyQuotes';
import { ValuePillars } from '@/components/landing-v1/ValuePillars';
import { CoachSpotlight } from '@/components/landing-v1/CoachSpotlight';
import { FeaturesGrid } from '@/components/landing-v1/FeaturesGrid';
import { HowItWorks } from '@/components/landing-v1/HowItWorks';
import { WhyParents } from '@/components/landing-v1/WhyParents';
import { FAQAccordion } from '@/components/landing-v1/FAQAccordion';
import { FreeAccessCTA } from '@/components/landing-v1/FreeAccessCTA';
import { FooterV1Expanded } from '@/components/landing-v1/FooterV1Expanded';
import { CookieConsent } from '@/components/landing/CookieConsent';
import { InstallAppCard } from '@/components/InstallAppCard';

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
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      <NavbarV1 />
      <main id="main-content">
        <HeroV1 />
        <EmpathyQuotes />
        <ValuePillars />
        <CoachSpotlight />
        <FeaturesGrid />
        <HowItWorks />
        <WhyParents />
        <div id="faq">
          <FAQAccordion />
        </div>
        <FreeAccessCTA />
        <div className="container mx-auto px-4 pb-12">
          <InstallAppCard variant="landing" />
        </div>
      </main>
      <FooterV1Expanded />
      <CookieConsent />
    </div>
  );
}
