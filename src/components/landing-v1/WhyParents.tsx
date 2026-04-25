import { motion } from 'framer-motion';
import { Home, Handshake, Clock, Brain, CheckCircle2 } from 'lucide-react';

const items = [
  { icon: Home, title: 'מערכת אחת', sub: 'מסודרת וברורה' },
  { icon: Handshake, title: 'יותר אחריות', sub: 'ועצמאות לילד' },
  { icon: Clock, title: 'פחות מאבק', sub: 'על זמן ועל דקה' },
  { icon: Brain, title: 'פחות כאב ראש', sub: 'יומיומי' },
];

export function WhyParents() {
  return (
    <section className="py-16 md:py-20" dir="rtl">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground text-center mb-10">
          למה הורים מתחברים לקיפי?
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 max-w-5xl mx-auto mb-8">
          {items.map(({ icon: Icon, title, sub }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="text-center"
            >
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center">
                <Icon className="w-7 h-7 text-primary" />
              </div>
              <p className="font-bold text-foreground text-sm">{title}</p>
              <p className="text-xs text-muted-foreground">{sub}</p>
            </motion.div>
          ))}
        </div>
        <p className="text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-success" />
          נבנה עבור משפחות אמיתיות, מתוך הצרכים האמיתיים של הבית המודרני
        </p>
      </div>
    </section>
  );
}
