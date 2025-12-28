import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Shield, MessageSquare, Users, Bell } from 'lucide-react';
export function LandingHero() {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth'
      });
    }
  };
  return <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-accent/10 rounded-full blur-3xl" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Text Content */}
          <div className="text-center lg:text-right">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              <span className="text-foreground">הגנה חכמה לילדים ברשת</span>
              <br />
              <span className="text-primary text-glow">בלי לפגוע בפרטיות שלהם</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl lg:max-w-none">
              KippyAI מגינה על הילד שלכם בזמן אמת מפני בריונות, שיחות אלימות, זרים מסוכנים ותוכן לא הולם - ומתריעה אליכם רק כשיש באמת צורך להתערב.
              <br />
              <span className="text-primary">בלי לקרוא כל הודעה. בלי לפגוע בפרטיות. רק הגנה אמיתית כשזה הכי חשוב.</span>
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link to="/auth?signup=true">
                <Button size="lg" className="glow-primary text-lg px-8">
                  התחילו להגן עכשיו - חינם
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="text-lg px-8" onClick={() => scrollToSection('how-it-works')}>
                ראו איך זה עובד
              </Button>
            </div>
          </div>

          {/* Alert Demo Card */}
          <div className="relative">
            <div className="bg-card border border-border rounded-2xl p-6 shadow-2xl animate-fade-in">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                  <Bell className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">התרעה מ‑Kippy</p>
                  <p className="text-xs text-muted-foreground">עכשיו</p>
                </div>
              </div>
              <p className="text-muted-foreground mb-4">
                רוני קיבלה ב‑19:05 הודעה בקבוצת "החבר'ה שלנו": "אם לא תשלחי תמונה – את לא בקבוצה יותר".
              </p>
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 mb-4">
                <p className="text-sm text-primary">
                  הצעה: לדבר על גבולות ועל זכות להגיד "לא"
                </p>
              </div>
              
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-8 mt-16 pt-16 border-t border-border">
          <div className="text-center">
            <p className="text-3xl md:text-4xl font-bold text-primary text-glow">+50,000</p>
            <p className="text-muted-foreground mt-2">הודעות נותחו החודש</p>
          </div>
          <div className="text-center">
            <p className="text-3xl md:text-4xl font-bold text-primary text-glow">פחות מ-5%</p>
            <p className="text-muted-foreground mt-2">התראות שווא בזכות ה-AI שלנו</p>
          </div>
          <div className="text-center">
            <p className="text-3xl md:text-4xl font-bold text-primary text-glow">95%</p>
            <p className="text-muted-foreground mt-2">מהניתוח על המכשיר עצמו</p>
          </div>
        </div>
      </div>
    </section>;
}