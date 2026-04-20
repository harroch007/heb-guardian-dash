import { motion } from 'framer-motion';
import { Shield, Clock, Calendar, MapPin, Globe2, Bell } from 'lucide-react';

const features = [
  { icon: Shield, title: 'חסימת אפליקציות', desc: 'אתם מחליטים מה מותר ומה לא — בכל רגע' },
  { icon: Clock, title: 'מגבלות זמן מסך', desc: 'יומיות, לאפליקציה ספציפית, או לכל המכשיר' },
  { icon: Calendar, title: 'לוחות זמנים', desc: 'שעות שינה, בית ספר ושבת — אוטומטית' },
  { icon: MapPin, title: 'מיקום בזמן אמת', desc: 'תמיד תדעו איפה הילד נמצא' },
  { icon: Globe2, title: 'אזורים בטוחים', desc: 'התראה כשהילד מגיע או יוצא ממקום' },
  { icon: Bell, title: 'שליטה מרחוק', desc: 'נעילה, צלצול וסנכרון מיידי בלחיצה' },
];

export function FeaturesGrid() {
  return (
    <section className="py-16 md:py-24" dir="rtl">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            כל הכלים שאתם צריכים
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            מערכת אחת שמרכזת את כל ההגדרות, הבקרות והנתונים על מכשיר הילד
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map(({ icon: Icon, title, desc }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="bg-white border border-border rounded-2xl p-6 hover:shadow-lg hover:border-primary/30 transition-all"
            >
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
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
