import { motion } from 'framer-motion';
import { Rocket, Eye, Star } from 'lucide-react';

const items = [
  { icon: Rocket, title: 'פשוט להפעיל', desc: 'מחברים ב-QR, מוכן ב-3 דקות. בלי הגדרות מסובכות.' },
  { icon: Eye, title: 'שקוף לילד', desc: 'הילד רואה את הזמן שלו, את המשימות ואת ההישגים. בלי סודות.' },
  { icon: Star, title: 'בנוי לישראל', desc: 'עברית מלאה, שעון שבת, חגים יהודיים — אוטומטית.' },
];

export function Differentiators() {
  return (
    <section className="py-16 md:py-24" dir="rtl">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">למה Kippy?</h2>
          <p className="text-lg text-muted-foreground">3 סיבות שעושות את ההבדל</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {items.map(({ icon: Icon, title, desc }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="text-center"
            >
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <Icon className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">{title}</h3>
              <p className="text-muted-foreground leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
