import { motion } from 'framer-motion';
import { BrainCircuit, Sprout, SlidersHorizontal } from 'lucide-react';

const pillars = [
  {
    icon: SlidersHorizontal,
    title: 'גבולות ברורים',
    desc: 'KippyAI נבנית כדי לרכז כללים משפחתיים ברורים סביב השימוש בטלפון.',
  },
  {
    icon: BrainCircuit,
    title: 'אות בתוך הרעש',
    desc: 'החזון הוא לעזור להבחין בין רגע רגיל לבין מצב ששווה לבדוק, בלי למהר למסקנות.',
  },
  {
    icon: Sprout,
    title: 'יותר מקום לגדול',
    desc: 'כלים ושפה שנועדו לתמוך בעצמאות הילד ובשיחה משפחתית רגועה יותר.',
  },
];

export function ValuePillars() {
  return (
    <section className="py-16 md:py-20" dir="rtl">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground text-center mb-10">
          דרך רגועה יותר להורות בעולם הדיגיטלי
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
