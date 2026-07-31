import { motion } from 'framer-motion';
import { Activity, Calendar, Clock, Lock, MapPin, Siren } from 'lucide-react';

const features = [
  { icon: Clock, title: 'ניהול זמן מסך', desc: 'הגבלת זמן ואיתות בצורה פשוטה וברורה.' },
  { icon: Lock, title: 'שליטה באפליקציות', desc: 'אישור או חסימה של אפליקציות לכל ילד בנפרד.' },
  { icon: Calendar, title: 'לוחות זמנים', desc: 'שעות לימודים, שינה ושגרה משפחתית.' },
  { icon: MapPin, title: 'מיקום והתראות', desc: 'לדעת כשהילד הגיע או יצא מהמקום שהגדרתם.' },
  { icon: Siren, title: 'איתור ומצב אבוד', desc: 'צלצול, איתור ופעולות חירום ישירות ממרכז ההגנה.' },
  { icon: Activity, title: 'תקינות והרשאות', desc: 'לראות אם המכשיר מחובר ואם חסרה הרשאה חיונית.' },
];

export function FeaturesGrid() {
  return (
    <section id="features" className="py-16 md:py-24" dir="rtl">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground text-center mb-12">
          כל מה שהורה צריך, במקום אחד
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
          {features.map(({ icon: Icon, title, desc }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="bg-card border border-border rounded-2xl p-6 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 transition-colors"
            >
              <div className="w-12 h-12 bg-primary/15 border border-primary/30 rounded-xl flex items-center justify-center mb-4">
                <Icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
