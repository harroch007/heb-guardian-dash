import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Gift } from 'lucide-react';
import { WAITLIST_MODE } from '@/config/featureFlags';
import { useWaitlist } from '@/contexts/WaitlistContext';

export function FreeAccessCTA() {
  const { openModal } = useWaitlist();
  const handleCTA = () => {
    if (WAITLIST_MODE) openModal();
  };

  const button = (
    <Button size="lg" onClick={handleCTA} className="bg-white text-primary hover:bg-white/90 text-lg h-14 px-10 rounded-xl font-bold">
      צרו חשבון חינם
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
          className="max-w-4xl mx-auto bg-primary rounded-3xl p-10 md:p-14 text-center shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 bg-white/20 text-primary-foreground px-4 py-2 rounded-full text-sm font-semibold mb-5">
              <Gift className="w-4 h-4" />
              <span>הצעה מוגבלת בזמן</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold text-primary-foreground mb-4 leading-tight">
              כרגע — הגישה ללא עלות
            </h2>
            <p className="text-lg md:text-xl text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
              הצטרפו עכשיו וקבלו גישה מלאה לכל הכלים. בלי כרטיס אשראי, בלי התחייבות.
            </p>
            {WAITLIST_MODE ? button : <Link to="/auth?signup=true">{button}</Link>}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
