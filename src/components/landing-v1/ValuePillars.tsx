import { motion } from 'framer-motion';
import { BrainCircuit, LockKeyhole, ShieldCheck } from 'lucide-react';

const pillars = [
  {
    icon: ShieldCheck,
    title: 'מזהים סיכון אמיתי',
    desc: 'שתי שכבות בדיקה מקומיות מסננות הודעות לפני שנדרשת בדיקה מתקדמת.',
  },
  {
    icon: BrainCircuit,
    title: 'מבינים את ההקשר',
    desc: 'כאשר עולה חשד, המומחה בוחן את רצף השיחה כדי להבדיל בין סלנג, צחוק ופגיעה אמיתית.',
  },
  {
    icon: LockKeyhole,
    title: 'שומרים על הפרטיות',
    desc: 'המחסניות והסינון הראשוני נשארים במכשיר הילד; רק אירוע שמצדיק בדיקה יוצא בצורה מוגנת.',
  },
];

export function ValuePillars() {
  return (
    <section className="py-16 md:py-20" dir="rtl">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground text-center mb-10">
          הגנה חכמה לשיחות של ילדים
        </h2>
        <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {pillars.map(({ icon: Icon, title, desc }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="bg-card border border-border rounded-2xl p-6 text-center hover:border-primary/40 transition-colors"
            >
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center">
                <Icon className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-primary mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
