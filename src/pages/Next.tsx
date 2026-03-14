import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { CookieConsent } from '@/components/landing/CookieConsent';
import { AnimatedSection } from '@/components/landing/AnimatedSection';
import { WAITLIST_MODE } from '@/config/featureFlags';
import { useWaitlist } from '@/contexts/WaitlistContext';
import {
  Bell, Shield, Search, Brain, AlertTriangle, Users, Eye,
  Smartphone, Clock, MapPin, Lock, CheckCircle, Star,
  ListChecks, Award, ArrowLeft, MessageCircle, UserX,
  Heart, Zap, Package, Crown
} from 'lucide-react';

export default function Next() {
  const { openModal } = useWaitlist();

  const handleCTAClick = () => {
    if (WAITLIST_MODE) {
      openModal();
    }
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-background">
      <LandingNavbar />
      <main id="main-content">

        {/* ===== סקשן 1 — פתיח עליון ===== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
            <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-accent/10 rounded-full blur-3xl" />

            <div className="container mx-auto px-4 relative z-10">
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <div className="text-center lg:text-right">
                  <h1 className="text-4xl md:text-5xl lg:text-7xl font-bold leading-tight mb-6">
                    <span className="text-foreground">מערכת ההפעלה המשפחתית</span>
                    <br />
                    <span className="text-primary text-glow">לטלפון של הילד</span>
                  </h1>
                  <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl lg:max-w-none leading-relaxed">
                    קיפי נותנת להורים את כל הכלים כדי לנהל את הטלפון של הילד בראש שקט.
                    <br />
                    מתחילים עם בקרת הורים מלאה וחינמית – זמן מסך, חסימת אפליקציות ומיקום.
                    <br />
                    <span className="text-primary">ומוסיפים הגנת AI חכמה שמתריעה רק כשבאמת צריך התערבות הורית.</span>
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                    {WAITLIST_MODE ? (
                      <Button size="lg" className="glow-primary text-lg px-8" onClick={handleCTAClick}>
                        התחילו עם בקרת הורים חינמית
                      </Button>
                    ) : (
                      <Link to="/auth?signup=true">
                        <Button size="lg" className="glow-primary text-lg px-8">
                          התחילו עם בקרת הורים חינמית
                        </Button>
                      </Link>
                    )}
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
                    <div className="bg-primary/10 border border-primary/30 rounded-lg p-3">
                      <p className="text-sm text-primary">
                        הצעה: לדבר על גבולות ועל זכות להגיד "לא"
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </motion.div>

        {/* ===== סקשן 2 — הבעיה האמיתית ===== */}
        <AnimatedSection delay={0.1}>
          <section className="py-20 md:py-28">
            <div className="container mx-auto px-4 max-w-4xl text-center">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-8">
                הסכנה האמיתית ברשת{' '}
                <span className="text-primary text-glow">לא נמצאת במילים</span>
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
                רוב הכלים להורים מחפשים מילים בעייתיות בהודעות.
                <br />
                אבל בעולם האמיתי הסכנות לא תמיד נכתבות בצורה ישירה.
                <br />
                חרם חברתי, הדרה מקבוצות, מניפולציות או שיחות עם זרים
                <br />
                נראות לפעמים כמו שיחה רגילה לחלוטין.
                <br /><br />
                בגלל זה הורים רבים מגלים בעיות רק כשהמצב כבר מחמיר.
                <br />
                <span className="text-primary font-semibold">קיפי מסתכלת על ההקשר של השיחה, לא רק על מילים בודדות.</span>
              </p>
            </div>
          </section>
        </AnimatedSection>

        {/* ===== סקשן 3 — למה הכלים הקיימים לא מספיקים ===== */}
        <AnimatedSection delay={0.1}>
          <section className="py-20 md:py-28">
            <div className="container mx-auto px-4">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground text-center mb-16">
                רוב הכלים מנהלים את המכשיר,{' '}
                <span className="text-primary text-glow">אבל לא מבינים את הסיכון</span>
              </h2>
              <div className="grid md:grid-cols-3 gap-8">
                {/* כרטיס 1 */}
                <div className="bg-card border border-border/50 rounded-2xl p-8">
                  <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center mb-6">
                    <Smartphone className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-4">בקרת הורים רגילה</h3>
                  <ul className="space-y-2 text-muted-foreground">
                    <li>ניהול זמן מסך</li>
                    <li>חסימת אפליקציות</li>
                    <li>מעקב מיקום</li>
                    <li className="text-destructive pt-2">אבל בלי הבנה של מה באמת קורה בשיחות</li>
                  </ul>
                </div>
                {/* כרטיס 2 */}
                <div className="bg-card border border-border/50 rounded-2xl p-8">
                  <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center mb-6">
                    <Search className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-4">סורקי מילים</h3>
                  <ul className="space-y-2 text-muted-foreground">
                    <li>מחפשים מילים בעייתיות</li>
                    <li>מפספסים את ההקשר</li>
                    <li className="text-destructive pt-2">ויוצרים הרבה התראות מיותרות</li>
                  </ul>
                </div>
                {/* כרטיס 3 */}
                <div className="bg-card border border-primary/50 rounded-2xl p-8 ring-1 ring-primary/20">
                  <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center mb-6">
                    <Brain className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold text-primary mb-4">קיפי</h3>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="text-foreground">בקרת הורים מלאה</li>
                    <li className="text-foreground">ניתוח הקשר של שיחות</li>
                    <li className="text-primary font-semibold pt-2">התראות רק כשצריך באמת</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>
        </AnimatedSection>

        {/* ===== סקשן 4 — אות ברור במקום רעש ===== */}
        <AnimatedSection delay={0.1}>
          <section id="how-it-works" className="py-20 md:py-28 bg-card/50">
            <div className="container mx-auto px-4">
              <div className="max-w-4xl mx-auto text-center mb-16">
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
                  הורים צריכים להבין{' '}
                  <span className="text-primary text-glow">מתי באמת צריך להתערב</span>
                </h2>
                <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
                  ילדים שולחים מאות ואפילו אלפי הודעות בשבוע.
                  <br />
                  רובן שיחות רגילות לגמרי.
                  <br />
                  קיפי מסננת את כל הרעש
                  <br />
                  ומציפה רק את המקרים שבהם כדאי שהורה יהיה מודע למה שקורה.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                <div className="bg-card border border-destructive/30 rounded-2xl p-6 text-center">
                  <div className="w-12 h-12 bg-destructive/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle className="w-6 h-6 text-destructive" />
                  </div>
                  <h3 className="font-bold text-foreground mb-2">זיהוי בריונות או חרם</h3>
                </div>
                <div className="bg-card border border-warning/30 rounded-2xl p-6 text-center">
                  <div className="w-12 h-12 bg-warning/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-6 h-6 text-warning" />
                  </div>
                  <h3 className="font-bold text-foreground mb-2">סימנים להדרה חברתית</h3>
                </div>
                <div className="bg-card border border-accent/30 rounded-2xl p-6 text-center">
                  <div className="w-12 h-12 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <UserX className="w-6 h-6 text-accent" />
                  </div>
                  <h3 className="font-bold text-foreground mb-2">שיחה עם אדם זר</h3>
                </div>
              </div>
            </div>
          </section>
        </AnimatedSection>

        {/* ===== סקשן 5 — מערכת אחת בשלוש שכבות ===== */}
        <AnimatedSection delay={0.1}>
          <section className="py-20 md:py-28">
            <div className="container mx-auto px-4">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground text-center mb-16">
                מערכת משפחתית מלאה{' '}
                <span className="text-primary text-glow">לטלפון של הילד</span>
              </h2>
              <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                {/* שכבה 1 */}
                <div className="bg-card border border-border/50 rounded-2xl p-8">
                  <div className="w-12 h-12 bg-secondary/20 rounded-xl flex items-center justify-center mb-6">
                    <Shield className="w-6 h-6 text-secondary" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">בקרת הורים חינמית</h3>
                  <ul className="space-y-2 text-muted-foreground mt-4">
                    <li className="flex items-center gap-2"><Clock className="w-4 h-4 text-secondary" /> ניהול זמן מסך</li>
                    <li className="flex items-center gap-2"><Lock className="w-4 h-4 text-secondary" /> שליטה באפליקציות</li>
                    <li className="flex items-center gap-2"><MapPin className="w-4 h-4 text-secondary" /> מיקום המכשיר</li>
                    <li className="flex items-center gap-2"><Eye className="w-4 h-4 text-secondary" /> לוח בקרה יומי להורים</li>
                  </ul>
                </div>
                {/* שכבה 2 */}
                <div className="bg-card border border-primary/50 rounded-2xl p-8 ring-1 ring-primary/20">
                  <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center mb-6">
                    <Brain className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold text-primary mb-2">הגנת AI חכמה</h3>
                  <ul className="space-y-2 text-muted-foreground mt-4">
                    <li className="flex items-center gap-2"><MessageCircle className="w-4 h-4 text-primary" /> ניתוח שיחות בוואטסאפ</li>
                    <li className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-primary" /> זיהוי סיכונים חברתיים</li>
                    <li className="flex items-center gap-2"><Bell className="w-4 h-4 text-primary" /> התראות חכמות להורים</li>
                  </ul>
                </div>
                {/* שכבה 3 */}
                <div className="bg-card border border-border/50 rounded-2xl p-8">
                  <div className="w-12 h-12 bg-warning/20 rounded-xl flex items-center justify-center mb-6">
                    <Award className="w-6 h-6 text-warning" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">זמן מסך שמרוויחים</h3>
                  <ul className="space-y-2 text-muted-foreground mt-4">
                    <li className="flex items-center gap-2"><ListChecks className="w-4 h-4 text-warning" /> הילד מקבל משימות</li>
                    <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-warning" /> משלים אותן</li>
                    <li className="flex items-center gap-2"><Star className="w-4 h-4 text-warning" /> ומרוויח דקות מסך</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>
        </AnimatedSection>

        {/* ===== סקשן 6 — להפוך את הטלפון ממאבק לשיתוף פעולה ===== */}
        <AnimatedSection delay={0.1}>
          <section className="py-20 md:py-28 bg-card/50">
            <div className="container mx-auto px-4 max-w-4xl">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground text-center mb-16">
                <span className="text-primary text-glow">פחות ריבים</span>{' '}
                על הטלפון
              </h2>

              <div className="grid sm:grid-cols-4 gap-6 mb-12">
                {[
                  { icon: ListChecks, text: 'הורה מגדיר משימות' },
                  { icon: CheckCircle, text: 'הילד משלים אותן' },
                  { icon: Star, text: 'הילד מרוויח זמן מסך' },
                  { icon: Award, text: 'הגישה לטלפון הופכת לפרס על אחריות' },
                ].map((step, i) => (
                  <div key={i} className="bg-card border border-border/50 rounded-2xl p-6 text-center">
                    <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <step.icon className="w-6 h-6 text-primary" />
                    </div>
                    <p className="text-foreground font-medium">{step.text}</p>
                  </div>
                ))}
              </div>

              <p className="text-lg md:text-xl text-muted-foreground text-center leading-relaxed">
                במקום ויכוחים יומיומיים על זמן מסך,
                <br />
                נוצר מנגנון ברור והוגן שמחזק אחריות.
              </p>
            </div>
          </section>
        </AnimatedSection>

        {/* ===== סקשן 7 — מה ההורה מקבל בפועל ===== */}
        <AnimatedSection delay={0.1}>
          <section className="py-20 md:py-28">
            <div className="container mx-auto px-4">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground text-center mb-16">
                כל מה שהורה צריך{' '}
                <span className="text-primary text-glow">במקום אחד</span>
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto">
                {[
                  { icon: Heart, title: 'שקט נפשי', desc: 'לדעת שמישהו שומר על הילד גם כשאתם לא לידו' },
                  { icon: Zap, title: 'פחות מאבקים בבית', desc: 'הילד מרוויח זמן מסך דרך אחריות' },
                  { icon: AlertTriangle, title: 'התערבות בזמן', desc: 'לזהות חרם, בריונות או זרים לפני שזה מחמיר' },
                  { icon: Package, title: 'אפליקציה אחת במקום שלוש', desc: 'שליטה, הגנה ושיתוף פעולה במקום אחד' },
                ].map((card, i) => (
                  <div key={i} className="bg-card border border-border/50 rounded-2xl p-8 text-center">
                    <div className="w-14 h-14 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                      <card.icon className="w-7 h-7 text-primary" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-3">{card.title}</h3>
                    <p className="text-muted-foreground">{card.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </AnimatedSection>

        {/* ===== סקשן 8 — דוגמאות להתראות ===== */}
        <AnimatedSection delay={0.1}>
          <section className="py-20 md:py-28 bg-card/50">
            <div className="container mx-auto px-4">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground text-center mb-16">
                כך נראות ההתראות{' '}
                <span className="text-primary text-glow">שקיפי שולחת</span>
              </h2>
              <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-12">
                {[
                  { color: 'destructive', icon: AlertTriangle, title: 'זוהו סימנים לבריונות בשיחה' },
                  { color: 'warning', icon: Users, title: 'סימנים להדרה חברתית בקבוצה' },
                  { color: 'accent', icon: UserX, title: 'אדם לא מוכר מנסה ליצור קשר פרטי' },
                ].map((alert, i) => (
                  <div key={i} className={`bg-card border border-${alert.color}/30 rounded-2xl p-6`}>
                    <div className={`w-12 h-12 bg-${alert.color}/20 rounded-full flex items-center justify-center mb-4`}>
                      <alert.icon className={`w-6 h-6 text-${alert.color}`} />
                    </div>
                    <h3 className="font-bold text-foreground text-lg">{alert.title}</h3>
                  </div>
                ))}
              </div>
              <p className="text-lg text-muted-foreground text-center max-w-2xl mx-auto leading-relaxed">
                קיפי לא מציפה כל הודעה.
                <br />
                רק מצבים שבהם כדאי שהורה יהיה מודע למה שקורה.
              </p>
            </div>
          </section>
        </AnimatedSection>

        {/* ===== סקשן 9 — שימוש אמיתי במוצר ===== */}
        <AnimatedSection delay={0.1}>
          <section className="py-20 md:py-28">
            <div className="container mx-auto px-4 max-w-4xl text-center">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-12">
                משפחות כבר משתמשות{' '}
                <span className="text-primary text-glow">בקיפי</span>
              </h2>

              <div className="grid grid-cols-2 gap-8 mb-12 max-w-lg mx-auto">
                <div>
                  <p className="text-4xl md:text-5xl font-bold text-primary text-glow">~20</p>
                  <p className="text-muted-foreground mt-2">מכשירים כבר משתמשים במערכת</p>
                </div>
                <div>
                  <p className="text-4xl md:text-5xl font-bold text-primary text-glow">~200</p>
                  <p className="text-muted-foreground mt-2">משפחות מחכות להצטרף</p>
                </div>
              </div>

              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
                הפידבק שאנחנו מקבלים חוזר על עצמו שוב ושוב:
                <br />
                הורים רוצים כלי אחד
                <br />
                שיעזור להם גם לנהל את הטלפון
                <br />
                וגם להבין מתי באמת צריך להתערב.
              </p>
            </div>
          </section>
        </AnimatedSection>

        {/* ===== סקשן 10 — תמחור ===== */}
        <AnimatedSection delay={0.1}>
          <section id="pricing" className="py-20 md:py-28 bg-card/50">
            <div className="container mx-auto px-4">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground text-center mb-16">
                <span className="text-primary text-glow">מתחילים</span>{' '}
                בחינם
              </h2>
              <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
                {/* חבילה חינמית */}
                <div className="bg-card border border-border/50 rounded-2xl p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <Shield className="w-8 h-8 text-secondary" />
                    <h3 className="text-2xl font-bold text-foreground">חינם</h3>
                  </div>
                  <p className="text-lg font-semibold text-foreground mb-4">בקרת הורים מלאה</p>
                  <ul className="space-y-3 text-muted-foreground">
                    <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-secondary" /> ניהול זמן מסך</li>
                    <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-secondary" /> שליטה באפליקציות</li>
                    <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-secondary" /> מיקום המכשיר</li>
                    <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-secondary" /> מערכת משימות לזמן מסך</li>
                  </ul>
                  <div className="mt-8">
                    {WAITLIST_MODE ? (
                      <Button className="w-full" variant="outline" onClick={handleCTAClick}>התחילו בחינם</Button>
                    ) : (
                      <Link to="/auth?signup=true"><Button className="w-full" variant="outline">התחילו בחינם</Button></Link>
                    )}
                  </div>
                </div>
                {/* חבילת פרימיום */}
                <div className="bg-card border border-primary/50 rounded-2xl p-8 ring-1 ring-primary/20 relative overflow-hidden">
                  <div className="absolute top-4 left-4">
                    <Crown className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex items-center gap-3 mb-6">
                    <Brain className="w-8 h-8 text-primary" />
                    <h3 className="text-2xl font-bold text-primary">פרימיום</h3>
                  </div>
                  <p className="text-lg font-semibold text-foreground mb-4">הגנת AI</p>
                  <ul className="space-y-3 text-muted-foreground">
                    <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-primary" /> ניתוח הקשר בשיחות</li>
                    <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-primary" /> זיהוי סיכונים</li>
                    <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-primary" /> התראות חכמות להורים</li>
                  </ul>
                  <div className="mt-8">
                    {WAITLIST_MODE ? (
                      <Button className="w-full glow-primary" onClick={handleCTAClick}>שדרגו עכשיו</Button>
                    ) : (
                      <Link to="/auth?signup=true"><Button className="w-full glow-primary">שדרגו עכשיו</Button></Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </AnimatedSection>

        {/* ===== סקשן 11 — קריאה לפעולה ===== */}
        <AnimatedSection delay={0.1}>
          <section className="py-20 md:py-28">
            <div className="container mx-auto px-4 max-w-3xl text-center">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
                לתת לילד טלפון{' '}
                <span className="text-primary text-glow">בראש שקט</span>
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground mb-10 leading-relaxed">
                מתחילים עם בקרת הורים חינמית
                <br />
                ומוסיפים הגנת AI כשצריך.
              </p>
              {WAITLIST_MODE ? (
                <Button size="lg" className="glow-primary text-lg px-10" onClick={handleCTAClick}>
                  התחילו עכשיו
                </Button>
              ) : (
                <Link to="/auth?signup=true">
                  <Button size="lg" className="glow-primary text-lg px-10">
                    התחילו עכשיו
                  </Button>
                </Link>
              )}
            </div>
          </section>
        </AnimatedSection>

        {/* ===== סקשן 12 — שאלות נפוצות ===== */}
        <AnimatedSection delay={0.1}>
          <section id="faq" className="py-20 md:py-28 bg-card/50">
            <div className="container mx-auto px-4 max-w-3xl">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground text-center mb-16">
                שאלות{' '}
                <span className="text-primary text-glow">נפוצות</span>
              </h2>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="q1">
                  <AccordionTrigger className="text-right text-lg">מה ההבדל בין קיפי ל-Google Family Link?</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-base leading-relaxed">
                    קיפי כוללת את כל כלי בקרת ההורים הרגילים,
                    אבל מוסיפה שכבת AI שמבינה סיכונים חברתיים בשיחות.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="q2">
                  <AccordionTrigger className="text-right text-lg">האם ההורים קוראים את ההודעות של הילד?</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-base leading-relaxed">
                    לא.
                    קיפי מנתחת את ההקשר של השיחות
                    ומתריעה רק על מצבים בעייתיים.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="q3">
                  <AccordionTrigger className="text-right text-lg">על אילו אפליקציות זה עובד?</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-base leading-relaxed">
                    בקרת ההורים עובדת על כל המכשיר.
                    ה-AI מתמקד כרגע בוואטסאפ.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="q4">
                  <AccordionTrigger className="text-right text-lg">מה זה זמן מסך שמרוויחים?</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-base leading-relaxed">
                    ההורה מגדיר משימות
                    והילד מרוויח דקות מסך כשהוא משלים אותן.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </section>
        </AnimatedSection>

      </main>
      <LandingFooter />
      <CookieConsent />
    </div>
  );
}
