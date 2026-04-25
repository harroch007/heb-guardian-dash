import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { WAITLIST_MODE } from '@/config/featureFlags';
import { useWaitlist } from '@/contexts/WaitlistContext';
import ctaBg from '@/assets/landing-v1/cta-family-night.jpg';

export function FreeAccessCTA() {
  const { openModal } = useWaitlist();
  const handleCTA = () => {
    if (WAITLIST_MODE) openModal();
  };

  const button = (
    <Button size="lg" onClick={handleCTA} className="bg-primary text-primary-foreground hover:bg-primary/90 text-base sm:text-lg h-12 sm:h-14 px-6 sm:px-10 rounded-xl font-bold glow-primary w-full sm:w-auto">
      הצטרפו לרשימת ההמתנה
    </Button>
  );

  return (
    <section className="py-16 md:py-24" dir="rtl">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
          className="max-w-5xl mx-auto rounded-3xl overflow-hidden shadow-2xl shadow-primary/30 relative border border-primary/30"
        >
          {/* Background image */}
          <img
            src={ctaBg}
            alt=""
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
            aria-hidden="true"
          />
          {/* Dark gradient overlay for legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-background/40" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/60 via-transparent to-background/60" />

          <div className="relative px-6 sm:px-10 md:px-14 pt-44 sm:pt-56 md:pt-64 pb-8 sm:pb-12 text-center">
            <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-foreground mb-4 leading-tight">
              מוכנים להפוך את זמן המסך
              <br />
              <span className="text-primary">לכלי חינוכי?</span>
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              הצטרפו עכשיו וקבלו ראשונים גישה לגרסה החדשה של KippyAI.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {WAITLIST_MODE ? button : <Link to="/auth?signup=true">{button}</Link>}
              <Button size="lg" variant="outline" disabled className="hidden sm:inline-flex text-lg h-14 px-10 rounded-xl">
                קרוב
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
