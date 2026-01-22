import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { LandingHero } from '@/components/landing/LandingHero';
import { LandingPlatforms } from '@/components/landing/LandingPlatforms';
import { LandingFeatures } from '@/components/landing/LandingFeatures';
import { LandingProblemSolution } from '@/components/landing/LandingProblemSolution';
import { LandingDifferentiators } from '@/components/landing/LandingDifferentiators';
import { LandingHowItWorks } from '@/components/landing/LandingHowItWorks';
import { LandingCapabilities } from '@/components/landing/LandingCapabilities';
import { LandingAlertExamples } from '@/components/landing/LandingAlertExamples';
import { LandingTestimonials } from '@/components/landing/LandingTestimonials';
import { LandingPricing } from '@/components/landing/LandingPricing';
import { LandingCTA } from '@/components/landing/LandingCTA';
import { LandingFAQ } from '@/components/landing/LandingFAQ';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { CookieConsent } from '@/components/landing/CookieConsent';
import { AnimatedSection } from '@/components/landing/AnimatedSection';
import { useAuth } from '@/contexts/AuthContext';
import { WAITLIST_MODE } from '@/config/featureFlags';

export default function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to dashboard if user is logged in
    // (works in both waitlist mode and regular mode)
    if (!loading && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, loading, navigate]);

  // Show nothing while checking auth
  if (loading) {
    return null;
  }

  // If user is logged in, they'll be redirected
  if (user) {
    return null;
  }
  return (
    <div className="min-h-screen bg-background">
      <LandingNavbar />
      <main id="main-content">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <LandingHero />
        </motion.div>
        
        <AnimatedSection delay={0.1}>
          <LandingPlatforms />
        </AnimatedSection>
        
        <AnimatedSection delay={0.1}>
          <LandingFeatures />
        </AnimatedSection>
        
        <AnimatedSection delay={0.1}>
          <LandingProblemSolution />
        </AnimatedSection>
        
        <AnimatedSection delay={0.1}>
          <LandingDifferentiators />
        </AnimatedSection>
        
        <AnimatedSection delay={0.1}>
          <LandingHowItWorks />
        </AnimatedSection>
        
        <AnimatedSection delay={0.1}>
          <LandingCapabilities />
        </AnimatedSection>
        
        <AnimatedSection delay={0.1}>
          <LandingAlertExamples />
        </AnimatedSection>
        
        <LandingTestimonials />
        
        <AnimatedSection delay={0.1}>
          <LandingPricing />
        </AnimatedSection>
        
        <AnimatedSection delay={0.1}>
          <LandingCTA />
        </AnimatedSection>
        
        <AnimatedSection delay={0.1}>
          <LandingFAQ />
        </AnimatedSection>
      </main>
      <LandingFooter />
      <CookieConsent />
    </div>
  );
}
