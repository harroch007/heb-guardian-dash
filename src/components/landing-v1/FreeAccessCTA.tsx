import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Users } from 'lucide-react';
import { WAITLIST_MODE } from '@/config/featureFlags';
import { useWaitlist } from '@/contexts/WaitlistContext';

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
          className="max-w-4xl mx-auto bg-card border border-primary/30 rounded-3xl p-6 sm:p-10 md:p-14 text-center shadow-2xl shadow-primary/20 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/15 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/15 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
          <div className="relative">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center glow-primary">
              <Users className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-foreground mb-4 leading-tight">
              מוכנים להפוך את זמן המסך
              <br />
              <span className="text-primary">לכלי חינוכי?</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
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
