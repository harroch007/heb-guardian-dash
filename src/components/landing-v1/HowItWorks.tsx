import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import phoneSettings from '@/assets/landing-v1/quote-boy-phone.png';
import boyEarning from '@/assets/landing-v1/step-boy-earning.png';
import familyCouch from '@/assets/landing-v1/step-family-couch.png';

const steps = [
  {
    num: 1,
    img: phoneSettings,
    alt: 'הגדרת גבולות',
    title: 'ההורה מגדיר גבולות',
    desc: 'זמן מסך, אפליקציות, שגרות וחוקים.',
  },
  {
    num: 2,
    img: boyEarning,
    alt: 'ילד מרוויח דקות',
    title: 'הילד מרוויח דקות',
    desc: 'באמצעות משימות יומיומיות והתנהלות אחראית.',
  },
  {
    num: 3,
    img: familyCouch,
    alt: 'משפחה רגועה',
    title: 'הבית נרגע',
    desc: 'פחות ריבים, יותר סדר, ותחושה הוגנת לכולם.',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-16 md:py-24" dir="rtl">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground text-center mb-12">איך זה עובד?</h2>
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto relative">
          {steps.map(({ num, img, alt, title, desc }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="relative bg-card border border-border rounded-2xl p-6 text-center"
            >
              <div className="w-10 h-10 mx-auto mb-4 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center glow-primary">
                {num}
              </div>
              <img
                src={img}
                alt={alt}
                loading="lazy"
                width={200}
                height={200}
                className="w-36 h-36 sm:w-44 sm:h-44 object-contain mx-auto mb-3"
              />
              <h3 className="text-lg font-bold text-foreground mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              {i < steps.length - 1 && (
                <ArrowLeft className="hidden md:block absolute top-1/2 -translate-y-1/2 -left-5 w-7 h-7 text-primary/50" />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
