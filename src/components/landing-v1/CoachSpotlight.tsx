import { motion } from 'framer-motion';
import { BedDouble, Dog, BookOpen, Calendar, Clock, Star, ArrowLeft } from 'lucide-react';
import { CoinsJar } from './CoinsJar';

const tasks = [
  { icon: BedDouble, title: 'סידור החדר', mins: 20 },
  { icon: Dog, title: 'הוצאה לכלב', mins: 15 },
  { icon: BookOpen, title: 'קריאה 20 דק', mins: 15 },
];

const bullets = [
  { icon: Calendar, text: 'מבצעים משימות יומיומיות' },
  { icon: Clock, text: 'מרוויחים דקות מסך' },
  { icon: Star, text: 'לומדים אחריות וניהול עצמי' },
];

export function CoachSpotlight() {
  return (
    <section className="py-16 md:py-24" dir="rtl">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="relative max-w-6xl mx-auto"
        >
          <div className="absolute -inset-4 bg-gradient-to-tr from-primary/20 via-primary/5 to-transparent rounded-3xl blur-2xl" />
          <div className="relative bg-card border border-primary/30 rounded-3xl p-5 sm:p-8 md:p-12 shadow-xl">
            <div className="grid lg:grid-cols-2 gap-8 sm:gap-10 items-center">
              {/* Right: text + tasks */}
              <div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 leading-tight">
                  זמן מסך יכול
                  <br />
                  <span className="text-primary">להפוך לכלי חינוכי</span>
                </h2>
                <p className="text-base text-muted-foreground mb-6 leading-relaxed">
                  אם מלמדים ילדים לנהל כסף, אפשר ללמד אותם גם לנהל זמן.
                </p>

                <div className="space-y-2 mb-6">
                  {bullets.map(({ icon: Icon, text }) => (
                    <div key={text} className="flex items-center gap-2 text-sm text-foreground">
                      <Icon className="w-4 h-4 text-primary" />
                      <span>{text}</span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {tasks.map(({ icon: Icon, title, mins }) => (
                    <div key={title} className="bg-background border border-border rounded-xl p-3 text-center">
                      <Icon className="w-5 h-5 text-primary mx-auto mb-1.5" />
                      <p className="text-[11px] font-semibold text-foreground leading-tight mb-1">{title}</p>
                      <p className="text-xs font-bold text-primary">+{mins} דק'</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Left: jar with arrows */}
              <div className="relative flex items-center justify-center">
                <ArrowLeft className="absolute left-full top-1/2 -translate-y-1/2 w-12 h-12 text-primary/40 hidden lg:block" />
                <CoinsJar />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
