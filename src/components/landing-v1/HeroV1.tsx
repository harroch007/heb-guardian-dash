import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Star, PlayCircle } from 'lucide-react';
import { WAITLIST_MODE } from '@/config/featureFlags';
import { useWaitlist } from '@/contexts/WaitlistContext';
import { Link } from 'react-router-dom';
import { PhoneMockup } from './PhoneMockup';

export function HeroV1() {
  const { openModal } = useWaitlist();

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCTA = () => {
    if (WAITLIST_MODE) openModal();
  };

  const PrimaryCTA = (
    <Button size="lg" onClick={handleCTA} className="bg-primary text-primary-foreground hover:bg-primary/90 text-lg h-14 px-8 rounded-xl glow-primary font-bold w-full sm:w-auto">
      הצטרפו לרשימת ההמתנה
    </Button>
  );

  return (
    <section className="relative pt-12 pb-16 md:pt-20 md:pb-24 overflow-hidden" dir="rtl">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-20 right-10 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Phones */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="order-2 lg:order-1 relative flex justify-center items-center gap-4"
          >
            <div className="translate-y-6">
              <PhoneMockup variant="overview" />
            </div>
            <div className="-translate-y-6">
              <PhoneMockup variant="tasks" />
            </div>
          </motion.div>

          {/* Text */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="order-1 lg:order-2 text-center lg:text-right"
          >
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6 text-foreground">
              פחות מלחמות
              <br />
              על זמן מסך.
              <br />
              <span className="text-primary">יותר אחריות בבית.</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              KippyAI היא בקרת ההורים המתקדמת ביותר, עם דרך הכמה ללמד ילדים לנהל זמן מסך,
              להרוויח דקות, ולכבד גבולות.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-4">
              {WAITLIST_MODE ? PrimaryCTA : <Link to="/auth?signup=true">{PrimaryCTA}</Link>}
              <Button size="lg" variant="outline" onClick={() => scrollTo('how-it-works')} className="text-lg h-14 px-8 rounded-xl gap-2">
                <PlayCircle className="w-5 h-5" />
                ראו איך זה עובד
              </Button>
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 justify-center lg:justify-start">
              <Star className="w-4 h-4 text-primary fill-primary" />
              כמו דמי כיס. רק בדקות מסך.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
