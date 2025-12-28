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

export default function Landing() {
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
