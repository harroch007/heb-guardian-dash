import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { LandingHero } from '@/components/landing/LandingHero';
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

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNavbar />
      <main id="main-content">
        <LandingHero />
        <LandingFeatures />
        <LandingProblemSolution />
        <LandingDifferentiators />
        <LandingHowItWorks />
        <LandingCapabilities />
        <LandingAlertExamples />
        <LandingTestimonials />
        <LandingPricing />
        <LandingCTA />
        <LandingFAQ />
      </main>
      <LandingFooter />
    </div>
  );
}
