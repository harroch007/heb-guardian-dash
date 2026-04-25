import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';
import boyPhone from '@/assets/landing-v1/quote-boy-phone.png';
import girlShrug from '@/assets/landing-v1/quote-girl-shrug.png';
import boyPleading from '@/assets/landing-v1/quote-boy-pleading.png';

const quotes = [
  { img: boyPleading, alt: 'ילד מתחנן', text: '"אבא, רק עוד 5 דקות"' },
  { img: girlShrug, alt: 'ילדה מושכת בכתפיה', text: '"אמא, זה לא אני, רוני הייתה בטלפון שלי!"' },
  { img: boyPhone, alt: 'ילד עם טלפון', text: '"אבל שכחתי את הטלפון פתוח"' },
];

export function EmpathyQuotes() {
  return (
    <section className="py-16 md:py-20" dir="rtl">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground text-center mb-10">נשמע מוכר?</h2>
        <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {quotes.map((q, i) => (
            <motion.div
              key={q.text}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="bg-card border border-border rounded-2xl p-6 text-center hover:border-primary/40 transition-colors flex flex-col items-center"
            >
              <img
                src={q.img}
                alt={q.alt}
                loading="lazy"
                width={160}
                height={160}
                className="w-32 h-32 sm:w-40 sm:h-40 object-contain mb-3"
              />
              <p className="text-base text-foreground font-medium leading-relaxed">{q.text}</p>
            </motion.div>
          ))}
        </div>
        <p className="text-center text-muted-foreground mt-8 flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          הורים לא צריכים לנהל משא ומתן על כל דקה.
        </p>
      </div>
    </section>
  );
}
