import { motion } from 'framer-motion';
import { Trophy, MessageSquare, ShieldCheck } from 'lucide-react';

const pillars = [
  {
    icon: Trophy,
    title: 'אחריות שמתגמלת',
    desc: 'הילד מבצע משימות ומרוויח דקות בזמן מסך בצורה הוגנת וברורה.',
  },
  {
    icon: MessageSquare,
    title: 'פחות ויכוחים',
    desc: 'כללים ברורים, תהליך הוגן, ופחות "אבא תפתח" ו"אמא תוסיפי".',
  },
  {
    icon: ShieldCheck,
    title: 'גבולות ברורים',
    desc: 'זמני מסך, חסימות אפליקציות, לוחות זמנים ובקשות זמן במקום אחד.',
  },
];

export function ValuePillars() {
  return (
    <section className="py-16 md:py-20" dir="rtl">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground text-center mb-10">
          הדור החדש של בקרת הורים
        </h2>
        <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {pillars.map(({ icon: Icon, title, desc }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="bg-card border border-border rounded-2xl p-6 text-center hover:border-primary/40 transition-all"
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
