import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Sparkles, Smartphone, Shield, Clock } from 'lucide-react';
import { WAITLIST_MODE } from '@/config/featureFlags';
import { useWaitlist } from '@/contexts/WaitlistContext';

export function HeroV1() {
  const { openModal } = useWaitlist();

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCTA = () => {
    if (WAITLIST_MODE) openModal();
  };

  const CTAButton = (
    <Button size="lg" onClick={handleCTA} className="bg-primary text-primary-foreground hover:bg-primary/90 text-lg h-14 px-8 rounded-xl">
      התחילו עכשיו
    </Button>
  );

  return (
    <section className="relative pt-12 pb-16 md:pt-20 md:pb-24 overflow-hidden" dir="rtl">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center lg:text-right"
          >
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-semibold mb-6">
              <Sparkles className="w-4 h-4" />
              <span>הגישה כרגע ללא עלות</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6 text-foreground">
              בקרת הורים <span className="text-primary">שמחנכת</span>,
              <br />
              לא רק חוסמת
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-xl mx-auto lg:mx-0">
              כל הכלים לנהל את מכשיר הילד — ובונים אצלו הרגלים בריאים של ניהול זמן.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              {WAITLIST_MODE ? CTAButton : (
                <Link to="/auth?signup=true">{CTAButton}</Link>
              )}
              <Button size="lg" variant="outline" onClick={() => scrollTo('how-it-works')} className="text-lg h-14 px-8 rounded-xl">
                ראו איך זה עובד
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="relative flex justify-center"
          >
            <div className="relative w-full max-w-sm">
              <div className="absolute -inset-4 bg-gradient-to-tr from-primary/20 to-transparent rounded-3xl blur-2xl" />
              <div className="relative bg-white rounded-3xl border border-border shadow-2xl p-6 space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-border">
                  <div className="w-10 h-10 bg-primary/15 rounded-full flex items-center justify-center">
                    <Smartphone className="w-5 h-5 text-primary" />
                  </div>
                  <div className="text-right flex-1">
                    <p className="font-bold text-foreground">המכשיר של רוני</p>
                    <p className="text-xs text-muted-foreground">פעיל · עכשיו</p>
                  </div>
                </div>
                <div className="bg-muted/40 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">זמן מסך היום</span>
                    <span className="text-sm font-bold text-foreground">1:24 / 2:00</span>
                  </div>
                  <div className="h-2 bg-border rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: '70%' }} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 bg-primary/10 rounded-xl p-3 text-center">
                    <Shield className="w-5 h-5 text-primary mx-auto mb-1" />
                    <p className="text-xs font-semibold text-foreground">12 חסומות</p>
                  </div>
                  <div className="flex-1 bg-primary/10 rounded-xl p-3 text-center">
                    <Clock className="w-5 h-5 text-primary mx-auto mb-1" />
                    <p className="text-xs font-semibold text-foreground">3 לוחות</p>
                  </div>
                </div>
                <div className="bg-success/10 border border-success/30 rounded-xl p-3 text-center">
                  <p className="text-sm font-semibold text-success-foreground">+15 דקות נצברו במשימות 🎉</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
