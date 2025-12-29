import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Shield, CreditCard, Calendar, X } from 'lucide-react';

export function LandingCTA() {
  return (
    <section className="py-24 bg-gradient-to-b from-primary/10 to-transparent">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
          התחילו להגן על הילדים שלכם עוד היום
        </h2>
        <p className="text-xl lg:text-2xl text-muted-foreground mb-8">
          הרשמה חינמית, ללא כרטיס אשראי. מוכנים תוך 5 דקות.
        </p>

        <div className="flex justify-center mb-12">
          <Link to="/auth?signup=true">
            <Button size="lg" className="glow-primary text-lg px-8">
              הצטרפו חינם עכשיו
            </Button>
          </Link>
        </div>

        <div className="flex flex-wrap justify-center gap-8 text-muted-foreground">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            <span>ללא כרטיס אשראי</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <span>ניסיון חינם 14 יום</span>
          </div>
          <div className="flex items-center gap-2">
            <X className="w-5 h-5 text-primary" />
            <span>ניתן לבטל בכל עת</span>
          </div>
        </div>
      </div>
    </section>
  );
}
