import { motion } from 'framer-motion';
import { Download, QrCode, Settings2 } from 'lucide-react';

const steps = [
  { icon: Download, title: 'מורידים את האפליקציה', desc: 'ההורה והילד — שניהם מורידים מ-Google Play' },
  { icon: QrCode, title: 'מחברים בקוד QR', desc: 'סורקים פעם אחת — והמכשירים מתחברים' },
  { icon: Settings2, title: 'מתחילים לנהל', desc: 'הגדרות, משימות, מעקב — הכל ממקום אחד' },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-16 md:py-24 bg-white" dir="rtl">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">איך זה עובד?</h2>
          <p className="text-lg text-muted-foreground">3 שלבים פשוטים, ואתם בפנים</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto relative">
          {steps.map(({ icon: Icon, title, desc }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="relative text-center bg-muted/30 rounded-2xl p-6 border border-border"
            >
              <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-lg">
                {i + 1}
              </div>
              <Icon className="w-10 h-10 text-primary mx-auto mb-3" />
              <h3 className="text-lg font-bold text-foreground mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
